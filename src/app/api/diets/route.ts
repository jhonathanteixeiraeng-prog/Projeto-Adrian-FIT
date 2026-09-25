import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/diets - List all diet plans for personal's students (leve: sem os alimentos)
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const personalId = session.user.personalId;
        const studentId = request.nextUrl.searchParams.get('studentId');

        // Get all diet plans for students of this personal
        const dietPlans = await prisma.dietPlan.findMany({
            where: {
                student: {
                    personalId,
                },
                ...(studentId ? { studentId } : {}),
            },
            include: {
                student: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                                avatar: true,
                            },
                        },
                    },
                },
                meals: {
                    select: { id: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const data = dietPlans.map((plan) => ({ ...plan, mealCount: plan.meals.length }));
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching diet plans:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar planos alimentares' },
            { status: 500 }
        );
    }
}
