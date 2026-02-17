import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/student/personal - Get the student's personal trainer
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findFirst({
            where: session.user.studentId
                ? {
                    OR: [
                        { id: session.user.studentId },
                        { userId: session.user.id }
                    ]
                }
                : { userId: session.user.id },
            include: {
                personal: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });

        if (!student || !student.personal) {
            return NextResponse.json(
                { success: false, error: 'Personal trainer não encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: student.personal,
        });
    } catch (error) {
        console.error('Error fetching personal trainer:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar personal trainer' },
            { status: 500 }
        );
    }
}
