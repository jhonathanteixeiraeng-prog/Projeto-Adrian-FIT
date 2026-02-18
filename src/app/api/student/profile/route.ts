import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

function parseGoalWeight(goal?: string | null): number | null {
    if (!goal) return null;
    const normalized = goal.replace(',', '.');
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function clampPercentage(value: number): number {
    return Math.max(0, Math.min(100, value));
}

// GET /api/student/profile - Get student profile settings
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
            select: {
                id: true,
                goal: true,
                weight: true,
                height: true,
                status: true,
                createdAt: true,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const [workoutCompletions, checkins] = await Promise.all([
            prisma.workoutCompletion.findMany({
                where: { studentId: student.id },
                select: { completedAt: true },
            }),
            prisma.checkin.findMany({
                where: { studentId: student.id },
                select: { date: true, weight: true },
                orderBy: { date: 'asc' },
            }),
        ]);

        const trainingDaysFromWorkout = new Set(
            workoutCompletions.map((item) => item.completedAt.toISOString().slice(0, 10))
        ).size;

        const trainingDaysFromCheckins = new Set(
            checkins.map((item) => item.date.toISOString().slice(0, 10))
        ).size;

        const trainingDays = trainingDaysFromWorkout > 0
            ? trainingDaysFromWorkout
            : trainingDaysFromCheckins;

        const currentWeight = checkins.length > 0
            ? Number(checkins[checkins.length - 1].weight)
            : student.weight ?? null;
        const startWeight = checkins.length > 0
            ? Number(checkins[0].weight)
            : student.weight ?? null;
        const goalWeight = parseGoalWeight(student.goal);

        let goalProgress = null as number | null;
        if (goalWeight !== null && startWeight !== null && currentWeight !== null) {
            if (startWeight === goalWeight) {
                goalProgress = currentWeight === goalWeight ? 100 : 0;
            } else if (startWeight > goalWeight) {
                goalProgress = clampPercentage(((startWeight - currentWeight) / (startWeight - goalWeight)) * 100);
            } else {
                goalProgress = clampPercentage(((currentWeight - startWeight) / (goalWeight - startWeight)) * 100);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                ...student,
                trainingDays,
                currentWeight,
                startWeight,
                goalWeight,
                goalProgress,
            },
        });
    } catch (error) {
        console.error('Error fetching student profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar perfil do aluno' },
            { status: 500 }
        );
    }
}

// PUT /api/student/profile - Update student profile settings
export async function PUT(request: NextRequest) {
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
            select: { id: true },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const goal = typeof body?.goal === 'string' ? body.goal.trim() : undefined;

        const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: {
                goal: goal || null,
            },
            select: {
                id: true,
                goal: true,
                weight: true,
                height: true,
                status: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updatedStudent,
            message: 'Objetivo atualizado com sucesso',
        });
    } catch (error) {
        console.error('Error updating student profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar perfil do aluno' },
            { status: 500 }
        );
    }
}
