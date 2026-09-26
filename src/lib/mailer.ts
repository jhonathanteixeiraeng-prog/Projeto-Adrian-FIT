/**
 * Server only. Transactional e-mail through Resend's HTTP API: RESEND_API_KEY, sender in EMAIL_FROM
 * (a verified domain; Resend's onboarding sender only reaches the Resend account's own address).
 * Without a key, local development prints the message to the server log; on Vercel nothing is sent.
 */

export function isEmailConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY) || !process.env.VERCEL;
}

export async function sendEmail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        if (process.env.VERCEL) throw new Error('RESEND_API_KEY is not set');
        console.info(`[email:dev] to=${message.to} · ${message.subject}\n${message.text}`);
        return;
    }
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Adrian Fit <onboarding@resend.dev>',
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
        }),
    });
    if (!response.ok) {
        throw new Error(`Resend ${response.status}: ${(await response.text().catch(() => '')).slice(0, 300)}`);
    }
}
