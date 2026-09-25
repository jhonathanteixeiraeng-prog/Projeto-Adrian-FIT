import prisma from '@/lib/prisma';

export interface ConversationSummary {
    lastMessage: { id: string; text: string; createdAt: Date; fromMe: boolean } | null;
    unreadCount: number;
}

// Keeps each OR query well below SQLite's bound-parameter and expression-depth limits.
const CHUNK_SIZE = 200;

/**
 * Latest message and unread count of the conversations between a trainer and each of their students,
 * in a fixed number of queries (no per-student query): two groupBy + one lookup of the latest rows.
 * Keys of the returned map are student USER ids; students without messages are absent.
 */
export async function getConversationSummaries(
    personalUserId: string,
    studentUserIds: string[]
): Promise<Map<string, ConversationSummary>> {
    const summaries = new Map<string, ConversationSummary>();
    if (!personalUserId || studentUserIds.length === 0) return summaries;

    const [latestByDirection, unreadBySender] = await Promise.all([
        prisma.message.groupBy({
            by: ['fromUserId', 'toUserId'],
            where: {
                OR: [
                    { fromUserId: personalUserId, toUserId: { in: studentUserIds } },
                    { toUserId: personalUserId, fromUserId: { in: studentUserIds } },
                ],
            },
            _max: { createdAt: true },
        }),
        prisma.message.groupBy({
            by: ['fromUserId'],
            where: { toUserId: personalUserId, fromUserId: { in: studentUserIds }, read: false },
            _count: { _all: true },
        }),
    ]);

    // Each conversation has up to two rows (one per direction): keep the newest.
    const newest = new Map<string, { fromUserId: string; toUserId: string; createdAt: Date }>();
    for (const row of latestByDirection) {
        const createdAt = row._max.createdAt;
        if (!createdAt) continue;
        const studentUserId = row.fromUserId === personalUserId ? row.toUserId : row.fromUserId;
        const current = newest.get(studentUserId);
        if (!current || createdAt > current.createdAt) {
            newest.set(studentUserId, { fromUserId: row.fromUserId, toUserId: row.toUserId, createdAt });
        }
    }

    const keys = Array.from(newest.values());
    const chunks: (typeof keys)[] = [];
    for (let index = 0; index < keys.length; index += CHUNK_SIZE) chunks.push(keys.slice(index, index + CHUNK_SIZE));

    const latestRows = (
        await Promise.all(
            chunks.map((chunk) =>
                prisma.message.findMany({
                    where: {
                        OR: chunk.map(({ fromUserId, toUserId, createdAt }) => ({ fromUserId, toUserId, createdAt })),
                    },
                    select: { id: true, fromUserId: true, toUserId: true, text: true, createdAt: true },
                })
            )
        )
    ).flat();

    for (const message of latestRows) {
        const fromMe = message.fromUserId === personalUserId;
        const studentUserId = fromMe ? message.toUserId : message.fromUserId;
        const current = summaries.get(studentUserId);
        // Two messages with the same timestamp: keep one, deterministically.
        if (current?.lastMessage && current.lastMessage.id > message.id) continue;
        summaries.set(studentUserId, {
            lastMessage: { id: message.id, text: message.text, createdAt: message.createdAt, fromMe },
            unreadCount: 0,
        });
    }

    for (const row of unreadBySender) {
        const current = summaries.get(row.fromUserId) ?? { lastMessage: null, unreadCount: 0 };
        summaries.set(row.fromUserId, { ...current, unreadCount: row._count._all });
    }

    return summaries;
}
