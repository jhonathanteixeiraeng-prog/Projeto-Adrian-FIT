import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/students/[id] - Get student details
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { id: params.id },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        avatar: true,
                    },
                },
                anamnesis: true,
                workoutPlans: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        workoutDays: {
                            include: {
                                items: {
                                    include: {
                                        exercise: true,
                                    },
                                    orderBy: { order: 'asc' },
                                },
                            },
                            orderBy: { dayOfWeek: 'asc' },
                        },
                    },
                },
                dietPlans: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        meals: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 10,
                },
                progressPhotos: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        // Check authorization
        if (session.user.role === 'PERSONAL' && student.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 403 }
            );
        }

        if (session.user.role === 'STUDENT' && student.id !== session.user.studentId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 403 }
            );
        }

        return NextResponse.json({ success: true, data: student });
    } catch (error) {
        console.error('Error fetching student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar aluno' },
            { status: 500 }
        );
    }
}

// PUT /api/students/[id] - Update student
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { id: params.id },
        });

        if (!student || student.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const { name, phone, birthDate, gender, height, weight, goal, status } = body;

        const updatedStudent = await prisma.student.update({
            where: { id: params.id },
            data: {
                birthDate: birthDate ? new Date(birthDate) : undefined,
                gender: gender || undefined,
                height: height || undefined,
                weight: weight || undefined,
                goal: goal || undefined,
                status: status || undefined,
                user: {
                    update: {
                        name: name || undefined,
                        phone: phone || undefined,
                    },
                },
            },
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
        });

        return NextResponse.json({
            success: true,
            data: updatedStudent,
            message: 'Aluno atualizado com sucesso!',
        });
    } catch (error) {
        console.error('Error updating student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar aluno' },
            { status: 500 }
        );
    }
}

// DELETE /api/students/[id] - Delete student
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { id: params.id },
        });

        if (!student || student.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        await prisma.student.delete({
            where: { id: params.id },
        });

        return NextResponse.json({
            success: true,
            message: 'Aluno removido com sucesso!',
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao remover aluno' },
            { status: 500 }
        );
    }
}
