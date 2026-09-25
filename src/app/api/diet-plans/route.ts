import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { normalizeDietFood } from '@/lib/diet-normalizer';
import {
    createDietPlanForStudent,
    defaultPlanDates,
    dietMealInputSchema,
    findOwnedStudent,
    parseDateInput,
    prepareMeals,
    safeParseFoods,
    toPositiveInt,
} from '@/lib/diet-plans';

const dietPlanSchema = z.object({
    title: z.string().trim().min(1, 'Título é obrigatório').max(300),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    // Opcionais: sem datas o plano vale de hoje até +30 dias.
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    active: z.boolean().optional(),
    notifyStudent: z.boolean().optional(),
    targetCalories: z.number().optional().nullable(),
    targetProtein: z.number().optional().nullable(),
    targetCarbs: z.number().optional().nullable(),
    targetFat: z.number().optional().nullable(),
    meals: z.array(dietMealInputSchema).optional(),
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

        // Only a trainer (their students' plans) or a student with a profile (their own plans) may list plans;
        // anything else (e.g. a self-registered account without a student profile) would get an unfiltered query.
        const isPersonal = session.user.role === 'PERSONAL' && Boolean(session.user.personalId);
        const isStudent = session.user.role === 'STUDENT' && Boolean(session.user.studentId);
        if (!isPersonal && !isStudent) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const where: any = {};

        if (session.user.role === 'PERSONAL' && session.user.personalId) {
            where.student = {
                personalId: session.user.personalId,
            };
        }

        if (session.user.role === 'STUDENT' && session.user.studentId) {
            where.studentId = session.user.studentId;
        }

        if (studentId && session.user.role === 'PERSONAL') {
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
                items: safeParseFoods(meal.foods).map((item) => normalizeDietFood(item)),
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
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const personalId = session.user.personalId;

        const body = await request.json();
        const validatedData = dietPlanSchema.parse(body);

        const student = await findOwnedStudent(validatedData.studentId, personalId);
        if (!student) {
            return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
        }

        const defaults = defaultPlanDates();
        const startDate = parseDateInput(validatedData.startDate) ?? defaults.startDate;
        const endDate = parseDateInput(validatedData.endDate) ?? defaults.endDate;
        if (endDate < startDate) {
            return NextResponse.json({ error: 'A data de término deve ser posterior à data de início' }, { status: 400 });
        }

        const { meals: preparedMeals, totals } = prepareMeals(validatedData.meals);

        const dietPlan = await createDietPlanForStudent({
            personalId,
            studentId: validatedData.studentId,
            title: validatedData.title,
            startDate,
            endDate,
            active: validatedData.active ?? true,
            notifyStudent: validatedData.notifyStudent,
            calories: toPositiveInt(validatedData.targetCalories) ?? Math.round(totals.calories),
            protein: toPositiveInt(validatedData.targetProtein) ?? Math.round(totals.protein),
            carbs: toPositiveInt(validatedData.targetCarbs) ?? Math.round(totals.carbs),
            fat: toPositiveInt(validatedData.targetFat) ?? Math.round(totals.fat),
            meals: preparedMeals,
        });

        // Save as template if requested
        if (validatedData.saveAsTemplate && preparedMeals.length > 0) {
            try {
                await prisma.dietTemplate.create({
                    data: {
                        title: validatedData.title,
                        personalId,
                        calories: Math.round(totals.calories),
                        protein: Math.round(totals.protein),
                        carbs: Math.round(totals.carbs),
                        fat: Math.round(totals.fat),
                        meals: {
                            create: preparedMeals.map((meal) => ({
                                name: meal.name,
                                time: meal.time,
                                order: meal.order,
                                notes: meal.notes,
                                foods: meal.foods,
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
            success: true,
            meals: dietPlan.meals.map(meal => ({
                ...meal,
                items: safeParseFoods(meal.foods).map((item) => normalizeDietFood(item)),
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
