import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// POST /api/workout-plans/clone - Clone an active workout plan from one student to another
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const personalId = session.user.personalId;
        const body = await request.json();
        const { sourceStudentId, targetStudentId, title } = body;

        if (!sourceStudentId || !targetStudentId) {
            return NextResponse.json(
                { success: false, error: 'Aluno de origem e aluno de destino são obrigatórios' },
                { status: 400 }
            );
        }

        // Verify both students belong to this personal trainer
        const [sourceStudent, targetStudent] = await Promise.all([
            prisma.student.findFirst({
                where: { id: sourceStudentId, personalId },
                include: { user: { select: { name: true } } },
            }),
            prisma.student.findFirst({
                where: { id: targetStudentId, personalId },
                include: { user: { select: { id: true, name: true } } },
            }),
        ]);

        if (!sourceStudent || !targetStudent) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado ou não pertence a você' },
                { status: 404 }
            );
        }

        // Find active workout plan of source student
        const sourcePlan = await prisma.workoutPlan.findFirst({
            where: { studentId: sourceStudentId, active: true },
            orderBy: { createdAt: 'desc' },
            include: {
                workoutDays: {
                    include: {
                        items: {
                            orderBy: { order: 'asc' },
                        },
                    },
                    orderBy: { dayOfWeek: 'asc' },
                },
            },
        });

        if (!sourcePlan) {
            return NextResponse.json(
                { success: false, error: 'O aluno selecionado não possui nenhum treino ativo para clonar' },
                { status: 404 }
            );
        }

        // Deactivate previous active plans of target student
        await prisma.workoutPlan.updateMany({
            where: { studentId: targetStudentId, active: true },
            data: { active: false },
        });

        const now = new Date();
        const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days standard duration

        const newTitle = title || `${sourcePlan.title} (Cópia de ${sourceStudent.user.name.split(' ')[0]})`;

        // Create the cloned plan
        const clonedPlan = await prisma.workoutPlan.create({
            data: {
                title: newTitle,
                studentId: targetStudentId,
                personalId,
                startDate: now,
                endDate,
                active: true,
                workoutDays: {
                    create: sourcePlan.workoutDays.map((day) => ({
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        items: {
                            create: day.items.map((item) => ({
                                exerciseId: item.exerciseId,
                                sets: item.sets,
                                reps: item.reps,
                                rest: item.rest,
                                restBySet: item.restBySet,
                                notes: item.notes,
                                order: item.order,
                            })),
                        },
                    })),
                },
            },
            include: {
                workoutDays: {
                    include: { items: true },
                },
            },
        });

        // Notify target student
        await prisma.notification.create({
            data: {
                userId: targetStudent.user.id,
                type: 'PLAN_UPDATED',
                title: 'Nova Ficha de Treino Disponível! 🏋️‍♂️',
                body: `Seu personal preparou uma nova ficha de treino (${newTitle}) para você. Confira no app!`,
                read: false,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Ficha clonada com sucesso para ${targetStudent.user.name}!`,
            data: clonedPlan,
        });
    } catch (error) {
        console.error('Error cloning workout plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao clonar ficha de treino' },
            { status: 500 }
        );
    }
}
