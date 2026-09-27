import { createHmac, timingSafeEqual } from 'crypto';
import { findAccountIdByEmail } from '@/lib/account-email';
import prisma from '@/lib/prisma';
import { passwordStamp } from '@/lib/auth';

/**
 * Server only. "Esqueci minha senha": the e-mail carries a signed link that is valid for an hour and
 * for one use. It holds the password's stamp (see passwordStamp in src/lib/auth.ts), so it stops
 * working as soon as the password changes, including through the link itself.
 */

export const RESET_LINK_MINUTES = 60;
/** At most one reset e-mail per account in this window (User.passwordResetSentAt). */
export const RESET_EMAIL_INTERVAL_MS = 2 * 60 * 1000;

function signingKey(): Buffer {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is not set');
    // A key of its own, so a reset link can never be mistaken for any other signed value.
    return createHmac('sha256', secret).update('password-reset:v1').digest();
}

const sign = (payload: string) => createHmac('sha256', signingKey()).update(payload).digest('base64url');

export function createResetToken(user: { id: string; password: string }, now = Date.now()): string {
    const payload = Buffer.from(
        JSON.stringify({ u: user.id, e: Math.floor(now / 1000) + RESET_LINK_MINUTES * 60, s: passwordStamp(user.password) })
    ).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

/** The user and password stamp of a well-signed, unexpired token; null otherwise. */
export function readResetToken(token: string, now = Date.now()): { userId: string; stamp: string } | null {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [payload, signature] = parts;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (typeof data?.u !== 'string' || typeof data?.s !== 'string' || typeof data?.e !== 'number') return null;
        if (data.e * 1000 <= now) return null;
        return { userId: data.u, stamp: data.s };
    } catch {
        return null;
    }
}

/** Same lookup as the login: any capitals find the account (see findAccountIdByEmail). */
export async function findUserByEmail(typedEmail: string) {
    const id = await findAccountIdByEmail(typedEmail);
    return id
        ? prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, password: true, passwordResetSentAt: true } })
        : null;
}

/** The e-mail with the link (plain text and HTML). */
export function resetEmail(name: string, link: string) {
    const first = name.trim().split(/\s+/)[0] || 'Olá';
    const subject = 'Crie uma nova senha · Adrian Fit';
    const text = [
        `Olá, ${first}!`,
        '',
        'Recebemos um pedido para criar uma nova senha no Adrian Fit.',
        `Use este link em até ${RESET_LINK_MINUTES} minutos:`,
        link,
        '',
        'Se não foi você, ignore este e-mail: a sua senha continua a mesma.',
    ].join('\n');
    const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#C2570C">Adrian Fit</p>
<p style="margin:0 0 12px">Olá, ${escapeHtml(first)}!</p>
<p style="margin:0 0 20px">Recebemos um pedido para criar uma nova senha. O botão vale por ${RESET_LINK_MINUTES} minutos.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#C2570C;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Criar nova senha</a></p>
<p style="margin:0;font-size:13px;color:#52525b">Se não foi você, ignore este e-mail: a sua senha continua a mesma.</p>
</div></body></html>`;
    return { subject, text, html };
}

function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
