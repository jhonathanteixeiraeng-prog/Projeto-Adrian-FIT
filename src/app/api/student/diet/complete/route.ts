import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/student/diet/complete - Mark/unmark a meal as completed today
export async function POST(request: NextRequest) {
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
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { mealId, completed } = body as { mealId?: string; completed?: boolean };

        if (!mealId) {
            return NextResponse.json(
                { success: false, error: 'Refeição é obrigatória' },
                { status: 400 }
            );
        }

        // Verify the meal belongs to a diet plan of this student
        const meal = await prisma.dietMeal.findFirst({
            where: {
                id: mealId,
                dietPlan: { studentId: student.id },
            },
        });

        if (!meal) {
            return NextResponse.json(
                { success: false, error: 'Refeição não encontrada' },
                { status: 404 }
            );
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        if (completed === false) {
            await prisma.mealCompletion.deleteMany({
                where: {
                    mealId,
                    studentId: student.id,
                    completedAt: { gte: startOfDay },
                },
            });
        } else {
            const existing = await prisma.mealCompletion.findFirst({
                where: {
                    mealId,
                    studentId: student.id,
                    completedAt: { gte: startOfDay },
                },
            });
            if (!existing) {
                await prisma.mealCompletion.create({
                    data: { mealId, studentId: student.id },
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: { mealId, completed: completed !== false },
        });
    } catch (error) {
        console.error('Error completing meal:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao registrar refeição' },
            { status: 500 }
        );
    }
}
