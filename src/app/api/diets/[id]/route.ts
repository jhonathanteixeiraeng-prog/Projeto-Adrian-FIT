import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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

        const dietPlan = await prisma.dietPlan.findFirst({
            where: {
                id: params.id,
                student: {
                    personalId: session.user.personalId,
                },
            },
            include: {
                student: {
                    include: {
                        user: {
                            select: { name: true, email: true },
                        },
                        anamnesis: true,
                    },
                },
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
        });

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

// PUT /api/diets/[id] - Update a diet plan
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

        const data = await request.json();
        const { title, calories, protein, carbs, fat, active, meals } = data;

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

        // Prepare meals for creation
        const preparedMeals = meals.map((meal: any, index: number) => ({
            name: meal.name,
            time: meal.time,
            notes: meal.notes,
            order: index,
            foods: JSON.stringify(meal.foods || []), // Serialize foods to JSON string
        }));

        // Update transaction
        const updatedPlan = await prisma.$transaction(async (tx) => {
            // Delete existing meals
            await tx.dietMeal.deleteMany({
                where: { dietPlanId: params.id },
            });

            // Update plan and create new meals
            return await tx.dietPlan.update({
                where: { id: params.id },
                data: {
                    title,
                    calories: typeof calories === 'string' ? parseFloat(calories) : calories,
                    protein: typeof protein === 'string' ? parseFloat(protein) : protein,
                    carbs: typeof carbs === 'string' ? parseFloat(carbs) : carbs,
                    fat: typeof fat === 'string' ? parseFloat(fat) : fat,
                    active,
                    meals: {
                        create: preparedMeals,
                    },
                },
                include: {
                    meals: true,
                },
            });
        });

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
