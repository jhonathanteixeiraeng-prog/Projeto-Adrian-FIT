import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { encode, getToken } from 'next-auth/jwt';
import prisma from '@/lib/prisma';
import { authOptions, passwordStamp } from '@/lib/auth';
import { compare, hash } from 'bcryptjs';

const SESSION_COOKIES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];

/**
 * The new password ends every session opened with the old one (see passwordStamp). This device keeps
 * its session: its cookie is re-issued with the new stamp, with NextAuth's own cookie settings.
 */
async function renewedSessionCookie(request: NextRequest, stamp: string) {
    const name = SESSION_COOKIES.find((cookie) => request.cookies.has(cookie));
    const secret = process.env.NEXTAUTH_SECRET;
    if (!name || !secret) return null;
    const secure = name.startsWith('__Secure-');
    const token = await getToken({ req: request, secret, secureCookie: secure });
    if (!token) return null;
    const maxAge = authOptions.session?.maxAge ?? 30 * 24 * 60 * 60;
    const value = await encode({ token: { ...token, stamp }, secret, maxAge });
    return { name, value, options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure, maxAge } };
}

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

        const response = NextResponse.json({
            success: true,
            message: 'Senha alterada. Nos outros aparelhos será preciso entrar de novo.',
        });
        const cookie = await renewedSessionCookie(request, passwordStamp(hashedPassword));
        if (cookie) response.cookies.set(cookie.name, cookie.value, cookie.options);
        return response;
    } catch (error) {
        console.error('Error changing password:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao alterar senha' },
            { status: 500 }
        );
    }
}
