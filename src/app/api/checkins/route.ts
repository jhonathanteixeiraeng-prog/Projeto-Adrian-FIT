import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { personalLinks } from '@/lib/notifications';
import { CHECKIN_REPEAT_WINDOW_MS, checkinFingerprint, parseCheckinBody } from '@/lib/checkins';
import { isOwnPhotoUrl } from '@/lib/photo-url';

export const dynamic = 'force-dynamic';


// GET /api/checkins - Get checkins for student
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('studentId');

        let whereClause: any = {};

        if (session.user.role === 'STUDENT') {
            // A self-registered account has no student profile: an undefined studentId would drop
            // the filter and list every student's check-ins.
            if (!session.user.studentId) {
                return NextResponse.json(
                    { success: false, error: 'Perfil de aluno não encontrado' },
                    { status: 403 }
                );
            }
            whereClause.studentId = session.user.studentId;
        } else if (session.user.role === 'PERSONAL' && session.user.personalId && studentId) {
            // Verify the student belongs to this personal
            const student = await prisma.student.findFirst({
                where: { id: studentId, personalId: session.user.personalId },
            });
            if (!student) {
                return NextResponse.json(
                    { success: false, error: 'Aluno não encontrado' },
                    { status: 404 }
                );
            }
            whereClause.studentId = studentId;
        } else {
            return NextResponse.json(
                { success: false, error: 'Parâmetros inválidos' },
                { status: 400 }
            );
        }

        const checkins = await prisma.checkin.findMany({
            where: whereClause,
            orderBy: { date: 'desc' },
            take: 30,
            include: {
                photos: {
                    select: {
                        id: true,
                        url: true,
                        angle: true,
                        createdAt: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, data: checkins });
    } catch (error) {
        console.error('Error fetching checkins:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar check-ins' },
            { status: 500 }
        );
    }
}

// POST /api/checkins - Create new checkin
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.studentId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const studentId = session.user.studentId;
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = parseCheckinBody(body);
        if (!parsed.ok) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        }
        const input = parsed.value;

        // Photos must be files this student sent to POST /api/upload (private, see src/lib/photo-url.ts).
        if (input.photos.some((photo) => !isOwnPhotoUrl(photo.url, session.user.id))) {
            return NextResponse.json({ success: false, error: 'Foto inválida: envie a imagem de novo' }, { status: 400 });
        }

        // A repeat of the same check-in (a retry after an error, a double tap) returns the one already saved.
        const recent = await prisma.checkin.findMany({
            where: { studentId, date: { gte: new Date(Date.now() - CHECKIN_REPEAT_WINDOW_MS) } },
            orderBy: { date: 'desc' },
        });
        const repeated = recent.find((checkin) => checkinFingerprint(checkin) === checkinFingerprint(input));
        if (repeated) {
            return NextResponse.json({ success: true, data: repeated, message: 'Check-in enviado com sucesso!' });
        }

        const checkin = await prisma.$transaction(async (tx) => {
            const created = await tx.checkin.create({
                data: {
                    studentId,
                    date: new Date(),
                    weight: input.weight,
                    sleepHours: input.sleepHours,
                    energyLevel: input.energyLevel,
                    hungerLevel: input.hungerLevel,
                    stressLevel: input.stressLevel,
                    workoutAdherence: input.workoutAdherence,
                    dietAdherence: input.dietAdherence,
                    notes: input.notes,
                    ...input.measures,
                    bodyFatPercentage: input.bodyFatPercentage,
                },
            });

            // Se fotos foram enviadas com o check-in, cadastra e associa
            for (const photo of input.photos) {
                await tx.progressPhoto.create({
                    data: {
                        studentId,
                        checkinId: created.id,
                        url: photo.url,
                        angle: photo.angle,
                        weight: input.weight,
                    },
                });
            }

            // Atualiza peso do aluno
            await tx.student.update({
                where: { id: studentId },
                data: { weight: input.weight },
            });

            return created;
        });

        // The check-in is saved: a failing notification must not turn it into an error (and a resend).
        try {
            const student = await prisma.student.findUnique({
                where: { id: studentId },
                include: {
                    user: { select: { name: true } },
                    personal: { select: { userId: true } },
                },
            });

            if (student?.personal?.userId) {
                await prisma.notification.create({
                    data: {
                        userId: student.personal.userId,
                        type: 'CHECKIN_REMINDER',
                        title: 'Novo Check-in',
                        body: `${student.user.name} enviou o check-in semanal.`,
                        link: personalLinks.student(student.id, 'progress'),
                    },
                });
            }
        } catch (error) {
            console.error('Check-in saved, but the trainer notification failed:', error);
        }

        return NextResponse.json({
            success: true,
            data: checkin,
            message: 'Check-in enviado com sucesso!',
        });
    } catch (error) {
        console.error('Error creating checkin:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao enviar check-in' },
            { status: 500 }
        );
    }
}
