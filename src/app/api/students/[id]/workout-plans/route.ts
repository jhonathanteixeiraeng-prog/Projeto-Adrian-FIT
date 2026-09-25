import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import {
    TRANSACTION_OPTIONS,
    addDays,
    buildDaysCreateInput,
    deactivateOtherActivePlans,
    parsePlanDate,
    planDayInputSchema,
    prismaErrorResponse,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const createForStudentSchema = z.object({
    title: z.string({ required_error: 'Título é obrigatório' }).trim().min(1, 'Título é obrigatório').max(120, 'Título: use no máximo 120 caracteres'),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    notifyStudent: z.boolean().optional(),
    workoutDays: z
        .array(planDayInputSchema, { required_error: 'Adicione pelo menos um dia de treino' })
        .min(1, 'Adicione pelo menos um dia de treino'),
});

/** Older clients omitted sets/reps/rest/name; keep the defaults this route always applied. */
function withLegacyDefaults(body: unknown) {
    if (!body || typeof body !== 'object') return body;
    const raw = body as Record<string, unknown>;
    if (!Array.isArray(raw.workoutDays)) return body;
    return {
        ...raw,
        workoutDays: raw.workoutDays.map((day: any) => ({
            ...day,
            name: typeof day?.name === 'string' && day.name.trim() ? day.name : `Treino ${Number(day?.dayOfWeek ?? 0) + 1}`,
            items: Array.isArray(day?.items)
                ? day.items.map((item: any) => ({
                      ...item,
                      sets: item?.sets || 3,
                      reps: item?.reps || '12',
                      rest: item?.rest ?? 60,
                  }))
                : [],
        })),
    };
}

// GET /api/students/[id]/workout-plans - List workout plans for student
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const workoutPlans = await prisma.workoutPlan.findMany({
            where: { studentId },
            include: {
                workoutDays: {
                    include: {
                        items: {
                            orderBy: { order: 'asc' },
                            include: {
                                exercise: true,
                            },
                        },
                    },
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: workoutPlans });
    } catch (error) {
        console.error('Error fetching workout plans:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar planos de treino' },
            { status: 500 }
        );
    }
}

// POST /api/students/[id]/workout-plans - Create (and activate) a workout plan for the student
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }
        const personalId = session.user.personalId;

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId,
            },
            select: { id: true },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        let body: unknown;
        try {
            body = withLegacyDefaults(await request.json());
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        // Rows without an exercise are rejected (they used to be dropped silently while reporting success).
        const parsed = createForStudentSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const startDate = parsePlanDate(data.startDate) ?? new Date();
        const endDate = parsePlanDate(data.endDate) ?? addDays(new Date(), 30);

        const workoutPlan = await prisma.$transaction(async (tx) => {
            await deactivateOtherActivePlans(tx, studentId);

            return tx.workoutPlan.create({
                data: {
                    title: data.title,
                    startDate,
                    endDate,
                    active: true,
                    studentId,
                    personalId,
                    workoutDays: {
                        create: buildDaysCreateInput(data.workoutDays),
                    },
                },
                include: {
                    workoutDays: {
                        orderBy: { order: 'asc' },
                        include: {
                            items: {
                                orderBy: { order: 'asc' },
                                include: { exercise: true },
                            },
                        },
                    },
                },
            });
        }, TRANSACTION_OPTIONS);

        if (data.notifyStudent) {
            await notifyStudentAboutPlan({ studentId, kind: 'workout', title: data.title });
        }

        return NextResponse.json({
            success: true,
            data: workoutPlan,
            message: 'Plano de treino criado com sucesso!',
        });
    } catch (error: any) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error creating workout plan:', error);

        return NextResponse.json(
            { success: false, error: 'Erro ao criar plano de treino' },
            { status: 500 }
        );
    }
}
