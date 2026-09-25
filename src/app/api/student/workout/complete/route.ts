import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function localDayRange(localDate: string, timezoneOffsetMinutes: number) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
    if (!match) return null;
    const [, year, month, day] = match;
    const startMs = Date.UTC(Number(year), Number(month) - 1, Number(day)) - timezoneOffsetMinutes * 60_000;
    const start = new Date(startMs);
    const end = new Date(startMs + 24 * 60 * 60 * 1000);
    return { start, end };
}

function validDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
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
        const dayId = String(body?.dayId || '');
        const completedSets = Math.max(0, Math.round(Number(body?.completedSets) || 0));
        const totalSets = Math.max(0, Math.round(Number(body?.totalSets) || 0));
        const percentage = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
        const timezoneOffsetMinutes = Math.min(840, Math.max(-840, Math.round(Number(body?.timezoneOffsetMinutes) || 0)));
        const localDate = String(body?.localDate || new Date().toISOString().slice(0, 10));
        const range = localDayRange(localDate, timezoneOffsetMinutes);

        if (!dayId || !range || completedSets < 1 || totalSets < 1 || completedSets > totalSets) {
            return NextResponse.json({ success: false, error: 'Dados de conclusão inválidos' }, { status: 400 });
        }

        const workoutDay = await prisma.workoutDay.findFirst({
            where: { id: dayId, plan: { studentId: student.id, active: true } },
            select: { id: true, name: true },
        });
        if (!workoutDay) {
            return NextResponse.json({ success: false, error: 'Treino não encontrado' }, { status: 404 });
        }

        const logs = await prisma.setLog.findMany({
            where: { studentId: student.id, dayId, date: { gte: range.start, lt: range.end } },
            select: { id: true, date: true, weight: true, reps: true },
            orderBy: { date: 'asc' },
        });
        if (logs.length < 1) {
            return NextResponse.json({ success: false, error: 'Conclua ao menos uma série antes de finalizar' }, { status: 400 });
        }

        const completedAt = validDate(body?.completedAt) ?? new Date();
        const requestedStart = validDate(body?.startedAt);
        const startedAt = requestedStart && requestedStart <= completedAt ? requestedStart : logs[0].date;
        const derivedDuration = Math.max(60, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
        const durationSeconds = Math.min(24 * 60 * 60, Math.max(60, Math.round(Number(body?.durationSeconds) || derivedDuration)));
        const totalVolume = logs.reduce((sum, log) => sum + Math.max(0, log.weight) * Math.max(0, log.reps), 0);

        const workoutSession = await prisma.$transaction(async (tx) => {
            const detailed = await tx.workoutSession.upsert({
                where: {
                    studentId_workoutDayId_localDate: {
                        studentId: student.id,
                        workoutDayId: dayId,
                        localDate,
                    },
                },
                create: {
                    studentId: student.id,
                    workoutDayId: dayId,
                    dayName: workoutDay.name,
                    localDate,
                    status: completedSets >= totalSets ? 'COMPLETED' : 'PARTIAL',
                    startedAt,
                    completedAt,
                    completedSets,
                    totalSets,
                    percentage,
                    durationSeconds,
                    totalVolume,
                },
                update: {
                    dayName: workoutDay.name,
                    status: completedSets >= totalSets ? 'COMPLETED' : 'PARTIAL',
                    startedAt,
                    completedAt,
                    completedSets,
                    totalSets,
                    percentage,
                    durationSeconds,
                    totalVolume,
                },
            });

            await tx.setLog.updateMany({
                where: { id: { in: logs.map((log) => log.id) } },
                data: { sessionId: detailed.id },
            });

            const legacy = await tx.workoutCompletion.findFirst({
                where: { studentId: student.id, workoutDayId: dayId, completedAt: { gte: range.start, lt: range.end } },
            });
            if (!legacy) {
                await tx.workoutCompletion.create({
                    data: { studentId: student.id, workoutDayId: dayId, completedAt },
                });
            }

            return detailed;
        });

        return NextResponse.json({
            success: true,
            data: workoutSession,
        });
    } catch (error) {
        console.error('Error completing workout:', error);
        return NextResponse.json({ success: false, error: 'Erro ao finalizar treino' }, { status: 500 });
    }
}
