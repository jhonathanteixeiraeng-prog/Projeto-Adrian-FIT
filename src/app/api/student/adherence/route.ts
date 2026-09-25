import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        let targetStudentId = session.user.studentId;

        // Se for o personal consultando sobre um aluno
        if (session.user.role === 'PERSONAL') {
            const queryStudentId = searchParams.get('studentId');
            if (queryStudentId) {
                const student = await prisma.student.findFirst({
                    where: { id: queryStudentId, personalId: session.user.personalId },
                });
                if (student) targetStudentId = student.id;
            }
        }

        if (!targetStudentId) {
            return NextResponse.json({ success: false, error: 'Aluno não identificado' }, { status: 404 });
        }

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 1. Busca planos ativos
        const [student, activeWorkoutPlan, activeDietPlan] = await Promise.all([
            prisma.student.findUnique({
                where: { id: targetStudentId },
                select: { id: true, weight: true },
            }),
            prisma.workoutPlan.findFirst({
                where: { studentId: targetStudentId, active: true },
                include: {
                    workoutDays: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.dietPlan.findFirst({
                where: { studentId: targetStudentId, active: true },
                include: {
                    meals: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        if (!student) {
            return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
        }

        // 2. Busca treinos concluídos nos últimos 7 dias (WorkoutSession e WorkoutCompletion)
        const [workoutSessions, legacyCompletions] = await Promise.all([
            prisma.workoutSession.findMany({
                where: {
                    studentId: targetStudentId,
                    completedAt: { gte: sevenDaysAgo },
                },
                select: { localDate: true, completedAt: true, status: true, percentage: true },
            }),
            prisma.workoutCompletion.findMany({
                where: {
                    studentId: targetStudentId,
                    completedAt: { gte: sevenDaysAgo },
                },
                select: { completedAt: true },
            }),
        ]);

        // Conjunto de dias únicos onde houve treino
        const completedWorkoutDates = new Set<string>();

        for (const s of workoutSessions) {
            if (s.status === 'COMPLETED' || s.percentage >= 60) {
                const dayKey = s.localDate || s.completedAt.toISOString().slice(0, 10);
                completedWorkoutDates.add(dayKey);
            }
        }

        for (const c of legacyCompletions) {
            const dayKey = c.completedAt.toISOString().slice(0, 10);
            completedWorkoutDates.add(dayKey);
        }

        const expectedWorkoutDays = Math.max(1, activeWorkoutPlan?.workoutDays?.length || 4);
        const completedWorkoutsCount = completedWorkoutDates.size;
        const calculatedWorkoutAdherence = Math.min(
            100,
            Math.round((completedWorkoutsCount / expectedWorkoutDays) * 100)
        );

        // 3. Busca refeições concluídas nos últimos 7 dias
        const completedMealsCount = await prisma.mealCompletion.count({
            where: {
                studentId: targetStudentId,
                completedAt: { gte: sevenDaysAgo },
            },
        });

        const mealsPerDay = Math.max(1, activeDietPlan?.meals?.length || 3);
        const expectedMealsCount = mealsPerDay * 7;
        const calculatedDietAdherence = Math.min(
            100,
            Math.round((completedMealsCount / expectedMealsCount) * 100)
        );

        return NextResponse.json({
            success: true,
            data: {
                workout: {
                    adherence: calculatedWorkoutAdherence,
                    completedDays: completedWorkoutsCount,
                    expectedDays: expectedWorkoutDays,
                    summary: `${completedWorkoutsCount} de ${expectedWorkoutDays} treinos realizados na semana`,
                },
                diet: {
                    adherence: calculatedDietAdherence,
                    completedMeals: completedMealsCount,
                    expectedMeals: expectedMealsCount,
                    mealsPerDay,
                    summary: `${completedMealsCount} de ${expectedMealsCount} refeições registradas na semana`,
                },
                calculatedAt: now.toISOString(),
            },
        });
    } catch (error) {
        console.error('Erro ao calcular adesão:', error);
        return NextResponse.json({ success: false, error: 'Erro ao calcular adesão' }, { status: 500 });
    }
}
