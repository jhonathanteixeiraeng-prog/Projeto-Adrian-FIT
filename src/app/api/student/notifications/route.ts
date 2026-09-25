import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { studentLinkFor } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

// GET /api/student/notifications - List student notifications and unread count
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || session.user.role !== 'STUDENT') {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const userId = session.user.id;
        const studentId = session.user.studentId;
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Intelligent Automated Reminders Generator
        if (studentId) {
            // Check if there was any workout reminder in the last 24 hours
            const recentWorkoutReminder = await prisma.notification.findFirst({
                where: {
                    userId,
                    type: 'WORKOUT_REMINDER',
                    createdAt: { gte: oneDayAgo },
                },
            });

            if (!recentWorkoutReminder) {
                // Check if student has active workout plan and has not trained today
                const [activePlan, todaySession] = await Promise.all([
                    prisma.workoutPlan.findFirst({
                        where: { studentId, active: true },
                        include: { workoutDays: true },
                    }),
                    prisma.workoutSession.findFirst({
                        where: {
                            studentId,
                            completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
                        },
                    }),
                ]);

                if (activePlan && activePlan.workoutDays.length > 0 && !todaySession) {
                    const currentHour = now.getHours();
                    // Send nudge if it's afternoon/evening (>= 12h)
                    if (currentHour >= 12) {
                        await prisma.notification.create({
                            data: {
                                userId,
                                type: 'WORKOUT_REMINDER',
                                link: studentLinkFor('WORKOUT_REMINDER'),
                                title: 'Hora de Treinar! 💪',
                                body: 'Seu treino do dia está te esperando no app. Vamos manter o ritmo hoje?',
                                read: false,
                            },
                        });
                    }
                }
            }

            // Check if checkin is due (>7 days)
            const recentCheckinReminder = await prisma.notification.findFirst({
                where: {
                    userId,
                    type: 'CHECKIN_REMINDER',
                    createdAt: { gte: oneDayAgo },
                },
            });

            if (!recentCheckinReminder) {
                const latestCheckin = await prisma.checkin.findFirst({
                    where: { studentId },
                    orderBy: { date: 'desc' },
                });

                if (!latestCheckin || new Date(latestCheckin.date) < sevenDaysAgo) {
                    await prisma.notification.create({
                        data: {
                            userId,
                            type: 'CHECKIN_REMINDER',
                            link: studentLinkFor('CHECKIN_REMINDER'),
                            title: 'Check-in Semanal Pendente 📋',
                            body: 'Atualize seu peso, medidas e fotos para seu personal acompanhar sua evolução!',
                            read: false,
                        },
                    });
                }
            }
        }

        const [notifications, unreadMessages] = await Promise.all([
            prisma.notification.findMany({
                where: { userId: session.user.id },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.message.count({
                where: {
                    toUserId: session.user.id,
                    read: false,
                },
            }),
        ]);

        const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;
        const unreadCount = unreadNotificationCount + unreadMessages;

        return NextResponse.json({
            success: true,
            data: {
                notifications,
                unreadMessages,
                unreadCount,
            },
        });
    } catch (error) {
        console.error('Error fetching student notifications:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar notificações' },
            { status: 500 }
        );
    }
}

// PATCH /api/student/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || session.user.role !== 'STUDENT') {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const readAll = Boolean(body?.readAll);
        const notificationId = typeof body?.id === 'string' ? body.id : null;

        if (readAll) {
            await Promise.all([
                prisma.notification.updateMany({
                    where: {
                        userId: session.user.id,
                        read: false,
                    },
                    data: { read: true },
                }),
                prisma.message.updateMany({
                    where: {
                        toUserId: session.user.id,
                        read: false,
                    },
                    data: { read: true },
                }),
            ]);

            return NextResponse.json({
                success: true,
                message: 'Notificações marcadas como lidas',
            });
        }

        if (!notificationId) {
            return NextResponse.json(
                { success: false, error: 'ID da notificação é obrigatório' },
                { status: 400 }
            );
        }

        const notification = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId: session.user.id,
            },
        });

        if (!notification) {
            return NextResponse.json(
                { success: false, error: 'Notificação não encontrada' },
                { status: 404 }
            );
        }

        await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });

        return NextResponse.json({
            success: true,
            message: 'Notificação marcada como lida',
        });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar notificação' },
            { status: 500 }
        );
    }
}
