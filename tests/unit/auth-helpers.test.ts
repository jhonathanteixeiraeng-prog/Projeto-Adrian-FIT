import { afterEach, describe, expect, it, vi } from 'vitest';
import { passwordStamp } from '@/lib/auth';
import { isEmailConfigured, sendEmail } from '@/lib/mailer';
import { RESET_LINK_MINUTES, createResetToken, readResetToken, resetEmail } from '@/lib/password-reset';
import { formatPhone, whatsappLink, whatsappNumber } from '@/lib/whatsapp';

const user = { id: 'cmuser000000000000000000', password: '$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234' };
const now = Date.parse('2026-09-26T22:00:00Z');

describe('reset links', () => {
    it('carry the user and the password stamp for an hour', () => {
        const token = createResetToken(user, now);
        expect(readResetToken(token, now + 1000)).toEqual({ userId: user.id, stamp: passwordStamp(user.password) });
        expect(readResetToken(token, now + (RESET_LINK_MINUTES - 1) * 60_000)).not.toBeNull();
        expect(readResetToken(token, now + RESET_LINK_MINUTES * 60_000)).toBeNull();
    });

    it('refuse anything tampered with or signed with another secret', () => {
        const token = createResetToken(user, now);
        const [payload, signature] = token.split('.');
        const flip = (text: string, index: number) => text.slice(0, index) + (text[index] === 'A' ? 'B' : 'A') + text.slice(index + 1);
        expect(readResetToken(`${flip(payload, 5)}.${signature}`, now)).toBeNull();
        expect(readResetToken(`${payload}.${flip(signature, 3)}`, now)).toBeNull();
        const forged = Buffer.from(JSON.stringify({ u: 'attacker', e: 9_999_999_999, s: 'x' })).toString('base64url');
        expect(readResetToken(`${forged}.${signature}`, now)).toBeNull();
        for (const bad of ['', 'abc', `${token}.extra`, `.${signature}`, `${payload}.`]) expect(readResetToken(bad, now)).toBeNull();

        const secret = process.env.NEXTAUTH_SECRET;
        process.env.NEXTAUTH_SECRET = 'another-secret';
        try {
            expect(readResetToken(token, now)).toBeNull();
        } finally {
            process.env.NEXTAUTH_SECRET = secret;
        }
    });

    it('stop working once the password changes (the stamp changes)', () => {
        expect(passwordStamp(user.password)).not.toBe(passwordStamp(user.password.replace('abc', 'xyz')));
    });

    it('escape the name in the e-mail', () => {
        const mail = resetEmail('Ana <b>Maria</b>', 'https://example.test/reset-password?token=a.b');
        expect(mail.text).toContain('Olá, Ana!');
        expect(mail.html).not.toContain('<b>Maria');
        expect(mail.html).toContain('href="https://example.test/reset-password?token=a.b"');
    });
});

describe('mailer', () => {
    const env = { ...process.env };
    afterEach(() => {
        process.env = { ...env };
        vi.unstubAllGlobals();
    });

    it('prints to the log in development and is off on Vercel without a key', async () => {
        delete process.env.RESEND_API_KEY;
        delete process.env.VERCEL;
        expect(isEmailConfigured()).toBe(true);
        process.env.VERCEL = '1';
        expect(isEmailConfigured()).toBe(false);
        await expect(sendEmail({ to: 'a@example.test', subject: 's', text: 't', html: 'h' })).rejects.toThrow(/RESEND_API_KEY/);
    });

    it('sends through Resend with the configured sender', async () => {
        process.env.VERCEL = '1';
        process.env.RESEND_API_KEY = 're_test';
        process.env.EMAIL_FROM = 'Adrian Fit <nao-responda@example.test>';
        const fetchMock = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        await sendEmail({ to: 'a@example.test', subject: 'Assunto', text: 'Texto', html: '<p>Html</p>' });
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe('https://api.resend.com/emails');
        expect(init.headers.Authorization).toBe('Bearer re_test');
        expect(JSON.parse(String(init.body))).toMatchObject({ to: ['a@example.test'], from: 'Adrian Fit <nao-responda@example.test>' });

        vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"invalid"}', { status: 422 })));
        await expect(sendEmail({ to: 'a@example.test', subject: 's', text: 't', html: 'h' })).rejects.toThrow(/Resend 422/);
    });
});

describe('WhatsApp numbers', () => {
    it('adds the Brazilian country code to national numbers', () => {
        expect(whatsappNumber('(92) 99999-9999')).toBe('5592999999999');
        expect(whatsappNumber('0 92 99999-9999')).toBe('5592999999999');
        expect(whatsappNumber('55 92 99999-9999')).toBe('5592999999999');
        expect(whatsappNumber('+1 415 555 1234')).toBe('14155551234');
        expect(whatsappNumber('123')).toBeNull();
    });

    it('formats and links', () => {
        expect(formatPhone('92999999999')).toBe('(92) 99999-9999');
        expect(formatPhone('9232321234')).toBe('(92) 3232-1234');
        expect(whatsappLink('92999999999', 'Olá, Ana!')).toBe('https://wa.me/5592999999999?text=Ol%C3%A1%2C%20Ana!');
        expect(whatsappLink(null)).toBeNull();
    });
});
