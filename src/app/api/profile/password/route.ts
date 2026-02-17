import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { compare, hash } from 'bcryptjs';

// PUT /api/profile/password - Change password
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
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, error: 'Senha atual e nova senha são obrigatórias' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres' },
                { status: 400 }
            );
        }

        // Get current user with password
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { password: true },
        });

        if (!user?.password) {
            return NextResponse.json(
                { success: false, error: 'Usuário não encontrado' },
                { status: 404 }
            );
        }

        // Verify current password
        const isValid = await compare(currentPassword, user.password);

        if (!isValid) {
            return NextResponse.json(
                { success: false, error: 'Senha atual incorreta' },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await hash(newPassword, 12);

        // Update password
        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        return NextResponse.json({
            success: true,
            message: 'Senha alterada com sucesso',
        });
    } catch (error) {
        console.error('Error changing password:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao alterar senha' },
            { status: 500 }
        );
    }
}
