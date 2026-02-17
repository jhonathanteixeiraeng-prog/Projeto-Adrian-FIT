import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Get single workout plan
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: params.id },
            include: {
                student: {
                    include: {
                        user: {
                            select: { name: true, email: true },
                        },
                    },
                },
                workoutDays: {
                    orderBy: { order: 'asc' },
                    include: {
                        items: {
                            orderBy: { order: 'asc' },
                            include: {
                                exercise: true,
                            },
                        },
                    },
                },
            },
        });

        if (!workoutPlan) {
            return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 });
        }

        return NextResponse.json(workoutPlan);
    } catch (error) {
        console.error('Error fetching workout plan:', error);
        return NextResponse.json({ error: 'Erro ao buscar plano' }, { status: 500 });
    }
}

// PUT - Update workout plan
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const { title, startDate, endDate, active, workoutDays } = body;

        // Update the plan
        const updatedPlan = await prisma.workoutPlan.update({
            where: { id: params.id },
            data: {
                title,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                active,
            },
        });

        // If workoutDays provided, recreate them
        if (workoutDays) {
            // Delete existing days (cascade will delete items)
            await prisma.workoutDay.deleteMany({
                where: { planId: params.id },
            });

            // Create new days with items
            for (let i = 0; i < workoutDays.length; i++) {
                const day = workoutDays[i];

                // Filter items to only include those with valid exerciseId
                const validItems = (day.items || []).filter((item: any) =>
                    item.exerciseId && item.exerciseId.trim() !== ''
                );

                await prisma.workoutDay.create({
                    data: {
                        planId: params.id,
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        order: i,
                        items: {
                            create: validItems.map((item: any, itemIndex: number) => ({
                                exerciseId: item.exerciseId,
                                sets: item.sets,
                                reps: item.reps,
                                rest: item.rest,
                                notes: item.notes || '',
                                order: itemIndex,
                            })),
                        },
                    },
                });
            }
        }

        // Fetch updated plan with relations
        const result = await prisma.workoutPlan.findUnique({
            where: { id: params.id },
            include: {
                student: {
                    include: { user: { select: { name: true } } },
                },
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

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating workout plan:', error);
        return NextResponse.json({ success: false, error: 'Erro ao atualizar plano' }, { status: 500 });
    }
}

// DELETE - Delete workout plan
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Delete plan (Cascade should handle days and items)
        await prisma.workoutPlan.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true, message: 'Plano excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting workout plan:', error);
        return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 });
    }
}
