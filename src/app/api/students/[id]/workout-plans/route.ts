import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/students/[id]/workout-plans - List workout plans for student
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

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const workoutPlans = await prisma.workoutPlan.findMany({
            where: { studentId },
            include: {
                workoutDays: {
                    include: {
                        items: {
                            include: {
                                exercise: true,
                            },
                        },
                    },
                    orderBy: { dayOfWeek: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: workoutPlans });
    } catch (error) {
        console.error('Error fetching workout plans:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar planos de treino' },
            { status: 500 }
        );
    }
}

// POST /api/students/[id]/workout-plans - Create workout plan for student
export async function POST(
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

        const studentId = params.id;

        // Verify student belongs to this personal
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                personalId: session.user.personalId,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { title, startDate, endDate, workoutDays } = body;

        if (!title) {
            return NextResponse.json(
                { success: false, error: 'Título é obrigatório' },
                { status: 400 }
            );
        }

        if (!workoutDays || workoutDays.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Adicione pelo menos um dia de treino' },
                { status: 400 }
            );
        }

        // Deactivate current active plans
        await prisma.workoutPlan.updateMany({
            where: { studentId, active: true },
            data: { active: false },
        });

        // Filter and prepare workout days with valid exercises only
        const preparedDays = workoutDays.map((day: any) => {
            // Filter items to only include those with valid exerciseId
            const validItems = (day.items || []).filter((item: any) =>
                item.exerciseId && item.exerciseId.trim() !== ''
            );

            return {
                dayOfWeek: day.dayOfWeek,
                name: day.name || `Treino ${day.dayOfWeek}`,
                items: {
                    create: validItems.map((item: any, index: number) => ({
                        exerciseId: item.exerciseId,
                        sets: item.sets || 3,
                        reps: item.reps || '12',
                        rest: item.rest || 60,
                        notes: item.notes || '',
                        order: index,
                    })),
                },
            };
        });

        // Create new workout plan
        const workoutPlan = await prisma.workoutPlan.create({
            data: {
                title,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                active: true,
                studentId,
                personalId: session.user.personalId,
                workoutDays: {
                    create: preparedDays,
                },
            },
            include: {
                workoutDays: {
                    include: {
                        items: {
                            include: { exercise: true },
                        },
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: workoutPlan,
            message: 'Plano de treino criado com sucesso!',
        });
    } catch (error: any) {
        console.error('Error creating workout plan:', error);

        // Provide more specific error messages
        let errorMessage = 'Erro ao criar plano de treino';
        if (error.code === 'P2003') {
            errorMessage = 'Um ou mais exercícios selecionados não existem no banco de dados';
        } else if (error.code === 'P2002') {
            errorMessage = 'Já existe um plano de treino com esses dados';
        }

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
