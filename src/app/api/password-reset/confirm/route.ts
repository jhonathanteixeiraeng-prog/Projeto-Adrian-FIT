import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { passwordStamp } from '@/lib/auth';
import { readResetToken } from '@/lib/password-reset';
import { hasAppAccess } from '@/lib/student-access';

export const dynamic = 'force-dynamic';

const INVALID_LINK = {
    success: false,
    code: 'INVALID_LINK',
    error: 'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
};

// POST /api/password-reset/confirm - Sets the new password from an e-mailed link. The new password ends
// every open session (see passwordStamp) and the link can't be used again.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const token = typeof body?.token === 'string' ? body.token : '';
        const password = typeof body?.password === 'string' ? body.password : '';

        const link = token ? readResetToken(token) : null;
        if (!link) return NextResponse.json(INVALID_LINK, { status: 400 });
        if (password.length < 6) {
            return NextResponse.json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres' }, { status: 400 });
        }
        if (password.length > 200) {
            return NextResponse.json({ success: false, error: 'A nova senha pode ter no máximo 200 caracteres' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { id: link.userId }, select: { id: true, email: true, password: true } });
        if (!user || !hasAppAccess(user.email) || passwordStamp(user.password) !== link.stamp) {
            return NextResponse.json(INVALID_LINK, { status: 400 });
        }

        // Conditional on the password the link was issued for: two tabs can't both use it.
        const updated = await prisma.user.updateMany({
            where: { id: user.id, password: user.password },
            data: { password: await hash(password, 12), passwordResetSentAt: null },
        });
        if (updated.count === 0) return NextResponse.json(INVALID_LINK, { status: 400 });

        return NextResponse.json({ success: true, message: 'Senha criada. Entre com a nova senha.' });
    } catch (error) {
        console.error('Error confirming a password reset:', error);
        return NextResponse.json({ success: false, error: 'Não foi possível criar a nova senha. Tente de novo.' }, { status: 500 });
    }
}
