import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/student/profile - Get student profile settings
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            select: {
                id: true,
                goal: true,
                weight: true,
                height: true,
                status: true,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: student,
        });
    } catch (error) {
        console.error('Error fetching student profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar perfil do aluno' },
            { status: 500 }
        );
    }
}

// PUT /api/student/profile - Update student profile settings
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            select: { id: true },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Perfil de aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const goal = typeof body?.goal === 'string' ? body.goal.trim() : undefined;

        const updatedStudent = await prisma.student.update({
            where: { id: student.id },
            data: {
                goal: goal || null,
            },
            select: {
                id: true,
                goal: true,
                weight: true,
                height: true,
                status: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updatedStudent,
            message: 'Objetivo atualizado com sucesso',
        });
    } catch (error) {
        console.error('Error updating student profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar perfil do aluno' },
            { status: 500 }
        );
    }
}
