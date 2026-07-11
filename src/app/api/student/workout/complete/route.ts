import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await prisma.student.findUnique({ where: { userId: session.user.id } });
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const body = await request.json();
        const dayId = String(body?.dayId || '');
        const completedSets = Math.max(0, Math.round(Number(body?.completedSets) || 0));
        const totalSets = Math.max(0, Math.round(Number(body?.totalSets) || 0));
        if (!dayId || completedSets < 1 || totalSets < 1 || completedSets > totalSets) {
            return NextResponse.json({ success: false, error: 'Dados de conclusão inválidos' }, { status: 400 });
        }

        const workoutDay = await prisma.workoutDay.findFirst({
            where: { id: dayId, plan: { studentId: student.id, active: true } },
            select: { id: true },
        });
        if (!workoutDay) {
            return NextResponse.json({ success: false, error: 'Treino não encontrado' }, { status: 404 });
        }

        const today = startOfToday();
        const logs = await prisma.setLog.count({ where: { studentId: student.id, dayId, date: { gte: today } } });
        if (logs < 1) {
            return NextResponse.json({ success: false, error: 'Conclua ao menos uma série antes de finalizar' }, { status: 400 });
        }

        const existing = await prisma.workoutCompletion.findFirst({
            where: { studentId: student.id, workoutDayId: dayId, completedAt: { gte: today } },
        });
        if (!existing) {
            await prisma.workoutCompletion.create({ data: { studentId: student.id, workoutDayId: dayId } });
        }

        return NextResponse.json({
            success: true,
            data: { completedSets, totalSets, percentage: Math.round((completedSets / totalSets) * 100), partial: completedSets < totalSets },
        });
    } catch (error) {
        console.error('Error completing workout:', error);
        return NextResponse.json({ success: false, error: 'Erro ao finalizar treino' }, { status: 500 });
    }
}
