import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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
            whereClause.studentId = session.user.studentId;
        } else if (session.user.role === 'PERSONAL' && studentId) {
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

function parseOptionalFloat(val: unknown): number | null {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(String(val).replace(',', '.'));
    return Number.isFinite(num) ? num : null;
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

        const body = await request.json();
        const {
            weight,
            sleepHours,
            energyLevel,
            hungerLevel,
            stressLevel,
            workoutAdherence,
            dietAdherence,
            notes,
            chest,
            waist,
            abdomen,
            hips,
            armRight,
            armLeft,
            thighRight,
            thighLeft,
            calfRight,
            calfLeft,
            bodyFatPercentage,
            photos,
        } = body;

        // Validate required fields
        if (!weight || !sleepHours) {
            return NextResponse.json(
                { success: false, error: 'Peso e horas de sono são obrigatórios' },
                { status: 400 }
            );
        }

        const parsedWeight = parseFloat(String(weight).replace(',', '.'));
        const parsedSleepHours = parseFloat(String(sleepHours).replace(',', '.'));

        const checkin = await prisma.$transaction(async (tx) => {
            const created = await tx.checkin.create({
                data: {
                    studentId: session.user.studentId!,
                    weight: parsedWeight,
                    sleepHours: parsedSleepHours,
                    energyLevel: parseInt(energyLevel) || 3,
                    hungerLevel: parseInt(hungerLevel) || 3,
                    stressLevel: parseInt(stressLevel) || 3,
                    workoutAdherence: parseInt(workoutAdherence) || 0,
                    dietAdherence: parseInt(dietAdherence) || 0,
                    notes: notes ? String(notes).trim() : null,
                    chest: parseOptionalFloat(chest),
                    waist: parseOptionalFloat(waist),
                    abdomen: parseOptionalFloat(abdomen),
                    hips: parseOptionalFloat(hips),
                    armRight: parseOptionalFloat(armRight),
                    armLeft: parseOptionalFloat(armLeft),
                    thighRight: parseOptionalFloat(thighRight),
                    thighLeft: parseOptionalFloat(thighLeft),
                    calfRight: parseOptionalFloat(calfRight),
                    calfLeft: parseOptionalFloat(calfLeft),
                    bodyFatPercentage: parseOptionalFloat(bodyFatPercentage),
                },
            });

            // Se fotos foram enviadas com o check-in, cadastra e associa
            if (Array.isArray(photos) && photos.length > 0) {
                for (const photo of photos) {
                    if (photo?.url) {
                        const rawAngle = String(photo.angle || 'FRONT').toUpperCase();
                        const angle = ['FRONT', 'SIDE', 'BACK', 'OTHER'].includes(rawAngle) ? rawAngle : 'FRONT';
                        await tx.progressPhoto.create({
                            data: {
                                studentId: session.user.studentId!,
                                checkinId: created.id,
                                url: String(photo.url).trim(),
                                angle,
                                weight: parsedWeight,
                            },
                        });
                    }
                }
            }

            // Atualiza peso do aluno
            await tx.student.update({
                where: { id: session.user.studentId! },
                data: { weight: parsedWeight },
            });

            return created;
        });

        // Create notification for personal
        const student = await prisma.student.findUnique({
            where: { id: session.user.studentId },
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
                },
            });
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
