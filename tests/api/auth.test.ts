import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import bcrypt from 'bcryptjs';
import { decode, encode } from 'next-auth/jwt';
import { PUT as changePassword } from '@/app/api/profile/password/route';
import { POST as confirmReset } from '@/app/api/password-reset/confirm/route';
import { POST as requestReset } from '@/app/api/password-reset/request/route';
import { PUT as createAccess } from '@/app/api/students/[id]/access/route';
import { PUT as resetStudentPassword } from '@/app/api/students/[id]/reset-password/route';
import { authOptions, passwordStamp } from '@/lib/auth';
import { createResetToken, findUserByEmail } from '@/lib/password-reset';
import { createPersonal, createStudent, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';

beforeEach(resetDatabase);

const jwtCallback = authOptions.callbacks!.jwt!;
/** What NextAuth does on every request with a signed-in session. */
const checkSession = (token: Record<string, unknown>) => jwtCallback({ token } as never);
const tokenFor = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, role: user.role as 'PERSONAL' | 'STUDENT', stamp: passwordStamp(user.password), name: user.name, email: user.email };
};

describe('A09: sessions end when the password changes', () => {
    it('keeps a session while the password is the one it was opened with', async () => {
        const trainer = await createPersonal();
        const token = await tokenFor(trainer.user.id);
        await expect(checkSession(token)).resolves.toMatchObject({ id: trainer.user.id });
    });

    it('ends sessions after a password change, without a stamp, or for a deleted account', async () => {
        const trainer = await createPersonal();
        const token = await tokenFor(trainer.user.id);
        await prisma.user.update({ where: { id: trainer.user.id }, data: { password: await bcrypt.hash('outra-senha', 4) } });
        await expect(checkSession(token)).rejects.toThrow('SESSION_REVOKED');

        const { stamp: _stamp, ...legacy } = await tokenFor(trainer.user.id);
        await expect(checkSession(legacy)).rejects.toThrow('SESSION_REVOKED');

        await prisma.user.delete({ where: { id: trainer.user.id } });
        await expect(checkSession({ ...token, stamp: 'whatever' })).rejects.toThrow('SESSION_REVOKED');
    });

    it('changing your own password keeps this device signed in with a new stamp', async () => {
        const trainer = await createPersonal({ password: 'senha-antiga' });
        const cookieValue = await encode({ token: await tokenFor(trainer.user.id), secret: process.env.NEXTAUTH_SECRET! });
        signIn(trainer.session);

        const wrong = await changePassword(request('PUT', '/api/profile/password', { currentPassword: 'errada', newPassword: 'senha-nova' }));
        expect(wrong.status).toBe(400);

        const response = await changePassword(
            request('PUT', '/api/profile/password', { currentPassword: 'senha-antiga', newPassword: 'senha-nova' }, { cookie: `next-auth.session-token=${cookieValue}` })
        );
        expect(response.status).toBe(200);
        const renewed = response.cookies.get('next-auth.session-token');
        expect(renewed?.value).toBeTruthy();
        const token = await decode({ token: renewed!.value, secret: process.env.NEXTAUTH_SECRET! });
        const saved = await prisma.user.findUniqueOrThrow({ where: { id: trainer.user.id } });
        expect(token?.stamp).toBe(passwordStamp(saved.password));
        await expect(checkSession(token as never)).resolves.toBeTruthy();
    });

    it("a trainer resetting a student's password ends the student's sessions", async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const studentToken = await tokenFor(student.user.id);
        signIn(trainer.session);
        const response = await resetStudentPassword(request('PUT', `/api/students/${student.student.id}/reset-password`, { newPassword: 'nova-senha' }), {
            params: { id: student.student.id },
        });
        expect(response.status).toBe(200);
        await expect(checkSession(studentToken)).rejects.toThrow('SESSION_REVOKED');
    });
});

