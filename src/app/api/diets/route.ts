import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/diets - List all diet plans for personal's students
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

        // Get all diet plans for students of this personal
        const dietPlans = await prisma.dietPlan.findMany({
            where: {
                student: {
                    personalId,
                },
            },
            include: {
                student: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
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

        return NextResponse.json({ success: true, data: dietPlans });
    } catch (error) {
        console.error('Error fetching diet plans:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar planos alimentares' },
            { status: 500 }
        );
    }
}
