import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { normalizeDietMeal } from '@/lib/diet-normalizer';
import { localDateAt, parseOffsetMinutes, studentDayFromQuery } from '@/lib/student-day';
import { dayStreak, nextCheckinLabel, parseLocalDate, workoutsThisWeek } from '@/lib/workout-stats';

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim();
        if (!normalized) return fallback;

        const direct = Number(normalized);
        if (Number.isFinite(direct)) return direct;

        const match = normalized.match(/-?\d+(?:\.\d+)?/);
        if (!match) return fallback;

        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
}

function parsePortionInfo(portion?: string) {
    const raw = String(portion || '100g').replace(',', '.').trim();
    const parenthesisMatch = raw.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
    if (parenthesisMatch) {
        return {
            baseAmount: toNumber(parenthesisMatch[1], 1),
        };
    }

    const baseMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (baseMatch) {
        return {
            baseAmount: toNumber(baseMatch[1], 1),
        };
    }

    return { baseAmount: 1 };
}

function parseQuantityFactor(quantity: unknown, portion?: string) {
    if (typeof quantity === 'number') {
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    }

    if (typeof quantity !== 'string') {
        return 0;
    }

    const input = quantity.replace(',', '.').trim().toLowerCase();
    if (!input) return 0;

    const { baseAmount } = parsePortionInfo(portion);
    const amount = toNumber(input, 0);
    if (amount <= 0) return 0;

    if (input.includes('x')) return amount;

    if (/\b(g|ml)\b/.test(input)) {
        return baseAmount > 0 ? amount / baseAmount : amount;
    }

    if (/\b(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/.test(input)) {
        return amount;
    }

    if (baseAmount >= 20) {
        return amount / baseAmount;
    }

    return amount;
}

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
                personal: {
                    include: {
                        user: {
                            select: { name: true, email: true, avatar: true }
                        }
                    }
                },
                workoutPlans: {
                    where: { active: true },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        workoutDays: {
                            orderBy: { order: 'asc' },
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
                dietPlans: {
                    where: { active: true },
                    include: {
                        meals: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        // 1. Personal Trainer Info
        // Note: personal relation includes user
        const personalUser = student.personal.user;
        const personalInfo = {
            name: personalUser.name,
            brandName: student.personal.brandName || 'Personal Trainer',
            avatar: personalUser.avatar
        };

        // "Today" in the student's calendar (?localDate=&tz=, see student-day); the server's day otherwise.
        const day = studentDayFromQuery(request.nextUrl.searchParams);
        const offset = parseOffsetMinutes(request.nextUrl.searchParams.get('tz') ?? request.nextUrl.searchParams.get('timezoneOffsetMinutes'));
        const onDay = { OR: [{ localDate: day.localDate }, { localDate: null, date: { gte: day.start, lt: day.end } }] };

        // 2. Today's Workout
        const today = (parseLocalDate(day.localDate) ?? new Date()).getUTCDay(); // 0 = Sunday, 1 = Monday...
        const activeWorkoutPlan = student.workoutPlans[0]; // Assuming only one active plan for now
        let todayWorkout = null;

        if (activeWorkoutPlan) {
            const orderedDays = [...activeWorkoutPlan.workoutDays].sort((a, b) => a.order - b.order);
            const dayWorkoutToday = orderedDays.find((d) => d.dayOfWeek === today);

            // Fallback: nearest upcoming day in week, or first day in plan
            const dayWorkoutUpcoming = orderedDays.find((d) => d.dayOfWeek > today);
            const dayWorkout = dayWorkoutToday || dayWorkoutUpcoming || orderedDays[0];

            if (dayWorkout) {
                // An exercise is done when all its sets have a log today.
                const logs = await prisma.setLog.findMany({
                    where: { studentId: student.id, dayId: dayWorkout.id, ...onDay },
                    select: { exerciseId: true, setIndex: true },
                });
                const loggedSets = new Map<string, Set<number>>();
                for (const log of logs) {
                    if (!loggedSets.has(log.exerciseId)) loggedSets.set(log.exerciseId, new Set());
                    loggedSets.get(log.exerciseId)!.add(log.setIndex);
                }
                const isDone = (exerciseId: string, sets: number) =>
                    sets > 0 && Array.from({ length: sets }, (_, index) => index).every((index) => loggedSets.get(exerciseId)?.has(index));

                // Format exercises for frontend
                todayWorkout = {
                    id: dayWorkout.id,
                    name: dayWorkout.name,
                    exercises: dayWorkout.items.map(item => ({
                        id: item.id,
                        name: item.exercise.name,
                        sets: item.sets,
                        reps: item.reps,
                        rest: item.rest,
                        load: item.load,
                        rpe: item.rpe,
                        groupId: item.groupId,
                        completed: isDone(item.exerciseId, item.sets),
                    }))
                };
            }
        }

        // 3. Diet Plan (Active)
        const activeDiet = student.dietPlans[0]; // Assuming only one active plan
        let formattedDiet = null;

        if (activeDiet) {
            const doneMeals = new Set(
                (
                    await prisma.mealCompletion.findMany({
                        where: { studentId: student.id, mealId: { in: activeDiet.meals.map((meal) => meal.id) }, completedAt: { gte: day.start, lt: day.end } },
                        select: { mealId: true },
                    })
                ).map((completion) => completion.mealId)
            );
            const normalizedMeals = activeDiet.meals.map((meal: any) => {
                const foods = typeof meal.foods === 'string' ? JSON.parse(meal.foods) : (meal.foods || []);
                return normalizeDietMeal({ ...meal, foods });
            });

            const formattedMeals = normalizedMeals.map((meal: any) => ({
                ...meal,
                calories: Math.round(meal.foods.reduce((acc: number, food: any) => acc + (food.totalCalories || 0), 0)),
                completed: doneMeals.has(meal.id),
            }));

            formattedDiet = {
                ...activeDiet,
                meals: formattedMeals
            };
        }

        // 4. Stats, counted like the workout history (src/lib/workout-stats.ts).
        const sessions = await prisma.workoutSession.findMany({
            where: { studentId: student.id, completedAt: { gte: new Date(day.start.getTime() - 400 * 24 * 60 * 60 * 1000) } },
            select: { localDate: true },
        });
        const sessionDates = sessions.map((workoutSession) => workoutSession.localDate);
        const lastCheckin = student.checkins[0]?.date ?? null;
        const stats = {
            streak: dayStreak(sessionDates, day.localDate),
            weeklyWorkouts: workoutsThisWeek(sessionDates, day.localDate),
            weeklyGoal: activeWorkoutPlan ? activeWorkoutPlan.workoutDays.filter((workoutDay) => workoutDay.items.length > 0).length : 0,
            nextCheckin: nextCheckinLabel(lastCheckin ? localDateAt(lastCheckin, offset ?? 0) : null, day.localDate),
        };

        return NextResponse.json({
            success: true,
            data: {
                personal: personalInfo,
                workout: todayWorkout,
                diet: formattedDiet,
                stats
            }
        });

    } catch (error) {
        console.error('Error fetching student dashboard:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar dados do dashboard' },
            { status: 500 }
        );
    }
}
