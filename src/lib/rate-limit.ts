import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Server only. Usage limits (audit A10): fixed-window counters in the database, so every function
 * instance shares them. Keys are hashes of the operation and the caller (user id, e-mail, IP address),
 * so none of those is stored. A limit that is reached answers before any work, and before any paid call.
 * If the counter itself fails (database hiccup), the request goes through: a limit must never lock
 * everyone out.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface Limit {
    name: string;
    max: number;
    windowMs: number;
}

export const LIMITS = {
    /** Login attempts for one e-mail from one address. */
    loginAccount: { name: 'login-account', max: 10, windowMs: 15 * MINUTE },
    /** Login attempts from one address, any e-mail. High: students on the same gym Wi-Fi share it. */
    loginAddress: { name: 'login-address', max: 100, windowMs: 15 * MINUTE },
    /** "Esqueci minha senha" requests from one address (each account also gets one e-mail per 2 minutes). */
    passwordReset: { name: 'password-reset', max: 10, windowMs: HOUR },
    /** Photo uploads per account. */
    upload: { name: 'upload', max: 60, windowMs: HOUR },
    /** AI diet drafts per trainer (paid OpenAI calls): a burst guard and a daily budget. */
    dietDraftBurst: { name: 'diet-draft-burst', max: 5, windowMs: 10 * MINUTE },
    dietDraftDaily: { name: 'diet-draft-daily', max: 30, windowMs: DAY },
} satisfies Record<string, Limit>;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const counterKey = (limit: Limit, caller: string) =>
    `${limit.name}:${createHash('sha256').update(caller).digest('base64url').slice(0, 32)}`;

/** Counts one use of `limit` by `caller` and says whether it's allowed. */
export async function hitRateLimit(limit: Limit, caller: string, now = new Date()): Promise<RateLimitResult> {
    const key = counterKey(limit, caller);
    try {
        // Inside the current window and under the limit: count it (a conditional write, safe when concurrent).
        const counted = await prisma.rateLimit.updateMany({
            where: { key, resetAt: { gt: now }, count: { lt: limit.max } },
            data: { count: { increment: 1 } },
        });
        if (counted.count === 1) return { allowed: true };

        const current = await prisma.rateLimit.findUnique({ where: { key } });
        if (current && current.resetAt > now) {
            return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000)) };
        }

        // No window yet, or it ended: this use starts a new one. Old counters are cleared now and then.
        const resetAt = new Date(now.getTime() + limit.windowMs);
        await prisma.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: 1, resetAt } });
        if (Math.random() < 0.02) await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now.getTime() - DAY) } } });
        return { allowed: true };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        return { allowed: true };
    }
}

/** "5 min", "2 h": how long until a limit frees up. */
export function waitText(retryAfterSeconds: number): string {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`;
}

/** 429 with the usual { success, error } body and Retry-After. */
export function tooManyRequests(retryAfterSeconds: number, error?: string) {
    return NextResponse.json(
        { success: false, error: error ?? `Muitas tentativas. Tente de novo em ${waitText(retryAfterSeconds)}.` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
}

/** The caller's address as Vercel reports it (it overwrites X-Forwarded-For, so it can't be forged). */
export function clientAddress(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
    const read = (name: string) => {
        if (!headers) return null;
        if (headers instanceof Headers) return headers.get(name);
        const value = headers[name];
        return Array.isArray(value) ? value[0] ?? null : value ?? null;
    };
    return read('x-forwarded-for')?.split(',')[0]?.trim() || read('x-real-ip')?.trim() || 'unknown';
}
