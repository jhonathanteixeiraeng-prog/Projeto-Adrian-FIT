import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    DUPLICATE_EXERCISE_NAME,
    exerciseUpdateSchema,
    isExerciseNameTaken,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const FORBIDDEN_EDIT = 'Este exercício pertence a outro personal e não pode ser alterado por você.';

/** Personals may change global exercises (personalId null, shared library) and their own ones. */
function canManage(exercise: { personalId: string | null }, personalId: string | undefined) {
    return exercise.personalId === null || exercise.personalId === personalId;
}

function plural(count: number, singular: string, pluralForm: string) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
}

// GET - Get single exercise
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const exercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        let allowed = false;
        if (exercise) {
            if (exercise.personalId === null) {
                allowed = true;
            } else if (session.user.role === 'PERSONAL') {
                allowed = exercise.personalId === session.user.personalId;
            } else if (session.user.role === 'STUDENT') {
                const student = session.user.studentId
                    ? await prisma.student.findUnique({
                          where: { id: session.user.studentId },
                          select: { personalId: true },
                      })
                    : null;
                allowed = student?.personalId === exercise.personalId;
            }
        }

        if (!exercise || !allowed) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }

        return NextResponse.json(exercise);
    } catch (error) {
        console.error('Error fetching exercise:', error);
        return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
    }
}

// PUT - Update exercise
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = exerciseUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const validatedData = parsed.data;

        const existingExercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        if (!existingExercise) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }
        if (!canManage(existingExercise, session.user.personalId)) {
            return NextResponse.json({ success: false, error: FORBIDDEN_EDIT }, { status: 403 });
        }

        if (
            validatedData.name &&
            validatedData.name !== existingExercise.name &&
            (await isExerciseNameTaken(prisma, validatedData.name, existingExercise.id, session.user.personalId))
        ) {
            return NextResponse.json({ success: false, error: DUPLICATE_EXERCISE_NAME }, { status: 409 });
        }

        const exercise = await prisma.exercise.update({
            where: { id: params.id },
            data: {
                name: validatedData.name,
                muscleGroup: validatedData.muscleGroup,
                equipment: validatedData.equipment === undefined ? undefined : validatedData.equipment ?? '',
                difficulty: validatedData.difficulty,
                videoUrl: validatedData.videoUrl === undefined ? undefined : validatedData.videoUrl || null,
                thumbnailUrl: validatedData.thumbnailUrl === undefined ? undefined : validatedData.thumbnailUrl || null,
                instructions: validatedData.instructions === undefined ? undefined : validatedData.instructions ?? '',
                tips: validatedData.tips === undefined ? undefined : validatedData.tips ?? '',
            },
        });

        return NextResponse.json(exercise);
    } catch (error) {
        if ((error as { code?: string } | null)?.code === 'P2002') {
            return NextResponse.json({ success: false, error: DUPLICATE_EXERCISE_NAME }, { status: 409 });
        }
        console.error('Error updating exercise:', error);
        return NextResponse.json({ error: 'Erro ao atualizar exercício' }, { status: 500 });
    }
}

// DELETE - Delete exercise (blocked while plans, templates or students' load history use it)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const existingExercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        if (!existingExercise) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }
        if (!canManage(existingExercise, session.user.personalId)) {
            return NextResponse.json({ success: false, error: FORBIDDEN_EDIT }, { status: 403 });
        }

        const [planItems, templateItems, setLogs] = await Promise.all([
            prisma.workoutItem.findMany({
                where: { exerciseId: existingExercise.id },
                select: { workoutDay: { select: { planId: true } } },
            }),
            prisma.workoutTemplateItem.findMany({
                where: { exerciseId: existingExercise.id },
                select: { templateDay: { select: { templateId: true } } },
            }),
            prisma.setLog.count({ where: { exerciseId: existingExercise.id } }),
        ]);

        const plans = new Set(planItems.map((item) => item.workoutDay.planId)).size;
        const templates = new Set(templateItems.map((item) => item.templateDay.templateId)).size;

        if (plans || templates || setLogs) {
            const usages = [
                plans ? `em ${plural(plans, 'ficha de treino', 'fichas de treino')}` : null,
                templates ? `em ${plural(templates, 'modelo', 'modelos')}` : null,
                setLogs ? `no histórico de cargas dos alunos (${plural(setLogs, 'registro', 'registros')})` : null,
            ].filter(Boolean);
            const where = usages.length > 1 ? `${usages.slice(0, -1).join(', ')} e ${usages[usages.length - 1]}` : usages[0];
            const hint = setLogs
                ? 'Excluí-lo apagaria o histórico de cargas dos alunos, por isso a exclusão foi bloqueada. Se não quiser mais usá-lo, troque-o nas fichas e renomeie-o (ex.: "(não usar)").'
                : 'Troque-o por outro exercício nessas fichas/modelos e tente novamente.';
            return NextResponse.json(
                {
                    success: false,
                    code: 'EXERCISE_IN_USE',
                    usage: { plans, templates, setLogs },
                    error: `Não é possível excluir "${existingExercise.name}": ele está sendo usado ${where}. ${hint}`,
                },
                { status: 409 }
            );
        }

        await prisma.exercise.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if ((error as { code?: string } | null)?.code === 'P2003') {
            return NextResponse.json(
                { success: false, error: 'Este exercício está em uso e não pode ser excluído.' },
                { status: 409 }
            );
        }
        console.error('Error deleting exercise:', error);
        return NextResponse.json({ error: 'Erro ao excluir exercício' }, { status: 500 });
    }
}
