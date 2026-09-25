import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { personalLinks, studentLinkFor } from '@/lib/notifications';

async function canAccessConversation(currentUserId: string, otherUserId: string, role?: string, personalId?: string, studentId?: string) {
    if (!currentUserId || !otherUserId || currentUserId === otherUserId) return false;

    if (role === 'STUDENT') {
        const student = await prisma.student.findFirst({
            where: studentId
                ? {
                    OR: [{ id: studentId }, { userId: currentUserId }],
                }
                : { userId: currentUserId },
            include: {
                personal: {
                    select: { userId: true },
                },
            },
        });

        return student?.personal?.userId === otherUserId;
    }

    if (role === 'PERSONAL') {
        const personal = await prisma.personal.findFirst({
            where: personalId
                ? {
                    OR: [{ id: personalId }, { userId: currentUserId }],
                }
                : { userId: currentUserId },
            select: { id: true },
        });

        if (!personal?.id) return false;

        const student = await prisma.student.findFirst({
            where: {
                personalId: personal.id,
                userId: otherUserId,
            },
            select: { id: true },
        });

        return Boolean(student?.id);
    }

    return false;
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function parseDateParam(value: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Marks the other user's messages as read and clears the conversation's "new message" notifications. */
async function markConversationRead(currentUserId: string, otherUserId: string, role?: string) {
    await prisma.message.updateMany({
        where: {
            fromUserId: otherUserId,
            toUserId: currentUserId,
            read: false,
        },
        data: { read: true },
    });

    const conversationLink =
        role === 'PERSONAL'
            ? await prisma.student
                .findFirst({ where: { userId: otherUserId }, select: { id: true } })
                .then((student) => (student ? personalLinks.chat(student.id) : null))
            : studentLinkFor('NEW_MESSAGE');
    if (conversationLink) {
        // Best effort: the chat must keep working even if notifications fail (e.g. schema not migrated yet).
        await prisma.notification
            .updateMany({
                where: { userId: currentUserId, type: 'NEW_MESSAGE', read: false, link: conversationLink },
                data: { read: true },
            })
            .catch((error) => console.error('Error clearing message notifications:', error));
    }
}

// GET /api/messages/[userId] - Messages with a user.
// No query params: whole conversation (iOS app and student area).
// ?limit=N: the latest N messages (+ `hasMore`); ?before=ISO&limit=N: older page (doesn't mark as read);
// ?after=ISO: only messages newer than that date (polling). Paginated/polled responses also carry
// `readUpTo`: date of the newest message sent by the current user that the other side has read.
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const otherUserId = params.id;
        const currentUserId = session.user.id;
        const hasAccess = await canAccessConversation(
            currentUserId,
            otherUserId,
            session.user.role,
            session.user.personalId,
            session.user.studentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado à conversa' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const after = parseDateParam(searchParams.get('after'));
        const before = parseDateParam(searchParams.get('before'));
        const limitParam = Number.parseInt(searchParams.get('limit') || '', 10);
        const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_PAGE_SIZE) : null;
        const isPaginated = !after && (Boolean(before) || limit !== null);

        const conversationWhere = {
            OR: [
                { fromUserId: currentUserId, toUserId: otherUserId },
                { fromUserId: otherUserId, toUserId: currentUserId },
            ],
        };

        let messages;
        let hasMore = false;
        if (after) {
            messages = await prisma.message.findMany({
                where: { AND: [conversationWhere, { createdAt: { gt: after } }] },
                orderBy: { createdAt: 'asc' },
                take: MAX_PAGE_SIZE,
            });
        } else if (isPaginated) {
            const pageSize = limit ?? DEFAULT_PAGE_SIZE;
            const page = await prisma.message.findMany({
                where: before ? { AND: [conversationWhere, { createdAt: { lt: before } }] } : conversationWhere,
                orderBy: { createdAt: 'desc' },
                take: pageSize + 1,
            });
            hasMore = page.length > pageSize;
            messages = page.slice(0, pageSize).reverse();
        } else {
            messages = await prisma.message.findMany({
                where: conversationWhere,
                orderBy: { createdAt: 'asc' },
            });
        }

        // Opening the conversation marks it as read. Polls only write when they bring unread incoming
        // messages, and loading older history never writes.
        if (after) {
            if (messages.some((msg) => msg.fromUserId === otherUserId && !msg.read)) {
                await markConversationRead(currentUserId, otherUserId, session.user.role);
            }
        } else if (!before) {
            await markConversationRead(currentUserId, otherUserId, session.user.role);
        }

        let readUpTo: string | null | undefined;
        if (after || isPaginated) {
            const lastRead = await prisma.message.findFirst({
                where: { fromUserId: currentUserId, toUserId: otherUserId, read: true },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true },
            });
            readUpTo = lastRead ? lastRead.createdAt.toISOString() : null;
        }

        // `time` is kept for the iOS app; web clients format `createdAt` in the viewer's timezone.
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            fromMe: msg.fromUserId === currentUserId,
            text: msg.text,
            time: msg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            read: msg.read,
            createdAt: msg.createdAt,
        }));

        return NextResponse.json({
            success: true,
            data: formattedMessages,
            ...(isPaginated ? { hasMore } : {}),
            ...(readUpTo !== undefined ? { readUpTo } : {}),
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar mensagens' },
            { status: 500 }
        );
    }
}

// POST /api/messages/[id] - Send a message to a user
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => null);
        const text = body?.text;

        if (typeof text !== 'string' || text.trim() === '') {
            return NextResponse.json(
                { success: false, error: 'Mensagem vazia' },
                { status: 400 }
            );
        }

        const toUserId = params.id;
        const fromUserId = session.user.id;
        const hasAccess = await canAccessConversation(
            fromUserId,
            toUserId,
            session.user.role,
            session.user.personalId,
            session.user.studentId
        );

        if (!hasAccess) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado à conversa' },
                { status: 403 }
            );
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                fromUserId,
                toUserId,
                text: text.trim(),
            },
        });

        // Create recipient notification for inbox awareness
        let link: string | null = studentLinkFor('NEW_MESSAGE');
        if (session.user.role === 'STUDENT') {
            const sender = await prisma.student.findFirst({ where: { userId: fromUserId }, select: { id: true } });
            link = sender ? personalLinks.chat(sender.id) : null;
        }
        // Best effort: the message is already saved; a failure here must not make the client resend it.
        await prisma.notification
            .create({
                data: {
                    userId: toUserId,
                    type: 'NEW_MESSAGE',
                    title: 'Nova mensagem',
                    body: `${session.user.name || 'Novo contato'} enviou uma mensagem.`,
                    link,
                },
            })
            .catch((error) => console.error('Error creating message notification:', error));

        return NextResponse.json({
            success: true,
            data: {
                id: message.id,
                fromMe: true,
                text: message.text,
                time: message.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                read: message.read,
                createdAt: message.createdAt,
            },
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao enviar mensagem' },
            { status: 500 }
        );
    }
}
