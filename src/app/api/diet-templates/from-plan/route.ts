import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
    planId: z.string().min(1, 'Plano é obrigatório'),
    title: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validated = schema.parse(body);

        const plan = await prisma.dietPlan.findUnique({
            where: { id: validated.planId },
            include: {
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!plan || plan.personalId !== session.user.personalId) {
            return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
        }

        if (!plan.meals.length) {
            return NextResponse.json(
                { success: false, error: 'Plano sem refeições não pode ser copiado' },
                { status: 400 }
            );
        }

        const template = await prisma.dietTemplate.create({
            data: {
                personalId: session.user.personalId!,
                title: validated.title || plan.title,
                calories: plan.calories,
                protein: plan.protein,
                carbs: plan.carbs,
                fat: plan.fat,
                meals: {
                    create: plan.meals.map((meal, index) => ({
                        name: meal.name,
                        time: meal.time,
                        notes: meal.notes,
                        order: index,
                        foods: meal.foods, // copy JSON exactly as saved in the plan
                    })),
                },
            },
            include: {
                meals: true,
            },
        });

        return NextResponse.json({ success: true, data: template }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error copying diet plan to template:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao copiar dieta para biblioteca' },
            { status: 500 }
        );
    }
}

