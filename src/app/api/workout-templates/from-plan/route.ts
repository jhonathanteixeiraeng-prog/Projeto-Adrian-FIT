import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { canAccessPlan, validationErrorResponse } from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const schema = z.object({
    planId: z.string({ required_error: 'Plano é obrigatório' }).min(1, 'Plano é obrigatório'),
    title: z.string().trim().min(1, 'Informe o nome do modelo').max(120, 'Nome do modelo: use no máximo 120 caracteres').optional(),
    description: z.string().max(500, 'Descrição: use no máximo 500 caracteres').optional(),
});

// POST /api/workout-templates/from-plan - Copy a saved plan into the personal's template library
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const validated = parsed.data;

        const plan = await prisma.workoutPlan.findUnique({
            where: { id: validated.planId },
            include: {
                student: { select: { personalId: true } },
                workoutDays: {
                    orderBy: { order: 'asc' },
                    include: {
                        items: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!plan || !canAccessPlan(session.user, plan)) {
            return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
        }

        if (!plan.workoutDays.length) {
            return NextResponse.json(
                { success: false, error: 'Plano sem dias de treino não pode ser copiado' },
                { status: 400 }
            );
        }

        const template = await prisma.workoutTemplate.create({
            data: {
                personalId: session.user.personalId,
                title: validated.title || plan.title,
                description: validated.description || `Copiado do plano do aluno em ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`,
                templateDays: {
                    create: plan.workoutDays.map((day, dayIndex) => ({
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        order: dayIndex,
                        items: {
                            create: day.items.map((item, itemIndex) => ({
                                exerciseId: item.exerciseId,
                                sets: item.sets,
                                reps: item.reps,
                                rest: item.rest,
                                load: item.load,
                                rpe: item.rpe,
                                notes: item.notes || '',
                                order: itemIndex,
                            })),
                        },
                    })),
                },
            },
            include: {
                _count: { select: { templateDays: true } },
            },
        });

        return NextResponse.json({ success: true, data: template }, { status: 201 });
    } catch (error) {
        console.error('Error copying workout plan to template:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao copiar treino para biblioteca' },
            { status: 500 }
        );
    }
}
