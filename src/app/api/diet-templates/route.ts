import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { dietTemplateSchema, formatTemplate, prepareMeals, toPositiveInt } from '@/lib/diet-plans';

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

        // Parse JSON foods and normalize legacy formats
        return NextResponse.json({ success: true, data: templates.map(formatTemplate) });
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
        const { meals, totals } = prepareMeals(validatedData.meals);

        const template = await prisma.dietTemplate.create({
            data: {
                title: validatedData.title,
                personalId: session.user.personalId!,
                calories: toPositiveInt(validatedData.calories) ?? Math.round(totals.calories),
                protein: toPositiveInt(validatedData.protein) ?? Math.round(totals.protein),
                carbs: toPositiveInt(validatedData.carbs) ?? Math.round(totals.carbs),
                fat: toPositiveInt(validatedData.fat) ?? Math.round(totals.fat),
                meals: {
                    create: meals.map((meal) => ({
                        name: meal.name,
                        time: meal.time,
                        order: meal.order,
                        notes: meal.notes,
                        foods: meal.foods,
                    })),
                },
            },
            include: {
                meals: { orderBy: { order: 'asc' } },
            },
        });

        return NextResponse.json({ success: true, data: formatTemplate(template) }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar modelo' }, { status: 500 });
    }
}
