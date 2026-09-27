import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { type StudentDay, isLocalDate, studentDay, studentDayFromQuery } from '@/lib/student-day';

/**
 * Set logs of the student's workout, one per set and day (audit A13). The day is the student's own
 * (`localDate` + offset, see src/lib/student-day.ts; audit A07). Older app versions send only
 * `sessionDate` (POST) or nothing (GET): their day is the server's, as before.
 */

const MAX_WEIGHT_KG = 1000;
const MAX_REPS = 1000;

async function findStudent(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
}

/** This day's logs: by localDate, and logs saved before localDate existed by their time. */
const onDay = (day: StudentDay) => ({
    OR: [{ localDate: day.localDate }, { localDate: null, date: { gte: day.start, lt: day.end } }],
});

// GET /api/student/set-logs?dayId=...[&localDate=YYYY-MM-DD&tz=-240] - The day's logs, previous session and PRs
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await findStudent(session.user.id);
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const dayId = request.nextUrl.searchParams.get('dayId');
        if (!dayId) {
            return NextResponse.json({ success: false, error: 'dayId é obrigatório' }, { status: 400 });
        }

        const day = studentDayFromQuery(request.nextUrl.searchParams);

        const todayLogs = await prisma.setLog.findMany({
            where: { studentId: student.id, dayId, ...onDay(day) },
            select: { exerciseId: true, setIndex: true, weight: true, reps: true },
        });

        // Sessão anterior: o registro mais recente deste dia de treino antes de hoje, e os do mesmo dia dele
        const lastBefore = await prisma.setLog.findFirst({
            where: { studentId: student.id, dayId, OR: [{ localDate: { lt: day.localDate } }, { localDate: null, date: { lt: day.start } }] },
            orderBy: { date: 'desc' },
            select: { date: true, localDate: true },
        });

        let previousLogs: { exerciseId: string; setIndex: number; weight: number; reps: number }[] = [];
        if (lastBefore) {
            let sameDay: Prisma.SetLogWhereInput = { localDate: lastBefore.localDate };
            if (!lastBefore.localDate) {
                // Saved before localDate existed: the server's day of that log, as before.
                const start = new Date(lastBefore.date);
                start.setHours(0, 0, 0, 0);
                sameDay = { localDate: null, date: { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) } };
            }
            previousLogs = await prisma.setLog.findMany({
                where: { studentId: student.id, dayId, ...sameDay },
                select: { exerciseId: true, setIndex: true, weight: true, reps: true },
            });
        }

        // Recorde (maior carga já registrada) por exercício, em qualquer treino
        const prGroups = await prisma.setLog.groupBy({
            by: ['exerciseId'],
            where: { studentId: student.id, weight: { gt: 0 } },
            _max: { weight: true },
        });
        const prs = prGroups.map((group) => ({
            exerciseId: group.exerciseId,
            weight: group._max.weight ?? 0,
        }));

        return NextResponse.json({
            success: true,
            data: { today: todayLogs, previous: previousLogs, prs },
        });
    } catch (error) {
        console.error('Error fetching set logs:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar registros' }, { status: 500 });
    }
}

/** A number within [0, max], or null when it isn't one (strings with a comma decimal are accepted). */
function measure(value: unknown, max: number): number | null {
    if (value === undefined || value === null || value === '') return 0;
    const number = typeof value === 'string' ? Number(value.trim().replace(',', '.')) : Number(value);
    return Number.isFinite(number) && number >= 0 && number <= max ? number : null;
}

