import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const foodItemSchema = z.object({
    id: z.string().optional(),
    foodId: z.string().optional(),
    name: z.string(),
    portion: z.string(),
    quantity: z.number(),
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
});

const mealSchema = z.object({
    name: z.string().min(1),
    time: z.string(),
    items: z.array(foodItemSchema),
    notes: z.string().optional(),
});

const dietTemplateSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    meals: z.array(mealSchema),
});

// GET - List diet templates
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const templates = await prisma.dietTemplate.findMany({
            where: {
                personalId: session.user.personalId!,
            },
            include: {
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Parse JSON foods
        const formattedTemplates = templates.map(template => ({
            ...template,
            meals: template.meals.map(meal => ({
                ...meal,
                items: JSON.parse(meal.foods),
            })),
        }));

        return NextResponse.json({ success: true, data: formattedTemplates });
    } catch (error) {
        console.error('Error fetching diet templates:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar modelos' }, { status: 500 });
    }
}

// POST - Create diet template
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = dietTemplateSchema.parse(body);

        // Calculate totals
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        validatedData.meals.forEach(meal => {
            meal.items.forEach(item => {
                totalCalories += item.calories * item.quantity;
                totalProtein += item.protein * item.quantity;
                totalCarbs += item.carbs * item.quantity;
                totalFat += item.fat * item.quantity;
            });
        });

        const template = await prisma.dietTemplate.create({
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
            include: {
                meals: true,
            },
        });

        // Format return
        const formattedTemplate = {
            ...template,
            meals: template.meals.map(meal => ({
                ...meal,
                items: JSON.parse(meal.foods),
            })),
        };

        return NextResponse.json({ success: true, data: formattedTemplate }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar modelo' }, { status: 500 });
    }
}
