import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import { z } from 'zod';
import {
    TRANSACTION_OPTIONS,
    deactivateOtherActivePlans,
    parsePlanDate,
    planDetailInclude,
    prismaErrorResponse,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const fromTemplateSchema = z.object({
    templateId: z.string({ required_error: 'Selecione o modelo' }).min(1, 'Selecione o modelo'),
    studentId: z.string({ required_error: 'Selecione o aluno' }).min(1, 'Selecione o aluno'),
    title: z.string({ required_error: 'Informe o título da ficha' }).trim().min(1, 'Informe o título da ficha').max(120, 'Título: use no máximo 120 caracteres'),
    startDate: z.string({ required_error: 'Informe a data de início' }).refine((value) => parsePlanDate(value) !== null, 'Data de início inválida'),
    endDate: z.string({ required_error: 'Informe a data de término' }).refine((value) => parsePlanDate(value) !== null, 'Data de término inválida'),
    notifyStudent: z.boolean().optional(),
});

// POST /api/workout-plans/from-template - Create an active plan for a student from a library template
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const personalId = session.user.personalId;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = fromTemplateSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const [template, student] = await Promise.all([
            prisma.workoutTemplate.findFirst({
                where: { id: data.templateId, personalId },
                include: {
                    templateDays: {
                        orderBy: { order: 'asc' },
                        include: { items: { orderBy: { order: 'asc' } } },
                    },
                },
            }),
            prisma.student.findFirst({
                where: { id: data.studentId, personalId },
                select: { id: true },
            }),
        ]);

        if (!template) {
            return NextResponse.json({ success: false, error: 'Modelo não encontrado' }, { status: 404 });
        }
        if (!student) {
            return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
        }

        const workoutPlan = await prisma.$transaction(async (tx) => {
            await deactivateOtherActivePlans(tx, student.id);

            return tx.workoutPlan.create({
                data: {
                    title: data.title,
                    studentId: student.id,
                    personalId,
                    startDate: parsePlanDate(data.startDate)!,
                    endDate: parsePlanDate(data.endDate)!,
                    active: true,
                    version: 1,
                    workoutDays: {
                        create: template.templateDays.map((day, dayIndex) => ({
                            name: day.name,
                            dayOfWeek: day.dayOfWeek,
                            order: dayIndex,
                            items: {
                                create: day.items.map((item, itemIndex) => ({
                                    exerciseId: item.exerciseId,
                                    sets: item.sets,
                                    reps: item.reps,
                                    rest: item.rest,
                                    restBySet: item.restBySet,
                                    load: item.load,
                                    rpe: item.rpe,
                                    groupId: item.groupId,
                                    notes: item.notes || '',
                                    order: itemIndex,
                                })),
                            },
                        })),
                    },
                },
                include: planDetailInclude,
            });
        }, TRANSACTION_OPTIONS);

        if (data.notifyStudent) {
            await notifyStudentAboutPlan({ studentId: student.id, kind: 'workout', title: data.title });
        }

        return NextResponse.json({ success: true, data: workoutPlan }, { status: 201 });
    } catch (error) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error cloning workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao clonar modelo' }, { status: 500 });
    }
}
