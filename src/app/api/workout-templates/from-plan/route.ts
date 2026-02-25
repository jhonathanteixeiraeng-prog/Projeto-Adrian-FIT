import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
    planId: z.string().min(1, 'Plano é obrigatório'),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validated = schema.parse(body);

        const plan = await prisma.workoutPlan.findUnique({
            where: { id: validated.planId },
            include: {
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

        if (!plan || plan.personalId !== session.user.personalId) {
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
                personalId: session.user.personalId!,
                title: validated.title || plan.title,
                description: validated.description || `Copiado do plano do aluno em ${new Date().toLocaleDateString('pt-BR')}`,
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
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error copying workout plan to template:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao copiar treino para biblioteca' },
            { status: 500 }
        );
    }
}

