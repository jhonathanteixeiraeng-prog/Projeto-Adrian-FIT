import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

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
            take: 20,
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
        } = body;

        // Validate required fields
        if (!weight || !sleepHours) {
            return NextResponse.json(
                { success: false, error: 'Peso e horas de sono são obrigatórios' },
                { status: 400 }
            );
        }

        const checkin = await prisma.checkin.create({
            data: {
                studentId: session.user.studentId,
                weight: parseFloat(weight),
                sleepHours: parseFloat(sleepHours),
                energyLevel: parseInt(energyLevel) || 3,
                hungerLevel: parseInt(hungerLevel) || 3,
                stressLevel: parseInt(stressLevel) || 3,
                workoutAdherence: parseInt(workoutAdherence) || 0,
                dietAdherence: parseInt(dietAdherence) || 0,
                notes: notes || null,
            },
        });

        // Update student weight
        await prisma.student.update({
            where: { id: session.user.studentId },
            data: { weight: parseFloat(weight) },
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
