import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { studentLinkFor } from '@/lib/notifications';
import { parseTzOffset, viewerClock } from '@/lib/viewer-time';

export const dynamic = 'force-dynamic';

/**
 * Creates an automated reminder once per student, type and day. The web layout and page (and the app)
 * call this GET at the same time, and all of them pass the "none in the last 24 hours" check: the fixed
 * id makes the concurrent inserts create a single reminder.
 */
async function createDailyReminder(userId: string, day: string, reminder: { type: string; title: string; body: string }) {
    try {
        await prisma.notification.create({
            data: {
                id: `reminder-${reminder.type}-${userId}-${day}`,
                userId,
                ...reminder,
                link: studentLinkFor(reminder.type),
                read: false,
            },
        });
    } catch (error) {
        // Another request created it first.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
}

// GET /api/student/notifications?tz=<Date#getTimezoneOffset()> - List student notifications and unread count
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
        // The student's hour and day, not the server's (UTC).
        const clock = viewerClock(now, parseTzOffset(request.nextUrl.searchParams.get('tz')));

        // Intelligent Automated Reminders Generator (best effort: the list loads even if a reminder fails)
        if (studentId) {
            try {
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
                                completedAt: { gte: clock.startOfDay },
                            },
                        }),
                    ]);

                    // Send nudge if it's afternoon/evening (>= 12h) for the student
                    if (activePlan && activePlan.workoutDays.length > 0 && !todaySession && clock.hour >= 12) {
                        await createDailyReminder(userId, clock.day, {
                            type: 'WORKOUT_REMINDER',
                            title: 'Hora de Treinar! 💪',
                            body: 'Seu treino do dia está te esperando no app. Vamos manter o ritmo hoje?',
                        });
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
                        await createDailyReminder(userId, clock.day, {
                            type: 'CHECKIN_REMINDER',
                            title: 'Check-in Semanal Pendente 📋',
                            body: 'Atualize seu peso, medidas e fotos para seu personal acompanhar sua evolução!',
                        });
                    }
                }
            } catch (error) {
                console.error('Error generating student reminders:', error);
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
