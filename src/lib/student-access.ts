/**
 * Students registered without app access.
 *
 * While the trainer manages students on the web and sends plans over WhatsApp, a student may have
 * no e-mail and no password. Their User row still needs both (non-null columns, and the iOS app
 * decodes the e-mail as a string), so they get a placeholder address on the reserved ".invalid"
 * domain and a random password nobody knows: nobody can log in with it. Screens show the real
 * e-mail only (contactEmail) and say "Sem acesso ao app" otherwise.
 */
export const NO_ACCESS_EMAIL_DOMAIN = 'sem-acesso.invalid';

export function isPlaceholderEmail(email: string | null | undefined): boolean {
    return typeof email === 'string' && email.trim().toLowerCase().endsWith(`@${NO_ACCESS_EMAIL_DOMAIN}`);
}

/** Whether the student can log in to the app (has a real e-mail). */
export function hasAppAccess(email: string | null | undefined): boolean {
    return Boolean(email && email.trim()) && !isPlaceholderEmail(email);
}

/** The student's real e-mail, or null when they have no app access. */
export function contactEmail(email: string | null | undefined): string | null {
    return hasAppAccess(email) ? (email as string).trim() : null;
}
