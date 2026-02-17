import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        // Find the active diet plan for the logged-in student
        // We need to find the student record first, or assume the user is a student
        // The session.user.id is the User ID. DietPlan is linked to Student, which is linked to User.

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const dietPlan = await prisma.dietPlan.findFirst({
            where: {
                studentId: student.id,
                active: true, // Only fetch the active plan
            },
            include: {
                meals: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        // If no active plan, return empty or specific code? 
        // For now, let's return null data

        // We need to parse the foods if they are stored as JSON strings in the DB, 
        // OR if they are a relation. 
        // Based on `src/app/api/diets/[id]/route.ts`:
        // It creates meals with `foods: JSON.stringify(meal.foods || [])`.
        // So `DietMeal` likely has a `foods` string field.
        // We should parse it before returning to frontend for consistency with the mock data structure.

        if (dietPlan) {
            // Need to cast dietPlan or meals to any because Prisma types might be tricky with the JSON parsing transform
            const planWithMeals = dietPlan as any;

            const formattedMeals = planWithMeals.meals.map((meal: any) => ({
                ...meal,
                foods: typeof meal.foods === 'string' ? JSON.parse(meal.foods) : meal.foods
            }));

            return NextResponse.json({
                success: true,
                data: { ...dietPlan, meals: formattedMeals }
            });
        }

        return NextResponse.json({ success: true, data: null });

    } catch (error) {
        console.error('Error fetching student diet:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar dieta' },
            { status: 500 }
        );
    }
}
