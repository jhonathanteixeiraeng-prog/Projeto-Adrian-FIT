import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar perfil' },
            { status: 500 }
        );
    }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { name, phone } = body;

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: name || undefined,
                phone: phone || undefined,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
            },
        });

        return NextResponse.json({
            success: true,
            data: updatedUser,
            message: 'Perfil atualizado com sucesso',
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar perfil' },
            { status: 500 }
        );
    }
}
