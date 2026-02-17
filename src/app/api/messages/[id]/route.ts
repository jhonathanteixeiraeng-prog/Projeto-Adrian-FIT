import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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

// GET /api/messages/[conversationId] - Get messages with a user
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

        // Fetch messages between the two users
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { fromUserId: currentUserId, toUserId: otherUserId },
                    { fromUserId: otherUserId, toUserId: currentUserId },
                ],
            },
            orderBy: { createdAt: 'asc' },
            include: {
                fromUser: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Mark messages as read
        await prisma.message.updateMany({
            where: {
                fromUserId: otherUserId,
                toUserId: currentUserId,
                read: false,
            },
            data: { read: true },
        });

        // Transform messages for frontend
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            fromMe: msg.fromUserId === currentUserId,
            text: msg.text,
            time: msg.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            read: msg.read,
            createdAt: msg.createdAt,
        }));

        return NextResponse.json({ success: true, data: formattedMessages });
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

        const body = await request.json();
        const { text } = body;

        if (!text || text.trim() === '') {
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
        await prisma.notification.create({
            data: {
                userId: toUserId,
                type: 'NEW_MESSAGE',
                title: 'Nova mensagem',
                body: `${session.user.name || 'Novo contato'} enviou uma mensagem.`,
            },
        });

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
