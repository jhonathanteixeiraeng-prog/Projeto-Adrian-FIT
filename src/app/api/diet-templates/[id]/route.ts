import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { dietTemplateSchema, formatTemplate, prepareMeals, toPositiveInt } from '@/lib/diet-plans';

async function getPersonalId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.personalId || session.user.role !== 'PERSONAL') return null;
    return session.user.personalId;
}

// GET /api/diet-templates/[id] - Modelo com refeições e alimentos normalizados.
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const template = await prisma.dietTemplate.findFirst({
            where: { id: params.id, personalId },
            include: { meals: { orderBy: { order: 'asc' } } },
        });
        if (!template) {
            return NextResponse.json({ success: false, error: 'Modelo não encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: formatTemplate(template) });
    } catch (error) {
        console.error('Error fetching diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar modelo alimentar' }, { status: 500 });
    }
}

// PUT /api/diet-templates/[id] - Atualiza título, metas e refeições do modelo.
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const data = dietTemplateSchema.parse(await request.json());

        const existing = await prisma.dietTemplate.findFirst({
            where: { id: params.id, personalId },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Modelo não encontrado' }, { status: 404 });
        }

        const { meals, totals } = prepareMeals(data.meals);
        const template = await prisma.$transaction(async (tx) => {
            await tx.dietTemplateMeal.deleteMany({ where: { templateId: params.id } });
            return tx.dietTemplate.update({
                where: { id: params.id },
                data: {
                    title: data.title,
                    calories: toPositiveInt(data.calories) ?? Math.round(totals.calories),
                    protein: toPositiveInt(data.protein) ?? Math.round(totals.protein),
                    carbs: toPositiveInt(data.carbs) ?? Math.round(totals.carbs),
                    fat: toPositiveInt(data.fat) ?? Math.round(totals.fat),
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
                include: { meals: { orderBy: { order: 'asc' } } },
            });
        });

        return NextResponse.json({ success: true, data: formatTemplate(template) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error updating diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao atualizar modelo alimentar' }, { status: 500 });
    }
}

// DELETE /api/diet-templates/[id] - Remove a model owned by the signed-in personal.
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const template = await prisma.dietTemplate.findFirst({
            where: { id: params.id, personalId },
            select: { id: true },
        });

        if (!template) {
            return NextResponse.json({ success: false, error: 'Modelo não encontrado' }, { status: 404 });
        }

        await prisma.dietTemplate.delete({ where: { id: template.id } });
        return NextResponse.json({ success: true, message: 'Modelo alimentar excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting diet template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao excluir modelo alimentar' }, { status: 500 });
    }
}
