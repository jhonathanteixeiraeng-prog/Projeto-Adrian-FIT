import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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
            select: { id: true },
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
        console.error('Error updating student notifications:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar notificações' },
            { status: 500 }
        );
    }
}
