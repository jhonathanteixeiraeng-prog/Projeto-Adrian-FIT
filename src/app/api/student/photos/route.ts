import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const queryStudentId = searchParams.get('studentId');
        const angleFilter = searchParams.get('angle');

        let targetStudentId = session.user.studentId;

        if (session.user.role === 'PERSONAL') {
            if (!queryStudentId) {
                return NextResponse.json({ success: false, error: 'studentId é obrigatório para personal' }, { status: 400 });
            }
            const student = await prisma.student.findFirst({
                where: { id: queryStudentId, personalId: session.user.personalId },
            });
            if (!student) {
                return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
            }
            targetStudentId = queryStudentId;
        }

        if (!targetStudentId) {
            return NextResponse.json({ success: false, error: 'Perfil de aluno não encontrado' }, { status: 404 });
        }

        const where: any = { studentId: targetStudentId };
        if (angleFilter && ['FRONT', 'SIDE', 'BACK', 'OTHER'].includes(angleFilter.toUpperCase())) {
            where.angle = angleFilter.toUpperCase();
        }

        const photos = await prisma.progressPhoto.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                checkin: {
                    select: {
                        id: true,
                        date: true,
                        weight: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, data: photos });
    } catch (error) {
        console.error('Erro ao listar fotos de progresso:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar fotos de evolução' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const url = String(body?.url || '').trim();
        const rawAngle = String(body?.angle || 'FRONT').toUpperCase();
        const angle = ['FRONT', 'SIDE', 'BACK', 'OTHER'].includes(rawAngle) ? rawAngle : 'FRONT';
        const weight = body?.weight ? Number(body.weight) : null;
        const notes = body?.notes ? String(body.notes).trim() : null;
        const checkinId = body?.checkinId ? String(body.checkinId) : null;

        let studentId = session.user.studentId;
        if (session.user.role === 'PERSONAL' && body?.studentId) {
            studentId = String(body.studentId);
        }

        if (!url || !studentId) {
            return NextResponse.json({ success: false, error: 'URL da foto e identificador de aluno são obrigatórios' }, { status: 400 });
        }

        // Se o peso não foi explicitamente enviado, pega o peso atual do aluno
        let resolvedWeight = weight;
        if (resolvedWeight === null || !Number.isFinite(resolvedWeight)) {
            const student = await prisma.student.findUnique({
                where: { id: studentId },
                select: { weight: true },
            });
            resolvedWeight = student?.weight ?? null;
        }

        const photo = await prisma.progressPhoto.create({
            data: {
                studentId,
                checkinId: checkinId || null,
                url,
                angle,
                weight: resolvedWeight,
                notes: notes || null,
            },
        });

        return NextResponse.json({ success: true, data: photo }, { status: 201 });
    } catch (error) {
        console.error('Erro ao salvar foto de progresso:', error);
        return NextResponse.json({ success: false, error: 'Erro ao registrar foto de evolução' }, { status: 500 });
    }
}
