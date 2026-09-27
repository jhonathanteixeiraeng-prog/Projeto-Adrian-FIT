import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { POST as generateDiet } from '@/app/api/diets/generate/route';
import { POST as requestReset } from '@/app/api/password-reset/request/route';
import { POST as upload } from '@/app/api/upload/route';
import { authOptions } from '@/lib/auth';
import { LIMITS, hitRateLimit } from '@/lib/rate-limit';
import { createPersonal, createStudent, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';
import { removeTestPhotos } from '../helpers/photos';

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
delete process.env.RESEND_API_KEY;

beforeEach(resetDatabase);
afterAll(removeTestPhotos);

const credentials = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: Record<string, string>, req: { headers?: Record<string, string> }) => Promise<unknown> };
};
/** A login from `address` (as Vercel reports it): 'ok' or the error the login page shows. */
const login = (email: string, password: string, address = '203.0.113.7') =>
    credentials.options.authorize({ email, password }, { headers: { 'x-forwarded-for': `${address}, 10.0.0.1` } }).then(
        () => 'ok',
        (error: Error) => error.message
    );

describe('usage limits (A10)', () => {
    it('count uses per window, free up when it ends, and store no caller in clear', async () => {
        const limit = { name: 'test', max: 2, windowMs: 60_000 };
        const start = new Date('2026-09-27T12:00:00Z');
        const later = (ms: number) => new Date(start.getTime() + ms);

        expect(await hitRateLimit(limit, 'ana@example.test', start)).toEqual({ allowed: true });
        expect(await hitRateLimit(limit, 'ana@example.test', later(10))).toEqual({ allowed: true });
        expect(await hitRateLimit(limit, 'ana@example.test', later(1000))).toEqual({ allowed: false, retryAfterSeconds: 59 });
        expect(await hitRateLimit(limit, 'bia@example.test', later(1000))).toEqual({ allowed: true });
        expect(await hitRateLimit(limit, 'ana@example.test', later(60_000))).toEqual({ allowed: true });

        const keys = (await prisma.rateLimit.findMany()).map((row) => row.key);
        expect(keys).toHaveLength(2);
        expect(keys.join(' ')).not.toContain('example.test');
    });

    it('login: ten attempts per e-mail from one address, then a wait even with the right password', async () => {
        const trainer = await createPersonal({ password: 'senha-certa' });
        for (let attempt = 0; attempt < LIMITS.loginAccount.max; attempt++) {
            expect(await login(trainer.user.email, 'errada')).toBe('E-mail ou senha incorretos');
        }
        expect(await login(trainer.user.email.toUpperCase(), 'senha-certa')).toMatch(/^Muitas tentativas de login\. Tente de novo em \d+ min\.$/);
        // Someone guessing elsewhere doesn't lock the owner out.
        expect(await login(trainer.user.email, 'senha-certa', '198.51.100.20')).toBe('ok');
    });

    it('"Esqueci minha senha": ten requests per address an hour', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const ask = (address: string) =>
            requestReset(request('POST', '/api/password-reset/request', { email: 'ninguem@example.test' }, { 'x-forwarded-for': address }));

        for (let i = 0; i < LIMITS.passwordReset.max; i++) expect((await ask('203.0.113.9')).status).toBe(200);
        const blocked = await ask('203.0.113.9');
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
        expect((await ask('198.51.100.21')).status).toBe(200);
    });

    it('photo uploads: sixty an hour per account', async () => {
        const trainer = await createPersonal();
        for (let i = 0; i < LIMITS.upload.max; i++) await hitRateLimit(LIMITS.upload, trainer.user.id);
        signIn(trainer.session);
        const form = new FormData();
        form.append('file', new File([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], 'foto.jpg', { type: 'image/jpeg' }));
        const blocked = await json(await upload(new NextRequest('http://localhost:3000/api/upload', { method: 'POST', body: form })));
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toContain('Muitas fotos');
    });

    it("AI diet drafts: limited before the paid call, and the student's name never goes to OpenAI", async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id, { name: 'Joana Exemplo' });
        const food = { name: 'Ovo', portion: '1 unidade', quantity: 2, calories: 70, protein: 6, carbs: 0.5, fat: 5, notes: '' };
        const draft = {
            title: 'Plano',
            meals: [
                { name: 'Café da manhã', time: '07:00', foods: [food] },
                { name: 'Almoço', time: '12:00', foods: [food] },
            ],
            warnings: [],
        };
        const sent: string[] = [];
        process.env.OPENAI_API_KEY = 'test-key';
        const openai = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
            sent.push(String(init?.body));
            return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(draft) }] }] }));
        });
        const generate = async () =>
            json(
                await generateDiet(
                    request('POST', '/api/diets/generate', { mode: 'student', studentId: student.student.id, studentInfo: 'Hipertrofia, treina 5x por semana', mealCount: 2 })
                )
            );

        try {
            signIn(trainer.session);
            for (let i = 0; i < LIMITS.dietDraftBurst.max; i++) expect((await generate()).status).toBe(200);
            const burst = await generate();
            expect(burst.status).toBe(429);
            expect(burst.body.error).toMatch(/^Muitos rascunhos seguidos/);
            expect(sent).toHaveLength(LIMITS.dietDraftBurst.max);
            expect(sent.join(' ')).not.toContain('Joana');

            // The daily budget, for another trainer who already used it up today.
            const other = await createPersonal();
            const otherStudent = await createStudent(other.personal.id);
            for (let i = 0; i < LIMITS.dietDraftDaily.max; i++) await hitRateLimit(LIMITS.dietDraftDaily, other.personal.id);
            signIn(other.session);
            const daily = await json(
                await generateDiet(
                    request('POST', '/api/diets/generate', { mode: 'student', studentId: otherStudent.student.id, studentInfo: 'Emagrecimento, iniciante', mealCount: 2 })
                )
            );
            expect(daily.status).toBe(429);
            expect(daily.body.error).toContain('por dia');
            expect(sent).toHaveLength(LIMITS.dietDraftBurst.max);
        } finally {
            openai.mockRestore();
            delete process.env.OPENAI_API_KEY;
        }
    });
});