// POST /api/student/set-logs - Saves (or with `remove`, deletes) the log of one set of the day
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await findStudent(session.user.id);
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }
        const { exerciseId, dayId, setIndex, remove } = body;

        if (typeof exerciseId !== 'string' || !exerciseId || typeof dayId !== 'string' || !dayId || !Number.isInteger(setIndex)) {
            return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });
        }
        const index = setIndex as number;

        // Only sets of the student's current plan: the day must be theirs and the exercise in it.
        const workoutDay = await prisma.workoutDay.findFirst({
            where: { id: dayId, plan: { studentId: student.id, active: true } },
            select: { items: { where: { exerciseId }, select: { sets: true } } },
        });
        if (!workoutDay) {
            return NextResponse.json({ success: false, error: 'Treino não encontrado' }, { status: 404 });
        }
        const prescribedSets = Math.max(0, ...workoutDay.items.map((item) => item.sets));
        if (workoutDay.items.length === 0 || index < 0 || index >= prescribedSets) {
            return NextResponse.json({ success: false, error: 'Série fora da ficha' }, { status: 400 });
        }

        const weight = measure(body.weight, MAX_WEIGHT_KG);
        const reps = measure(body.reps, MAX_REPS);
        if (weight === null || reps === null) {
            return NextResponse.json({ success: false, error: 'Carga ou repetições inválidas' }, { status: 400 });
        }

        // The app's older builds send the session's date as `sessionDate`.
        const day = studentDay({
            localDate: isLocalDate(body.localDate) ? body.localDate : body.sessionDate,
            timezoneOffsetMinutes: body.timezoneOffsetMinutes,
        });
        const key = { studentId: student.id, dayId, exerciseId, setIndex: index, localDate: day.localDate };

        const workoutSession = await prisma.workoutSession.findUnique({
            where: { studentId_workoutDayId_localDate: { studentId: student.id, workoutDayId: dayId, localDate: day.localDate } },
            select: { id: true },
        });

        const refreshSessionVolume = async (sessionId: string) => {
            const sessionLogs = await prisma.setLog.findMany({
                where: { sessionId },
                select: { weight: true, reps: true },
            });
            const totalVolume = sessionLogs.reduce(
                (sum, item) => sum + Math.max(0, item.weight) * Math.max(0, item.reps),
                0
            );
            await prisma.workoutSession.update({ where: { id: sessionId }, data: { totalVolume } });
        };

        // A log of this set saved today before localDate existed.
        const legacy = await prisma.setLog.findFirst({
            where: { studentId: student.id, dayId, exerciseId, setIndex: index, localDate: null, date: { gte: day.start, lt: day.end } },
            select: { id: true, sessionId: true },
        });

        if (remove) {
            const removed = await prisma.setLog.findMany({
                where: { studentId: student.id, dayId, exerciseId, setIndex: index, ...onDay(day) },
                select: { id: true, sessionId: true },
            });
            if (removed.length > 0) await prisma.setLog.deleteMany({ where: { id: { in: removed.map((log) => log.id) } } });
            const affectedSessionId = removed.find((log) => log.sessionId)?.sessionId ?? workoutSession?.id;
            if (affectedSessionId) await refreshSessionVolume(affectedSessionId);
            return NextResponse.json({ success: true, data: { removed: true } });
        }

        const values = { weight, reps: Math.round(reps), ...(workoutSession ? { sessionId: workoutSession.id } : {}) };
        let log: { id: string; sessionId: string | null } | null = null;
        if (legacy) {
            try {
                log = await prisma.setLog.update({ where: { id: legacy.id }, data: { ...values, localDate: day.localDate } });
            } catch (error) {
                // The day already has a keyed log of this set (saved after the deploy): keep that one.
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
                await prisma.setLog.delete({ where: { id: legacy.id } });
            }
        }
        if (!log) {
            try {
                // One statement on Postgres (INSERT ... ON CONFLICT): a repeated or concurrent save updates the same row.
                log = await prisma.setLog.upsert({
                    where: { studentId_dayId_exerciseId_setIndex_localDate: key },
                    create: { ...key, ...values, date: new Date() },
                    update: values,
                });
            } catch (error) {
                // The other request created it between our read and write: update it.
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
                log = await prisma.setLog.update({ where: { studentId_dayId_exerciseId_setIndex_localDate: key }, data: values });
            }
        }

        if (log.sessionId) await refreshSessionVolume(log.sessionId);

        return NextResponse.json({ success: true, data: { id: log.id } });
    } catch (error) {
        console.error('Error saving set log:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar registro' }, { status: 500 });
    }
}
