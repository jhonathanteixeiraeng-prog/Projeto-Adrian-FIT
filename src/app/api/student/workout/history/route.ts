import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type SessionWithLogs = Awaited<ReturnType<typeof loadSessions>>[number];

function parseLocalDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function weekStart(date: Date) {
    const result = new Date(date);
    const weekday = result.getUTCDay();
    result.setUTCDate(result.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
    return result;
}

function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function weeklyStreak(localDates: string[], weeklyGoal: number, todayKey: string) {
    const today = parseLocalDate(todayKey) ?? new Date();
    const counts = new Map<string, Set<string>>();
    for (const localDate of localDates) {
        const date = parseLocalDate(localDate);
        if (!date) continue;
        const key = dateKey(weekStart(date));
        if (!counts.has(key)) counts.set(key, new Set());
        counts.get(key)!.add(localDate);
    }

    const goal = Math.max(weeklyGoal, 1);
    let cursor = weekStart(today);
    if ((counts.get(dateKey(cursor))?.size ?? 0) < goal) cursor = addDays(cursor, -7);

    let streak = 0;
    while ((counts.get(dateKey(cursor))?.size ?? 0) >= goal) {
        streak += 1;
        cursor = addDays(cursor, -7);
    }
    return streak;
}

async function resolveStudent(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;

    if (session.user.role === 'STUDENT') {
        return prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    }

    const studentId = request.nextUrl.searchParams.get('studentId');
    if (session.user.role !== 'PERSONAL' || !studentId) return null;
    return prisma.student.findFirst({
        where: { id: studentId, personal: { userId: session.user.id } },
        select: { id: true },
    });
}

function loadSessions(studentId: string) {
    return prisma.workoutSession.findMany({
        where: { studentId },
        orderBy: { completedAt: 'desc' },
        take: 60,
        include: {
            setLogs: {
                orderBy: [{ exerciseId: 'asc' }, { setIndex: 'asc' }],
                include: { exercise: { select: { id: true, name: true, muscleGroup: true } } },
            },
        },
    });
}

function serializeSession(session: SessionWithLogs) {
    const exercises = new Map<string, {
        exerciseId: string;
        name: string;
        muscleGroup: string;
        bestWeight: number;
        totalVolume: number;
        sets: { setIndex: number; weight: number; reps: number; volume: number }[];
    }>();

    for (const log of session.setLogs) {
        const current = exercises.get(log.exerciseId) ?? {
            exerciseId: log.exerciseId,
            name: log.exercise.name,
            muscleGroup: log.exercise.muscleGroup,
            bestWeight: 0,
            totalVolume: 0,
            sets: [],
        };
        const volume = Math.max(0, log.weight) * Math.max(0, log.reps);
        current.bestWeight = Math.max(current.bestWeight, log.weight);
        current.totalVolume += volume;
        current.sets.push({ setIndex: log.setIndex, weight: log.weight, reps: log.reps, volume });
        exercises.set(log.exerciseId, current);
    }

    return {
        id: session.id,
        workoutDayId: session.workoutDayId,
        dayName: session.dayName,
        localDate: session.localDate,
        status: session.status,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        completedSets: session.completedSets,
        totalSets: session.totalSets,
        percentage: session.percentage,
        durationSeconds: session.durationSeconds,
        totalVolume: session.totalVolume,
        activeEnergyKilocalories: session.activeEnergyKilocalories,
        averageHeartRateBPM: session.averageHeartRateBPM,
        maxHeartRateBPM: session.maxHeartRateBPM,
        healthWorkoutUUID: session.healthWorkoutUUID,
        legacy: false,
        exercises: Array.from(exercises.values()),
    };
}

export async function GET(request: NextRequest) {
    try {
        const student = await resolveStudent(request);
        if (!student) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const today = request.nextUrl.searchParams.get('today') ?? new Date().toISOString().slice(0, 10);
        const [sessions, legacyCompletions, allLogs, weeklyGoal] = await Promise.all([
            loadSessions(student.id),
            prisma.workoutCompletion.findMany({
                where: { studentId: student.id },
                orderBy: { completedAt: 'desc' },
                take: 100,
                include: { workoutDay: { select: { id: true, name: true } } },
            }),
            prisma.setLog.findMany({
                where: { studentId: student.id },
                orderBy: { date: 'asc' },
                take: 5000,
                include: {
                    exercise: { select: { id: true, name: true, muscleGroup: true } },
                    session: { select: { localDate: true } },
                },
            }),
            prisma.workoutDay.count({
                where: { plan: { studentId: student.id, active: true }, items: { some: {} } },
            }),
        ]);

        const detailed = sessions.map(serializeSession);
        const detailedKeys = new Set(detailed.map((session) => `${session.workoutDayId}:${session.localDate}`));
        const legacy = legacyCompletions
            .filter((completion) => !detailedKeys.has(`${completion.workoutDayId}:${completion.completedAt.toISOString().slice(0, 10)}`))
            .map((completion) => ({
                id: `legacy-${completion.id}`,
                workoutDayId: completion.workoutDayId,
                dayName: completion.workoutDay.name,
                localDate: completion.completedAt.toISOString().slice(0, 10),
                status: 'COMPLETED',
                startedAt: completion.completedAt,
                completedAt: completion.completedAt,
                completedSets: 0,
                totalSets: 0,
                percentage: 100,
                durationSeconds: 0,
                totalVolume: 0,
                activeEnergyKilocalories: null,
                averageHeartRateBPM: null,
                maxHeartRateBPM: null,
                healthWorkoutUUID: null,
                legacy: true,
                exercises: [],
            }));

        const combined = [...detailed, ...legacy]
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            .slice(0, 60);

        const exerciseGroups = new Map<string, {
            exerciseId: string;
            name: string;
            muscleGroup: string;
            totalSets: number;
            totalVolume: number;
            days: Map<string, { bestWeight: number; volume: number }>;
        }>();

        for (const log of allLogs) {
            const group = exerciseGroups.get(log.exerciseId) ?? {
                exerciseId: log.exerciseId,
                name: log.exercise.name,
                muscleGroup: log.exercise.muscleGroup,
                totalSets: 0,
                totalVolume: 0,
                days: new Map(),
            };
            const localDate = log.session?.localDate ?? log.date.toISOString().slice(0, 10);
            const volume = Math.max(0, log.weight) * Math.max(0, log.reps);
            const day = group.days.get(localDate) ?? { bestWeight: 0, volume: 0 };
            day.bestWeight = Math.max(day.bestWeight, log.weight);
            day.volume += volume;
            group.days.set(localDate, day);
            group.totalSets += 1;
            group.totalVolume += volume;
            exerciseGroups.set(log.exerciseId, group);
        }

        const exerciseProgress = Array.from(exerciseGroups.values())
            .map((group) => {
                const points = Array.from(group.days.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([localDate, value]) => ({ localDate, ...value }));
                const weightedPoints = points.filter((point) => point.bestWeight > 0);
                const firstWeight = weightedPoints[0]?.bestWeight ?? 0;
                const latestWeight = weightedPoints.at(-1)?.bestWeight ?? 0;
                const changePercentage = firstWeight > 0
                    ? Math.round(((latestWeight - firstWeight) / firstWeight) * 100)
                    : 0;
                return {
                    exerciseId: group.exerciseId,
                    name: group.name,
                    muscleGroup: group.muscleGroup,
                    bestWeight: Math.max(0, ...points.map((point) => point.bestWeight)),
                    firstWeight,
                    latestWeight,
                    changePercentage,
                    totalSets: group.totalSets,
                    totalVolume: group.totalVolume,
                    points: points.slice(-12),
                };
            })
            .sort((a, b) => b.totalSets - a.totalSets);

        const currentWeek = weekStart(parseLocalDate(today) ?? new Date());
        const nextWeek = addDays(currentWeek, 7);
        const workoutsThisWeek = combined.filter((session) => {
            const date = parseLocalDate(session.localDate);
            return date && date >= currentWeek && date < nextWeek;
        }).length;
        const totalVolume = detailed.reduce((sum, session) => sum + session.totalVolume, 0);
        const averageDurationSeconds = detailed.length > 0
            ? Math.round(detailed.reduce((sum, session) => sum + session.durationSeconds, 0) / detailed.length)
            : 0;
        const averageCompletionPercentage = detailed.length > 0
            ? Math.round(detailed.reduce((sum, session) => sum + session.percentage, 0) / detailed.length)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    workoutsThisWeek,
                    totalWorkouts: combined.length,
                    weeklyGoal,
                    weeklyStreak: weeklyStreak(combined.map((session) => session.localDate), weeklyGoal, today),
                    totalVolume,
                    averageDurationSeconds,
                    averageCompletionPercentage,
                },
                sessions: combined,
                exerciseProgress,
            },
        });
    } catch (error) {
        console.error('Error fetching workout history:', error);
        return NextResponse.json({ success: false, error: 'Erro ao carregar histórico de treinos' }, { status: 500 });
    }
}
