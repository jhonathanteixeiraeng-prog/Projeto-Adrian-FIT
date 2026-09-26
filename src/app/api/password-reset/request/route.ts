import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { isEmailConfigured, sendEmail } from '@/lib/mailer';
import { RESET_EMAIL_INTERVAL_MS, createResetToken, findUserByEmail, resetEmail } from '@/lib/password-reset';
import { hasAppAccess } from '@/lib/student-access';

export const dynamic = 'force-dynamic';

// The same answer whether or not the address has an account, so this can't be used to find accounts.
const SENT = {
    success: true,
    message: 'Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Confira também o spam.',
};

/** The configured site address (NEXTAUTH_URL) rather than the request's host, so links can't point elsewhere. */
function appUrl(request: NextRequest) {
    return process.env.NEXTAUTH_URL?.replace(/\/+$/, '') || new URL(request.url).origin;
}

// POST /api/password-reset/request - "Esqueci minha senha": e-mails a link to create a new password.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ success: false, error: 'Informe um e-mail válido' }, { status: 400 });
        }
        if (!isEmailConfigured()) {
            return NextResponse.json(
                { success: false, error: 'A recuperação de senha por e-mail ainda não está disponível. Fale com o administrador do sistema.' },
                { status: 503 }
            );
        }

        const user = await findUserByEmail(email);
        // Students registered without an e-mail have no login to recover (see student-access).
        if (!user || !hasAppAccess(user.email)) return NextResponse.json(SENT);

        // Claims the send slot in one statement, so repeated or concurrent requests send a single e-mail.
        const now = Date.now();
        const claimed = await prisma.user.updateMany({
            where: {
                id: user.id,
                OR: [{ passwordResetSentAt: null }, { passwordResetSentAt: { lt: new Date(now - RESET_EMAIL_INTERVAL_MS) } }],
            },
            data: { passwordResetSentAt: new Date(now) },
        });
        if (claimed.count === 0) return NextResponse.json(SENT);

        const link = `${appUrl(request)}/reset-password?token=${encodeURIComponent(createResetToken(user, now))}`;
        try {
            await sendEmail({ to: user.email, ...resetEmail(user.name, link) });
        } catch (error) {
            console.error('Could not send the password reset e-mail:', error);
            // Frees the slot so the person can try again right away.
            await prisma.user.update({ where: { id: user.id }, data: { passwordResetSentAt: null } }).catch(() => undefined);
        }
        return NextResponse.json(SENT);
    } catch (error) {
        console.error('Error requesting a password reset:', error);
        return NextResponse.json({ success: false, error: 'Não foi possível processar o pedido. Tente de novo.' }, { status: 500 });
    }
}
