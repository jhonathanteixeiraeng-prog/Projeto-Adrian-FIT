import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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
                    include: {
                        workoutDays: {
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

        // 2. Today's Workout
        const today = new Date().getDay(); // 0 = Sunday, 1 = Monday...
        const activeWorkoutPlan = student.workoutPlans[0]; // Assuming only one active plan for now
        let todayWorkout = null;

        if (activeWorkoutPlan) {
            // Find workout day matching today's day of week
            const dayWorkout = activeWorkoutPlan.workoutDays.find(d => d.dayOfWeek === today);

            if (dayWorkout) {
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
                        completed: false // TODO: Check completions
                    }))
                };
            }
        }

        // 3. Diet Plan (Active)
        const activeDiet = student.dietPlans[0]; // Assuming only one active plan
        let formattedDiet = null;

        if (activeDiet) {
            const formattedMeals = activeDiet.meals.map((meal: any) => {
                const foods = typeof meal.foods === 'string' ? JSON.parse(meal.foods) : (meal.foods || []);
                const totalCalories = (foods || []).reduce((acc: number, food: any) => {
                    const factor = parseQuantityFactor(food?.quantity, food?.portion);
                    return acc + (toNumber(food?.calories, 0) * factor);
                }, 0);

                return {
                    ...meal,
                    foods,
                    calories: Math.round(totalCalories),
                    completed: false // TODO: Check completions
                };
            });

            formattedDiet = {
                ...activeDiet,
                meals: formattedMeals
            };
        }

        // 4. Stats
        const stats = {
            streak: 0, // Placeholder
            weeklyWorkouts: 0, // Placeholder
            weeklyGoal: 5, // Placeholder
            nextCheckin: 'Domingo', // Placeholder
        };

        // If a checkin exists, maybe update stats?
        if (student.checkins.length > 0) {
            // ... checkin logic
        }

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
