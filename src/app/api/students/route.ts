import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/students - List students for personal
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const students = await prisma.student.findMany({
            where: {
                personalId: session.user.personalId,
                ...(status && status !== 'all' && { status: status as any }),
                ...(search && {
                    user: {
                        OR: [
                            { name: { contains: search } },
                            { email: { contains: search } },
                        ],
                    },
                }),
            },
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
                workoutPlans: {
                    where: { active: true },
                    take: 1,
                },
                dietPlans: {
                    where: { active: true },
                    take: 1,
                },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: students });
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar alunos' },
            { status: 500 }
        );
    }
}

// POST /api/students - Create new student
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, email, password, phone, birthDate, gender, height, weight, goal } = body;

        // Validate password
        if (!password || password.length < 6) {
            return NextResponse.json(
                { success: false, error: 'Senha deve ter no mínimo 6 caracteres' },
                { status: 400 }
            );
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            // Check if already a student of this personal
            const existingStudent = await prisma.student.findFirst({
                where: {
                    userId: user.id,
                    personalId: session.user.personalId,
                },
            });

            if (existingStudent) {
                return NextResponse.json(
                    { success: false, error: 'Este aluno já está cadastrado' },
                    { status: 409 }
                );
            }
        } else {
            // Create new user with the password set by personal
            const { hash } = await import('bcryptjs');
            const hashedPassword = await hash(password, 12);

            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    role: 'STUDENT',
                    phone,
                },
            });
        }

        // Create student profile
        const student = await prisma.student.create({
            data: {
                userId: user.id,
                personalId: session.user.personalId,
                birthDate: birthDate ? new Date(birthDate) : null,
                gender: gender || null,
                height: height || null,
                weight: weight || null,
                goal: goal || null,
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
            data: student,
            message: 'Aluno cadastrado com sucesso!',
        });
    } catch (error) {
        console.error('Error creating student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao cadastrar aluno' },
            { status: 500 }
        );
    }
}
