import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { registerSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate input
        const validationResult = registerSchema.safeParse(body);
        if (!validationResult.success) {
            return NextResponse.json(
                { success: false, error: validationResult.error.errors[0].message },
                { status: 400 }
            );
        }

        const { name, email, password, role, phone } = validationResult.data;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'Este e-mail já está cadastrado' },
                { status: 409 }
            );
        }

        // Hash password
        const hashedPassword = await hash(password, 12);

        // Create user with profile
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                phone,
                ...(role === 'PERSONAL' && {
                    personal: {
                        create: {},
                    },
                }),
            },
            include: {
                personal: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            message: 'Cadastro realizado com sucesso!',
        });
    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao criar conta. Tente novamente.' },
            { status: 500 }
        );
    }
}
