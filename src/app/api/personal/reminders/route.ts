import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { studentLinkFor } from '@/lib/notifications';
import { engagementReasons } from '@/components/personal/dashboard/attention-rules';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 500;
const MAX_MESSAGE_LENGTH = 2000;

const firstName = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || '';

/**
 * Active students whose training or check-in routine needs a nudge,
 * using the same rules as the dashboard queue (never every active student).
 */
async function findAtRiskStudents(personalId: string) {
    const students = await prisma.student.findMany({
        where: { personalId, status: 'ACTIVE' },
        select: {
            id: true,
            userId: true,
            status: true,
            createdAt: true,
            user: { select: { name: true } },
            checkins: {
                orderBy: { date: 'desc' },
                take: 1,
                select: { date: true, workoutAdherence: true, dietAdherence: true },
            },
            workoutSessions: { orderBy: { completedAt: 'desc' }, take: 1, select: { completedAt: true } },
            workoutPlans: {
                where: { active: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    startDate: true,
                    endDate: true,
                    workoutDays: {
                        select: {
                            completions: { orderBy: { completedAt: 'desc' }, take: 1, select: { completedAt: true } },
                        },
                    },
                },
            },
        },
    });

    const now = new Date();
    return students.filter((student) => {
        const plan = student.workoutPlans[0] ?? null;
        let lastWorkoutAt = student.workoutSessions[0]?.completedAt ?? null;
        for (const day of plan?.workoutDays ?? []) {
            const completedAt = day.completions[0]?.completedAt;
            if (completedAt && (!lastWorkoutAt || completedAt > lastWorkoutAt)) lastWorkoutAt = completedAt;
        }
        return (
            engagementReasons(
                {
                    status: student.status,
                    createdAt: student.createdAt,
                    lastWorkoutAt,
                    lastCheckin: student.checkins[0] ?? null,
                    workoutPlan: plan,
                },
                { now }
            ).length > 0
        );
    });
}

// POST /api/personal/reminders - Send an in-app reminder to one student, a list of students or the at-risk set.
// Body: { studentId?: string | 'ALL_AT_RISK', studentIds?: string[], type?, customMessage? }.
// `{nome}` in customMessage is replaced by each student's first name.
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const personalId = session.user.personalId;
        const body = await request.json().catch(() => ({}));
        const { studentId, studentIds } = body ?? {};
        const type: string = typeof body?.type === 'string' && body.type ? body.type : 'WORKOUT_REMINDER';
        const customMessage = typeof body?.customMessage === 'string' ? body.customMessage.trim() : '';

        if (customMessage.length > MAX_MESSAGE_LENGTH) {
            return NextResponse.json(
                { success: false, error: `A mensagem pode ter no máximo ${MAX_MESSAGE_LENGTH} caracteres` },
                { status: 400 }
            );
        }

        const defaultContent: Record<string, { title: string; body: string }> = {
            WORKOUT_REMINDER: {
                title: 'Hora do Treino! 💪',
                body: 'Seu treino do dia já está pronto no app. Vamos manter a consistência hoje?',
            },
            WATER_REMINDER: {
                title: 'Lembrete de Hidratação 💧',
                body: 'Não esqueça de beber água regularmente ao longo do dia para manter sua performance e recuperação.',
            },
            CHECKIN_REMINDER: {
                title: 'Check-in Semanal Pendente 📋',
                body: 'Hora de atualizar seu peso, medidas e fotos para seu personal acompanhar sua evolução!',
            },
            MEAL_REMINDER: {
                title: 'Plano Alimentar 🍽️',
                body: 'Lembre-se de registrar suas refeições de hoje no app para bater suas metas nutricionais.',
            },
            PAYMENT_REMINDER: {
                title: 'Renovação do plano 💳',
                body: 'Seu plano de acompanhamento está vencendo. Fale com seu personal para renovar e manter seu acompanhamento!',
            },
        };

        const template = defaultContent[type] || defaultContent.WORKOUT_REMINDER;

        let targets: { id: string; userId: string; name: string }[] = [];

        if (Array.isArray(studentIds)) {
            const ids = Array.from(
                new Set(studentIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0))
            );
            if (ids.length === 0) {
                return NextResponse.json(
                    { success: false, error: 'Selecione ao menos um aluno' },
                    { status: 400 }
                );
            }
            if (ids.length > MAX_BATCH) {
                return NextResponse.json(
                    { success: false, error: `Envie para no máximo ${MAX_BATCH} alunos por vez` },
                    { status: 400 }
                );
            }
            const students = await prisma.student.findMany({
                where: { id: { in: ids }, personalId },
                select: { id: true, userId: true, user: { select: { name: true } } },
            });
            if (students.length !== ids.length) {
                return NextResponse.json(
                    { success: false, error: 'Um ou mais alunos não foram encontrados' },
                    { status: 404 }
                );
            }
            targets = students.map((student) => ({ id: student.id, userId: student.userId, name: student.user.name }));
        } else if (studentId === 'ALL_AT_RISK') {
            const students = await findAtRiskStudents(personalId);
            targets = students.map((student) => ({ id: student.id, userId: student.userId, name: student.user.name }));
        } else if (typeof studentId === 'string' && studentId) {
            const student = await prisma.student.findFirst({
                where: { id: studentId, personalId },
                select: { id: true, userId: true, user: { select: { name: true } } },
            });

            if (!student) {
                return NextResponse.json(
                    { success: false, error: 'Aluno não encontrado' },
                    { status: 404 }
                );
            }
            targets = [{ id: student.id, userId: student.userId, name: student.user.name }];
        } else {
            return NextResponse.json(
                { success: false, error: 'studentId é obrigatório' },
                { status: 400 }
            );
        }

        if (targets.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                studentIds: [],
                message: 'Nenhum aluno para notificar',
            });
        }

        const messageBody = customMessage || template.body;
        await prisma.notification.createMany({
            data: targets.map((target) => ({
                userId: target.userId,
                type,
                title: template.title,
                body: messageBody.replace(/\{nome\}/gi, firstName(target.name)),
                link: studentLinkFor(type),
                read: false,
            })),
        });

        return NextResponse.json({
            success: true,
            count: targets.length,
            studentIds: targets.map((target) => target.id),
            message: `Lembrete enviado com sucesso para ${targets.length} ${targets.length === 1 ? 'aluno' : 'alunos'}`,
        });
    } catch (error) {
        console.error('Error sending reminder:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao enviar lembrete' },
            { status: 500 }
        );
    }
}
