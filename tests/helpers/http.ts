import { vi } from 'vitest';
import { getServerSession } from 'next-auth';
import { NextRequest } from 'next/server';

/**
 * API tests mock next-auth's getServerSession (each file declares
 * `vi.mock('next-auth', …)`, see the api tests) and call the route handlers directly.
 */

export interface TestSession {
    id: string;
    role: 'PERSONAL' | 'STUDENT';
    personalId?: string;
    studentId?: string;
    name?: string;
    email?: string;
}

/** The session every following request sees; null = signed out. */
export function signIn(user: TestSession | null) {
    vi.mocked(getServerSession).mockResolvedValue(
        user ? ({ user, expires: new Date(Date.now() + 3600_000).toISOString() } as never) : null
    );
}

export function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    return new NextRequest(new URL(path, 'http://localhost:3000'), {
        method,
        headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export async function json(response: Response) {
    return { status: response.status, body: await response.json().catch(() => null) };
}
