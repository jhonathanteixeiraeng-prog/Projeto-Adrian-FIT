import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/personal/notifications - List personal notifications and unread count
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        // Optional (web): ?exclude=NEW_MESSAGE,...  ?limit=50 (max 100)  ?before=<ISO date> for older pages.
        const { searchParams } = new URL(request.url);
        const excludedTypes = (searchParams.get('exclude') || '')
            .split(',')
            .map((type) => type.trim())
            .filter(Boolean);
        const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
        const beforeParam = searchParams.get('before');
        const before = beforeParam ? new Date(beforeParam) : null;

        const [page, unreadMessages, unreadNotifications] = await Promise.all([
            prisma.notification.findMany({
                where: {
                    userId: session.user.id,
                    ...(excludedTypes.length > 0 && { type: { notIn: excludedTypes } }),
                    ...(before && !Number.isNaN(before.getTime()) && { createdAt: { lt: before } }),
                },
                orderBy: { createdAt: 'desc' },
                take: limit + 1,
            }),
            prisma.message.count({
                where: {
                    toUserId: session.user.id,
                    read: false,
                    fromUser: {
                        student: {
                            personalId: session.user.personalId,
                        },
                    },
                },
            }),
            // Chat messages are counted once, via unreadMessages; their NEW_MESSAGE twins are not.
            prisma.notification.count({
                where: {
                    userId: session.user.id,
                    read: false,
                    type: { not: 'NEW_MESSAGE' },
                },
            }),
        ]);

        const hasMore = page.length > limit;
        const notifications = hasMore ? page.slice(0, limit) : page;

        return NextResponse.json({
            success: true,
            data: {
                notifications,
                unreadMessages,
                unreadNotifications,
                unreadCount: unreadNotifications + unreadMessages,
                hasMore,
            },
        });
    } catch (error) {
        console.error('Error fetching personal notifications:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar notificações' },
            { status: 500 }
        );
    }
}

// PATCH /api/personal/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const readAll = Boolean(body?.readAll);
        const notificationId = typeof body?.id === 'string' ? body.id : null;

        if (readAll) {
            // Only notifications: chat messages stay unread until their conversation is opened.
            await prisma.notification.updateMany({
                where: {
                    userId: session.user.id,
                    read: false,
                },
                data: { read: true },
            });

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
        console.error('Error updating personal notifications:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar notificações' },
            { status: 500 }
        );
    }
}
