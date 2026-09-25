import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { studentLinkFor } from '@/lib/notifications';
import prisma from '@/lib/prisma';
import { TRANSACTION_OPTIONS, addDays, deactivateOtherActivePlans } from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

// POST /api/workout-plans/clone - Clone an active workout plan from one student to another
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const personalId = session.user.personalId;
        const body = await request.json().catch(() => null);
        const { sourceStudentId, targetStudentId, title } = (body ?? {}) as {
            sourceStudentId?: string;
            targetStudentId?: string;
            title?: string;
        };

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
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!sourcePlan) {
            return NextResponse.json(
                { success: false, error: 'O aluno selecionado não possui nenhum treino ativo para clonar' },
                { status: 404 }
            );
        }

        const now = new Date();
        const endDate = addDays(now, 60); // 60 days standard duration
        const newTitle = (typeof title === 'string' && title.trim()) || `${sourcePlan.title} (Cópia de ${sourceStudent.user.name.split(' ')[0]})`;

        const clonedPlan = await prisma.$transaction(async (tx) => {
            await deactivateOtherActivePlans(tx, targetStudentId);

            const created = await tx.workoutPlan.create({
                data: {
                    title: newTitle,
                    studentId: targetStudentId,
                    personalId,
                    startDate: now,
                    endDate,
                    active: true,
                    workoutDays: {
                        create: sourcePlan.workoutDays.map((day, dayIndex) => ({
                            name: day.name,
                            dayOfWeek: day.dayOfWeek,
                            order: dayIndex,
                            items: {
                                create: day.items.map((item, itemIndex) => ({
                                    exerciseId: item.exerciseId,
                                    sets: item.sets,
                                    reps: item.reps,
                                    rest: item.rest,
                                    restBySet: item.restBySet,
                                    load: item.load,
                                    rpe: item.rpe,
                                    notes: item.notes,
                                    order: itemIndex,
                                })),
                            },
                        })),
                    },
                },
                include: {
                    workoutDays: {
                        orderBy: { order: 'asc' },
                        include: { items: { orderBy: { order: 'asc' } } },
                    },
                },
            });

            // Notify target student
            await tx.notification.create({
                data: {
                    userId: targetStudent.user.id,
                    type: 'PLAN_UPDATED',
                    link: studentLinkFor('PLAN_UPDATED'),
                    title: 'Nova Ficha de Treino Disponível! 🏋️‍♂️',
                    body: `Seu personal preparou uma nova ficha de treino (${newTitle}) para você. Confira no app!`,
                    read: false,
                },
            });

            return created;
        }, TRANSACTION_OPTIONS);

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
