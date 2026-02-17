import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            include: {
                workoutPlans: {
                    where: { active: true },
                    include: {
                        workoutDays: {
                            include: {
                                items: {
                                    include: {
                                        exercise: true
                                    },
                                    orderBy: { order: 'asc' }
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const activePlan = student.workoutPlans[0];

        if (!activePlan) {
            return NextResponse.json({
                success: true,
                data: null
            });
        }

        // Format plan for frontend
        const formattedPlan = {
            id: activePlan.id,
            title: activePlan.title,
            startDate: activePlan.startDate,
            endDate: activePlan.endDate,
            workoutDays: activePlan.workoutDays.map(day => ({
                id: day.id,
                name: day.name,
                dayOfWeek: day.dayOfWeek,
                exercises: day.items.map(item => ({
                    id: item.id,
                    name: item.exercise.name,
                    muscleGroup: item.exercise.muscleGroup,
                    sets: item.sets,
                    reps: item.reps,
                    rest: item.rest,
                    notes: item.notes,
                    videoUrl: item.exercise.videoUrl,
                    instructions: item.exercise.instructions,
                    equipment: item.exercise.equipment,
                }))
            }))
        };

        return NextResponse.json({
            success: true,
            data: formattedPlan
        });

    } catch (error) {
        console.error('Error fetching student workout plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar plano de treino' },
            { status: 500 }
        );
    }
}
