import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { normalizeDietFood } from '@/lib/diet-normalizer';

const cloneTemplateSchema = z.object({
    templateId: z.string().min(1, 'Template ID é obrigatório'),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    startDate: z.string(),
    endDate: z.string(),
    targetCalories: z.number().int().min(800).max(6000),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = cloneTemplateSchema.parse(body);

        // Fetch template
        const template = await prisma.dietTemplate.findUnique({
            where: { id: validatedData.templateId },
            include: { meals: true },
        });

        if (!template) {
            return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 });
        }

        if (template.personalId !== session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        const normalizedMeals = template.meals.map((meal) => {
            const rawFoods = JSON.parse(meal.foods || '[]');
            return { meal, foods: Array.isArray(rawFoods) ? rawFoods.map(normalizeDietFood) : [] };
        });
        const baseCalories = normalizedMeals.reduce(
            (total, entry) => total + entry.foods.reduce((sum, food) => sum + food.totalCalories, 0),
            0
        );
        if (baseCalories <= 0) {
            return NextResponse.json({ error: 'O modelo não possui calorias válidas para recalcular' }, { status: 400 });
        }

        const scale = validatedData.targetCalories / baseCalories;
        let protein = 0;
        let carbs = 0;
        let fat = 0;
        const scaledMeals = normalizedMeals.map(({ meal, foods }) => {
            const scaledFoods = foods.map((food) => {
                const quantity = Math.round(food.quantity * scale * 100) / 100;
                const scaled = normalizeDietFood({ ...food, quantity });
                protein += scaled.totalProtein;
                carbs += scaled.totalCarbs;
                fat += scaled.totalFat;
                return scaled;
            });
            return { meal, foods: scaledFoods };
        });

        // Create Diet Plan from Template with quantities scaled to the prescription.
        const dietPlan = await prisma.dietPlan.create({
            data: {
                title: template.title,
                studentId: validatedData.studentId,
                personalId: session.user.personalId!,
                startDate: new Date(validatedData.startDate),
                endDate: new Date(validatedData.endDate),
                active: true,
                version: 1,
                calories: validatedData.targetCalories,
                protein: Math.round(protein),
                carbs: Math.round(carbs),
                fat: Math.round(fat),
                meals: {
                    create: scaledMeals.map(({ meal, foods }) => ({
                        name: meal.name,
                        time: meal.time,
                        order: meal.order,
                        notes: meal.notes,
                        foods: JSON.stringify(foods),
                    })),
                },
            },
            include: {
                meals: true,
            },
        });

        return NextResponse.json({ ...dietPlan, scaling: { baseCalories: Math.round(baseCalories), targetCalories: validatedData.targetCalories, factor: scale } }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error cloning diet template:', error);
        return NextResponse.json({ error: 'Erro ao criar plano a partir do modelo' }, { status: 500 });
    }
}
