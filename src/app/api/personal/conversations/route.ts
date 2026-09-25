import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getConversationSummaries } from './summary';

export const dynamic = 'force-dynamic';

const PREVIEW_LENGTH = 160;

// GET /api/personal/conversations - Chat inbox: one entry per student, most recent conversation first
export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId || !session.user.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const students = await prisma.student.findMany({
            where: { personalId: session.user.personalId },
            select: {
                id: true,
                userId: true,
                status: true,
                user: { select: { name: true, email: true, phone: true, avatar: true } },
            },
        });

        const summaries = await getConversationSummaries(
            session.user.id,
            students.map((student) => student.userId)
        );

        const conversations = students.map((student) => {
            const summary = summaries.get(student.userId);
            const last = summary?.lastMessage ?? null;
            return {
                studentId: student.id,
                userId: student.userId,
                name: student.user.name,
                email: student.user.email,
                phone: student.user.phone,
                avatar: student.user.avatar,
                status: student.status,
                lastMessage: last
                    ? {
                        text: last.text.length > PREVIEW_LENGTH ? `${last.text.slice(0, PREVIEW_LENGTH)}…` : last.text,
                        createdAt: last.createdAt.toISOString(),
                        fromMe: last.fromMe,
                    }
                    : null,
                unreadCount: summary?.unreadCount ?? 0,
            };
        });

        conversations.sort((a, b) => {
            if (a.lastMessage && b.lastMessage) return b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt);
            if (a.lastMessage) return -1;
            if (b.lastMessage) return 1;
            return a.name.localeCompare(b.name, 'pt-BR');
        });

        return NextResponse.json({ success: true, data: conversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao carregar conversas' },
            { status: 500 }
        );
    }
}
