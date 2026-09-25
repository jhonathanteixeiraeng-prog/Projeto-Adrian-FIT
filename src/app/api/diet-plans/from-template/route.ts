import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { normalizeDietFood, withUnambiguousQuantity } from '@/lib/diet-normalizer';
import {
    createDietPlanForStudent,
    defaultPlanDates,
    findOwnedStudent,
    parseDateInput,
    safeParseFoods,
} from '@/lib/diet-plans';

const cloneTemplateSchema = z.object({
    templateId: z.string().min(1, 'Template ID é obrigatório'),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    // Sem meta, o modelo é aplicado sem reescalar as quantidades.
    targetCalories: z.number().int().min(800).max(6000).optional().nullable(),
    title: z.string().trim().min(1).max(300).optional(),
    active: z.boolean().optional(),
    notifyStudent: z.boolean().optional(),
});

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const personalId = session.user.personalId;

        const body = await request.json();
        const validatedData = cloneTemplateSchema.parse(body);

        const [template, student] = await Promise.all([
            prisma.dietTemplate.findUnique({
                where: { id: validatedData.templateId },
                include: { meals: { orderBy: { order: 'asc' } } },
            }),
            findOwnedStudent(validatedData.studentId, personalId),
        ]);

        if (!template) {
            return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 });
        }

        if (template.personalId !== personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        if (!student) {
            return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 });
        }

        const defaults = defaultPlanDates();
        const startDate = parseDateInput(validatedData.startDate) ?? defaults.startDate;
        const endDate = parseDateInput(validatedData.endDate) ?? defaults.endDate;
        if (endDate < startDate) {
            return NextResponse.json({ error: 'A data de término deve ser posterior à data de início' }, { status: 400 });
        }

        const normalizedMeals = template.meals.map((meal) => ({
            meal,
            foods: safeParseFoods(meal.foods).map(normalizeDietFood),
        }));
        const baseCalories = normalizedMeals.reduce(
            (total, entry) => total + entry.foods.reduce((sum, food) => sum + food.totalCalories, 0),
            0
        );

        // Clients prefill the target with the template's saved calories; an unchanged value means "keep the
        // template's quantities", not "rescale to that number" (the food sum usually differs from the saved target).
        const requestedTarget = validatedData.targetCalories ?? null;
        const targetCalories =
            requestedTarget !== null && template.calories && Math.round(requestedTarget) === Math.round(template.calories)
                ? null
                : requestedTarget;
        if (targetCalories !== null && baseCalories <= 0) {
            return NextResponse.json({ error: 'O modelo não possui calorias válidas para recalcular' }, { status: 400 });
        }

        const scale = targetCalories !== null ? targetCalories / baseCalories : 1;
        let calories = 0;
        let protein = 0;
        let carbs = 0;
        let fat = 0;
        const scaledMeals = normalizedMeals.map(({ meal, foods }, index) => {
            const scaledFoods = foods.map((food) => {
                const quantity = round2(food.quantity * scale);
                // Macros por porção já estão normalizados: só recalculamos os totais (sem reinterpretar a quantidade).
                const scaled = withUnambiguousQuantity({
                    ...food,
                    quantity,
                    totalCalories: round2(food.calories * quantity),
                    totalProtein: round2(food.protein * quantity),
                    totalCarbs: round2(food.carbs * quantity),
                    totalFat: round2(food.fat * quantity),
                });
                calories += scaled.totalCalories;
                protein += scaled.totalProtein;
                carbs += scaled.totalCarbs;
                fat += scaled.totalFat;
                return scaled;
            });
            return {
                name: meal.name,
                time: meal.time,
                order: index,
                notes: meal.notes,
                foods: JSON.stringify(scaledFoods),
            };
        });

        const dietPlan = await createDietPlanForStudent({
            personalId,
            studentId: validatedData.studentId,
            title: validatedData.title || template.title,
            startDate,
            endDate,
            active: validatedData.active ?? true,
            notifyStudent: validatedData.notifyStudent,
            calories: targetCalories ?? (template.calories || Math.round(calories)),
            protein: targetCalories !== null ? Math.round(protein) : (template.protein || Math.round(protein)),
            carbs: targetCalories !== null ? Math.round(carbs) : (template.carbs || Math.round(carbs)),
            fat: targetCalories !== null ? Math.round(fat) : (template.fat || Math.round(fat)),
            meals: scaledMeals,
        });

        return NextResponse.json(
            {
                ...dietPlan,
                success: true,
                scaling: {
                    baseCalories: Math.round(baseCalories),
                    targetCalories: targetCalories ?? Math.round(calories),
                    factor: scale,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error cloning diet template:', error);
        return NextResponse.json({ error: 'Erro ao criar plano a partir do modelo' }, { status: 500 });
    }
}
