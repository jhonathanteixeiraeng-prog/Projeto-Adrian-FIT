import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/personal/reminders - Send automated or custom reminder to student(s)
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
        const body = await request.json();
        const { studentId, type = 'WORKOUT_REMINDER', customMessage } = body;

        const defaultContent: Record<string, { title: string; body: string }> = {
            WORKOUT_REMINDER: {
                title: 'Hora do Treino! 💪',
                body: customMessage || 'Seu treino do dia já está pronto no app. Vamos manter a consistência hoje?',
            },
            WATER_REMINDER: {
                title: 'Lembrete de Hidratação 💧',
                body: customMessage || 'Não esqueça de beber água regularmente ao longo do dia para manter sua performance e recuperação.',
            },
            CHECKIN_REMINDER: {
                title: 'Check-in Semanal Pendente 📋',
                body: customMessage || 'Hora de atualizar seu peso, medidas e fotos para seu personal acompanhar sua evolução!',
            },
            MEAL_REMINDER: {
                title: 'Plano Alimentar 🍽️',
                body: customMessage || 'Lembre-se de registrar suas refeições de hoje no app para bater suas metas nutricionais.',
            },
        };

        const template = defaultContent[type] || defaultContent.WORKOUT_REMINDER;

        let targetUserIds: string[] = [];

        if (studentId === 'ALL_AT_RISK') {
            // Find all active students under this personal
            const students = await prisma.student.findMany({
                where: { personalId, status: 'ACTIVE' },
                select: { userId: true },
            });
            targetUserIds = students.map((s) => s.userId);
        } else if (studentId) {
            const student = await prisma.student.findFirst({
                where: { id: studentId, personalId },
                select: { userId: true },
            });

            if (!student) {
                return NextResponse.json(
                    { success: false, error: 'Aluno não encontrado' },
                    { status: 404 }
                );
            }
            targetUserIds = [student.userId];
        } else {
            return NextResponse.json(
                { success: false, error: 'studentId é obrigatório' },
                { status: 400 }
            );
        }

        if (targetUserIds.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                message: 'Nenhum aluno para notificar',
            });
        }

        // Create notifications
        await Promise.all(
            targetUserIds.map((userId) =>
                prisma.notification.create({
                    data: {
                        userId,
                        type,
                        title: template.title,
                        body: template.body,
                        read: false,
                    },
                })
            )
        );

        return NextResponse.json({
            success: true,
            count: targetUserIds.length,
            message: `Lembrete enviado com sucesso para ${targetUserIds.length} ${targetUserIds.length === 1 ? 'aluno' : 'alunos'}`,
        });
    } catch (error) {
        console.error('Error sending reminder:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao enviar lembrete' },
            { status: 500 }
        );
    }
}
