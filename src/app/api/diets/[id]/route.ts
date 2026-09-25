import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
    dietMealInputSchema,
    getDietPlanForPersonal,
    parseDateInput,
    prepareMeals,
    toPositiveInt,
    updateDietPlan,
} from '@/lib/diet-plans';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import { z } from 'zod';

// GET /api/diets/[id] - Get a specific diet plan
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const dietPlan = await getDietPlanForPersonal(params.id, session.user.personalId);

        if (!dietPlan) {
            return NextResponse.json(
                { success: false, error: 'Plano alimentar não encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: dietPlan });
    } catch (error) {
        console.error('Error fetching diet plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar plano alimentar' },
            { status: 500 }
        );
    }
}

const updateSchema = z.object({
    title: z.string().max(300).optional(),
    calories: z.union([z.number(), z.string()]).optional().nullable(),
    protein: z.union([z.number(), z.string()]).optional().nullable(),
    carbs: z.union([z.number(), z.string()]).optional().nullable(),
    fat: z.union([z.number(), z.string()]).optional().nullable(),
    active: z.boolean().optional(),
    notifyStudent: z.boolean().optional(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    meals: z.array(dietMealInputSchema).optional(),
});

/** undefined = campo não enviado (não altera); null = limpar. */
function optionalInt(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    return toPositiveInt(value);
}

// PUT /api/diets/[id] - Update a diet plan (campos ausentes não são alterados)
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const parsed = updateSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' },
                { status: 400 }
            );
        }
        const data = parsed.data;

        if (data.title !== undefined && !data.title.trim()) {
            return NextResponse.json(
                { success: false, error: 'Título é obrigatório' },
                { status: 400 }
            );
        }

        // Verify diet belongs to a student of this personal
        const existingPlan = await prisma.dietPlan.findFirst({
            where: {
                id: params.id,
                student: {
                    personalId: session.user.personalId,
                },
            },
        });

        if (!existingPlan) {
            return NextResponse.json(
                { success: false, error: 'Plano alimentar não encontrado' },
                { status: 404 }
            );
        }

        const startDate = data.startDate === undefined ? undefined : parseDateInput(data.startDate);
        const endDate = data.endDate === undefined ? undefined : parseDateInput(data.endDate);
        const effectiveStart = startDate === undefined ? existingPlan.startDate : startDate;
        const effectiveEnd = endDate === undefined ? existingPlan.endDate : endDate;
        if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
            return NextResponse.json(
                { success: false, error: 'A data de término deve ser posterior à data de início' },
                { status: 400 }
            );
        }

        const prepared = data.meals ? prepareMeals(data.meals) : null;

        const updatedPlan = await updateDietPlan(params.id, existingPlan.studentId, {
            title: data.title?.trim(),
            calories: optionalInt(data.calories),
            protein: optionalInt(data.protein),
            carbs: optionalInt(data.carbs),
            fat: optionalInt(data.fat),
            active: data.active,
            startDate,
            endDate,
            meals: prepared?.meals,
        });

        const transitionedToActive = !existingPlan.active && data.active === true;
        if (transitionedToActive && data.notifyStudent) {
            await notifyStudentAboutPlan({
                studentId: existingPlan.studentId,
                kind: 'diet',
                title: data.title?.trim() || existingPlan.title,
            });
        }

        return NextResponse.json({ success: true, data: updatedPlan });
    } catch (error) {
        console.error('Error updating diet plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar plano alimentar' },
            { status: 500 }
        );
    }
}

// DELETE /api/diets/[id] - Delete a diet plan
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        // Verify diet belongs to a student of this personal
        const dietPlan = await prisma.dietPlan.findFirst({
            where: {
                id: params.id,
                student: {
                    personalId: session.user.personalId,
                },
            },
        });

        if (!dietPlan) {
            return NextResponse.json(
                { success: false, error: 'Plano alimentar não encontrado' },
                { status: 404 }
            );
        }

        // Delete the diet plan (cascade will delete meals and foods)
        await prisma.dietPlan.delete({
            where: { id: params.id },
        });

        return NextResponse.json({
            success: true,
            message: 'Plano alimentar excluído com sucesso',
        });
    } catch (error) {
        console.error('Error deleting diet plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao excluir plano alimentar' },
            { status: 500 }
        );
    }
}
