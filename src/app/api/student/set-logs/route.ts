import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

async function findStudent(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
}

function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

// GET /api/student/set-logs?dayId=... - Today's logs, previous session and PRs
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await findStudent(session.user.id);
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const dayId = request.nextUrl.searchParams.get('dayId');
        if (!dayId) {
            return NextResponse.json({ success: false, error: 'dayId é obrigatório' }, { status: 400 });
        }

        const today = startOfToday();

        const todayLogs = await prisma.setLog.findMany({
            where: { studentId: student.id, dayId, date: { gte: today } },
            select: { exerciseId: true, setIndex: true, weight: true, reps: true },
        });

        // Sessão anterior: o registro mais recente deste dia de treino antes de hoje
        const lastBefore = await prisma.setLog.findFirst({
            where: { studentId: student.id, dayId, date: { lt: today } },
            orderBy: { date: 'desc' },
            select: { date: true },
        });

        let previousLogs: { exerciseId: string; setIndex: number; weight: number; reps: number }[] = [];
        if (lastBefore) {
            const dayStart = new Date(lastBefore.date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            previousLogs = await prisma.setLog.findMany({
                where: {
                    studentId: student.id,
                    dayId,
                    date: { gte: dayStart, lt: dayEnd },
                },
                select: { exerciseId: true, setIndex: true, weight: true, reps: true },
            });
        }

        // Recorde (maior carga já registrada) por exercício, em qualquer treino
        const prGroups = await prisma.setLog.groupBy({
            by: ['exerciseId'],
            where: { studentId: student.id, weight: { gt: 0 } },
            _max: { weight: true },
        });
        const prs = prGroups.map((group) => ({
            exerciseId: group.exerciseId,
            weight: group._max.weight ?? 0,
        }));

        return NextResponse.json({
            success: true,
            data: { today: todayLogs, previous: previousLogs, prs },
        });
    } catch (error) {
        console.error('Error fetching set logs:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar registros' }, { status: 500 });
    }
}

// POST /api/student/set-logs - Upsert/remove a set log for today
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const student = await findStudent(session.user.id);
        if (!student) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const body = await request.json();
        const { exerciseId, dayId, setIndex, weight, reps, remove } = body as {
            exerciseId?: string;
            dayId?: string;
            setIndex?: number;
            weight?: number;
            reps?: number;
            remove?: boolean;
        };

        if (!exerciseId || !dayId || typeof setIndex !== 'number') {
            return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });
        }

        const today = startOfToday();
        const existing = await prisma.setLog.findFirst({
            where: {
                studentId: student.id,
                exerciseId,
                dayId,
                setIndex,
                date: { gte: today },
            },
        });

        if (remove) {
            if (existing) {
                await prisma.setLog.delete({ where: { id: existing.id } });
            }
            return NextResponse.json({ success: true, data: { removed: true } });
        }

        const safeWeight = Math.max(0, Number(weight) || 0);
        const safeReps = Math.max(0, Math.round(Number(reps) || 0));

        const log = existing
            ? await prisma.setLog.update({
                where: { id: existing.id },
                data: { weight: safeWeight, reps: safeReps },
            })
            : await prisma.setLog.create({
                data: {
                    studentId: student.id,
                    exerciseId,
                    dayId,
                    setIndex,
                    weight: safeWeight,
                    reps: safeReps,
                },
            });

        return NextResponse.json({ success: true, data: { id: log.id } });
    } catch (error) {
        console.error('Error saving set log:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar registro' }, { status: 500 });
    }
}
