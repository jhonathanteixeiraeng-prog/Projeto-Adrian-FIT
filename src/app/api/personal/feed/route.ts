import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface ActivityEvent {
    id: string;
    type: 'WORKOUT_COMPLETED' | 'CHECKIN_SUBMITTED' | 'FOOD_SUBSTITUTED' | 'MESSAGE_RECEIVED';
    title: string;
    description: string;
    timestamp: string;
    studentId: string;
    studentName: string;
    studentAvatar?: string | null;
    meta?: Record<string, any>;
}

// GET /api/personal/feed - Live Activity Feed of student actions
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const personalId = session.user.personalId;

        // Fetch students under this personal trainer
        const students = await prisma.student.findMany({
            where: { personalId },
            select: {
                id: true,
                user: { select: { id: true, name: true, avatar: true } },
            },
        });

        const studentIds = students.map((s) => s.id);
        const userToStudentMap = new Map<string, { id: string; name: string; avatar: string | null }>();
        const studentMap = new Map<string, { id: string; name: string; avatar: string | null }>();

        for (const s of students) {
            const data = { id: s.id, name: s.user.name, avatar: s.user.avatar };
            studentMap.set(s.id, data);
            userToStudentMap.set(s.user.id, data);
        }

        if (studentIds.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const threeDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Fetch recent activities across data sources
        const [recentWorkouts, recentCheckins, recentSubstitutions, recentMessages] = await Promise.all([
            prisma.workoutSession.findMany({
                where: {
                    studentId: { in: studentIds },
                    completedAt: { gte: threeDaysAgo },
                },
                orderBy: { completedAt: 'desc' },
                take: 15,
                select: {
                    id: true,
                    studentId: true,
                    dayName: true,
                    durationSeconds: true,
                    percentage: true,
                    completedAt: true,
                },
            }),
            prisma.checkin.findMany({
                where: {
                    studentId: { in: studentIds },
                    date: { gte: threeDaysAgo },
                },
                orderBy: { date: 'desc' },
                take: 15,
                select: {
                    id: true,
                    studentId: true,
                    date: true,
                    weight: true,
                    workoutAdherence: true,
                    dietAdherence: true,
                },
            }),
            prisma.foodSubstitutionHistory.findMany({
                where: {
                    studentId: { in: studentIds },
                    createdAt: { gte: threeDaysAgo },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    studentId: true,
                    originalFood: true,
                    newFood: true,
                    createdAt: true,
                },
            }),
            prisma.message.findMany({
                where: {
                    fromUserId: { in: Array.from(userToStudentMap.keys()) },
                    createdAt: { gte: threeDaysAgo },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    fromUserId: true,
                    text: true,
                    createdAt: true,
                },
            }),
        ]);

        const events: ActivityEvent[] = [];

        // 1. Workouts
        for (const w of recentWorkouts) {
            const st = studentMap.get(w.studentId);
            if (!st) continue;
            const mins = Math.round(w.durationSeconds / 60);
            events.push({
                id: `workout-${w.id}`,
                type: 'WORKOUT_COMPLETED',
                title: `${st.name} concluiu o treino`,
                description: `${w.dayName} · ${mins > 0 ? `${mins} min` : 'Finalizado'} · ${w.percentage}% concluído`,
                timestamp: w.completedAt.toISOString(),
                studentId: st.id,
                studentName: st.name,
                studentAvatar: st.avatar,
                meta: { duration: mins, percentage: w.percentage },
            });
        }

        // 2. Check-ins
        for (const c of recentCheckins) {
            const st = studentMap.get(c.studentId);
            if (!st) continue;
            events.push({
                id: `checkin-${c.id}`,
                type: 'CHECKIN_SUBMITTED',
                title: `${st.name} enviou o check-in`,
                description: `Peso: ${c.weight}kg · Adesão: ${c.workoutAdherence}% treino / ${c.dietAdherence}% dieta`,
                timestamp: c.date.toISOString(),
                studentId: st.id,
                studentName: st.name,
                studentAvatar: st.avatar,
                meta: { weight: c.weight },
            });
        }

        // 3. Food substitutions
        for (const f of recentSubstitutions) {
            const st = studentMap.get(f.studentId);
            if (!st) continue;
            events.push({
                id: `food-${f.id}`,
                type: 'FOOD_SUBSTITUTED',
                title: `${st.name} substituiu um alimento`,
                description: `Trocou ${f.originalFood} por ${f.newFood}`,
                timestamp: f.createdAt.toISOString(),
                studentId: st.id,
                studentName: st.name,
                studentAvatar: st.avatar,
            });
        }

        // 4. Messages
        for (const m of recentMessages) {
            const st = userToStudentMap.get(m.fromUserId);
            if (!st) continue;
            events.push({
                id: `msg-${m.id}`,
                type: 'MESSAGE_RECEIVED',
                title: `Nova mensagem de ${st.name}`,
                description: m.text.length > 60 ? `${m.text.slice(0, 60)}...` : m.text,
                timestamp: m.createdAt.toISOString(),
                studentId: st.id,
                studentName: st.name,
                studentAvatar: st.avatar,
            });
        }

        // Sort descending by timestamp
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({
            success: true,
            data: events.slice(0, 25),
        });
    } catch (error) {
        console.error('Error fetching activity feed:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao carregar feed de atividades' },
            { status: 500 }
        );
    }
}
