import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function finiteNumber(value: unknown, minimum: number, maximum: number) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(maximum, Math.max(minimum, number));
}

export async function POST(request: NextRequest) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await prisma.student.findUnique({ where: { userId: authSession.user.id } });
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const body = await request.json();
        const workoutDayId = String(body?.dayId || '');
        const localDate = String(body?.localDate || '');
        const activeEnergyKilocalories = finiteNumber(body?.activeEnergyKilocalories, 0, 10_000);
        const averageHeartRateBPM = finiteNumber(body?.averageHeartRateBPM, 0, 300);
        const maxHeartRateBPM = finiteNumber(body?.maxHeartRateBPM, 0, 300);
        const durationSeconds = finiteNumber(body?.durationSeconds, 0, 24 * 60 * 60);
        const healthWorkoutUUID = typeof body?.healthWorkoutUUID === 'string'
            ? body.healthWorkoutUUID.slice(0, 100)
            : null;

        if (!workoutDayId || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
            || activeEnergyKilocalories == null || averageHeartRateBPM == null
            || maxHeartRateBPM == null || durationSeconds == null) {
            return NextResponse.json({ success: false, error: 'Métricas de treino inválidas' }, { status: 400 });
        }

        const existing = await prisma.workoutSession.findUnique({
            where: {
                studentId_workoutDayId_localDate: {
                    studentId: student.id,
                    workoutDayId,
                    localDate,
                },
            },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'A conclusão do treino ainda está sendo sincronizada' }, { status: 409 });
        }

        const workout = await prisma.workoutSession.update({
            where: { id: existing.id },
            data: {
                activeEnergyKilocalories,
                averageHeartRateBPM,
                maxHeartRateBPM,
                healthWorkoutUUID,
                durationSeconds: Math.max(60, Math.round(durationSeconds)),
            },
            select: { id: true },
        });

        return NextResponse.json({ success: true, data: workout });
    } catch (error) {
        console.error('Error syncing workout health metrics:', error);
        return NextResponse.json({ success: false, error: 'Erro ao sincronizar métricas do Apple Watch' }, { status: 500 });
    }
}