describe('"Esqueci minha senha"', () => {
    beforeEach(() => {
        delete process.env.RESEND_API_KEY;
        delete process.env.VERCEL;
        vi.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    it('answers the same for any address and sends at most one e-mail every two minutes', async () => {
        const trainer = await createPersonal();
        const ask = async (email: string) => json(await requestReset(request('POST', '/api/password-reset/request', { email })));

        const first = await ask(trainer.user.email);
        const unknown = await ask('ninguem@example.test');
        expect(first).toEqual(unknown);
        expect(first.status).toBe(200);

        const sentAt = (await prisma.user.findUniqueOrThrow({ where: { id: trainer.user.id } })).passwordResetSentAt;
        expect(sentAt).toBeInstanceOf(Date);
        await ask(trainer.user.email.toUpperCase());
        const after = (await prisma.user.findUniqueOrThrow({ where: { id: trainer.user.id } })).passwordResetSentAt;
        expect(after?.getTime()).toBe(sentAt?.getTime());

        expect((await ask('nao-e-email')).status).toBe(400);
    });

    it('is unavailable on Vercel until the e-mail service is configured', async () => {
        process.env.VERCEL = '1';
        const response = await requestReset(request('POST', '/api/password-reset/request', { email: 'a@example.test' }));
        expect(response.status).toBe(503);
    });

    it('sets the new password once, then the link stops working', async () => {
        const trainer = await createPersonal({ password: 'senha-antiga' });
        const token = createResetToken(trainer.user);
        const confirm = async (password: string) => json(await confirmReset(request('POST', '/api/password-reset/confirm', { token, password })));

        expect((await confirm('123')).status).toBe(400);
        expect((await confirm('senha-nova')).status).toBe(200);
        const saved = await prisma.user.findUniqueOrThrow({ where: { id: trainer.user.id } });
        expect(await bcrypt.compare('senha-nova', saved.password)).toBe(true);
        expect((await confirm('outra-senha')).body.code).toBe('INVALID_LINK');

        const expired = createResetToken(saved, Date.now() - 2 * 60 * 60 * 1000);
        const late = await json(await confirmReset(request('POST', '/api/password-reset/confirm', { token: expired, password: 'mais-uma' })));
        expect(late.body.code).toBe('INVALID_LINK');
    });
});

describe('"Criar acesso ao app"', () => {
    it('gives a student registered without e-mail a login, once', async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id, { email: null });
        const otherTrainer = await createPersonal();
        const create = async (body: unknown, id = student.student.id) => json(await createAccess(request('PUT', `/api/students/${id}/access`, body), { params: { id } }));

        signIn(otherTrainer.session);
        expect((await create({ email: 'ana@example.test', password: 'abcdef' })).status).toBe(404);

        signIn(trainer.session);
        expect((await create({ email: trainer.user.email.toUpperCase(), password: 'abcdef' })).status).toBe(409);
        expect((await create({ email: 'nao-e-email', password: 'abcdef' })).status).toBe(400);
        expect((await create({ email: 'ana@example.test', password: '123' })).status).toBe(400);

        const created = await create({ email: 'Ana@Example.test', password: 'abcdef' });
        expect(created).toMatchObject({ status: 200, body: { data: { email: 'ana@example.test' } } });
        const user = await prisma.user.findUniqueOrThrow({ where: { id: student.user.id } });
        expect(user.email).toBe('ana@example.test');
        expect(await bcrypt.compare('abcdef', user.password)).toBe(true);

        expect((await create({ email: 'ana2@example.test', password: 'abcdef' })).status).toBe(409);
    });
});

const credentials = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: Record<string, string>, req: { headers?: Record<string, string> }) => Promise<unknown> };
};
/** A login through the credentials provider: 'ok' or the error the login page shows. */
const attempt = (email: string, password: string) =>
    credentials.options.authorize({ email, password }, {}).then(
        () => 'ok',
        (error: Error) => error.message
    );

describe('login', () => {
    it('answers the same for an unknown e-mail and a wrong password', async () => {
        const trainer = await createPersonal({ password: 'senha-certa' });
        const unknown = await attempt('ninguem@example.test', 'senha-certa');
        expect(unknown).toBe('E-mail ou senha incorretos');
        expect(await attempt(trainer.user.email, 'senha-errada')).toBe(unknown);
        expect(await attempt(trainer.user.email.toUpperCase(), 'senha-certa')).toBe('ok');
    });
});

describe('e-mail capitals (A17)', () => {
    it('any capitals find an account stored with capitals, for the login and "Esqueci minha senha"', async () => {
        const trainer = await createPersonal({ password: 'senha-certa' });
        await prisma.user.update({ where: { id: trainer.user.id }, data: { email: 'Treinador.Teste@Example.TEST' } });

        expect(await attempt('treinador.teste@example.test', 'senha-certa')).toBe('ok');
        expect(await attempt(' TREINADOR.TESTE@EXAMPLE.TEST ', 'senha-certa')).toBe('ok');
        expect(await findUserByEmail('treinador.teste@example.test')).toMatchObject({ id: trainer.user.id });
    });

    it('two older accounts differing only in capitals: none is guessed', async () => {
        const first = await createPersonal({ password: 'senha-certa' });
        const second = await createPersonal({ password: 'senha-certa' });
        await prisma.user.update({ where: { id: first.user.id }, data: { email: 'Dupla@example.test' } });
        await prisma.user.update({ where: { id: second.user.id }, data: { email: 'DUPLA@example.test' } });

        expect(await attempt('Dupla@example.test', 'senha-certa')).toBe('ok');
        expect(await attempt('dupla@example.test', 'senha-certa')).toBe('E-mail ou senha incorretos');
    });
});
