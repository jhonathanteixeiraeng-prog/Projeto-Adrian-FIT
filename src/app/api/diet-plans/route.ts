import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const mealItemSchema = z.object({
    id: z.string().optional(),
    foodId: z.string().optional(),
    name: z.string(),
    portion: z.string(),
    quantity: z.number().min(0),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
});

const mealSchema = z.object({
    name: z.string().min(1),
    time: z.string(),
    items: z.array(mealItemSchema),
    notes: z.string().optional(),
});

const dietPlanSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    startDate: z.string(),
    endDate: z.string(),
    active: z.boolean().optional(),
    targetCalories: z.number().optional(),
    targetProtein: z.number().optional(),
    targetCarbs: z.number().optional(),
    targetFat: z.number().optional(),
    meals: z.array(mealSchema).optional(),
    saveAsTemplate: z.boolean().optional(),
});

// GET - List diet plans
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('studentId');
        const active = searchParams.get('active');

        const where: any = {};

        if (session.user.role === 'PERSONAL' && session.user.personalId) {
            where.student = {
                personalId: session.user.personalId,
            };
        }

        if (session.user.role === 'STUDENT' && session.user.studentId) {
            where.studentId = session.user.studentId;
        }

        if (studentId) {
            where.studentId = studentId;
        }

        if (active !== null) {
            where.active = active === 'true';
        }

        const dietPlans = await prisma.dietPlan.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const formattedPlans = dietPlans.map(plan => ({
            ...plan,
            meals: plan.meals.map(meal => ({
                ...meal,
                items: JSON.parse(meal.foods),
            }))
        }));

        return NextResponse.json(formattedPlans);
    } catch (error) {
        console.error('Error fetching diet plans:', error);
        return NextResponse.json({ error: 'Erro ao buscar planos' }, { status: 500 });
    }
}

// POST - Create diet plan
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = dietPlanSchema.parse(body);

        // Calculate total macros from meals
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        if (validatedData.meals) {
            validatedData.meals.forEach(meal => {
                meal.items.forEach(item => {
                    totalCalories += item.calories * item.quantity;
                    totalProtein += item.protein * item.quantity;
                    totalCarbs += item.carbs * item.quantity;
                    totalFat += item.fat * item.quantity;
                });
            });
        }

        const dietPlan = await prisma.dietPlan.create({
            data: {
                title: validatedData.title,
                studentId: validatedData.studentId,
                personalId: session.user.personalId!,
                startDate: new Date(validatedData.startDate),
                endDate: new Date(validatedData.endDate),
                active: validatedData.active ?? true,
                version: 1,
                calories: validatedData.targetCalories || Math.round(totalCalories),
                protein: validatedData.targetProtein || Math.round(totalProtein),
                carbs: validatedData.targetCarbs || Math.round(totalCarbs),
                fat: validatedData.targetFat || Math.round(totalFat),
                meals: validatedData.meals ? {
                    create: validatedData.meals.map((meal, mealIndex) => ({
                        name: meal.name,
                        time: meal.time,
                        order: mealIndex,
                        notes: meal.notes,
                        foods: JSON.stringify(meal.items),
                    })),
                } : undefined,
            },
            include: {
                meals: true,
                student: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        // Save as template if requested
        if (validatedData.saveAsTemplate && validatedData.meals) {
            try {
                await prisma.dietTemplate.create({
                    data: {
                        title: validatedData.title,
                        personalId: session.user.personalId!,
                        calories: Math.round(totalCalories),
                        protein: Math.round(totalProtein),
                        carbs: Math.round(totalCarbs),
                        fat: Math.round(totalFat),
                        meals: {
                            create: validatedData.meals.map((meal, index) => ({
                                name: meal.name,
                                time: meal.time,
                                order: index,
                                notes: meal.notes,
                                foods: JSON.stringify(meal.items),
                            })),
                        },
                    },
                });
            } catch (err) {
                console.error('Error saving template:', err);
                // Continue even if template save fails
            }
        }

        // Format response
        const formattedPlan = {
            ...dietPlan,
            meals: dietPlan.meals.map(meal => ({
                ...meal,
                items: JSON.parse(meal.foods),
            }))
        };

        return NextResponse.json(formattedPlan, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating diet plan:', error);
        return NextResponse.json({ error: 'Erro ao criar plano' }, { status: 500 });
    }
}
