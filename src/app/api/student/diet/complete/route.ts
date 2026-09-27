import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { studentDay } from '@/lib/student-day';

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

        let body: { mealId?: unknown; completed?: unknown; localDate?: unknown; timezoneOffsetMinutes?: unknown };
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }
        const { mealId, completed } = body;

        if (typeof mealId !== 'string' || !mealId) {
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

        // "Today" in the student's calendar (localDate + timezoneOffsetMinutes, see student-day); the server's day otherwise.
        const day = studentDay(body);
        const today = { gte: day.start, lt: day.end };

        if (completed === false) {
            await prisma.mealCompletion.deleteMany({
                where: {
                    mealId,
                    studentId: student.id,
                    completedAt: today,
                },
            });
        } else {
            const existing = await prisma.mealCompletion.findFirst({
                where: {
                    mealId,
                    studentId: student.id,
                    completedAt: today,
                },
            });
            if (!existing) {
                // Inside the day it was marked for (now, when that day is today).
                const now = new Date();
                const completedAt = now >= day.start && now < day.end ? now : new Date(day.start.getTime() + 12 * 60 * 60 * 1000);
                await prisma.mealCompletion.create({
                    data: { mealId, studentId: student.id, completedAt },
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
