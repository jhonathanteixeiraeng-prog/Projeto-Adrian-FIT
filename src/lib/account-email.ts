import prisma from '@/lib/prisma';

/**
 * The id of the account with this e-mail, whatever its capitals (audit A17). Accounts created now are
 * stored in lowercase, but older ones (the public sign-up, closed since A01) kept the address as typed.
 * An exact match wins; otherwise a case-insensitive one, only when a single account has it.
 */
export async function findAccountIdByEmail(typedEmail: string): Promise<string | null> {
    const typed = typedEmail.trim();
    if (!typed) return null;
    const lower = typed.toLowerCase();
    const exact =
        (await prisma.user.findUnique({ where: { email: typed }, select: { id: true } })) ??
        (lower !== typed ? await prisma.user.findUnique({ where: { email: lower }, select: { id: true } }) : null);
    if (exact) return exact.id;

    // Case-insensitive on SQLite and Postgres alike.
    const matches = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE LOWER(email) = ${lower} LIMIT 2`;
    return matches.length === 1 ? matches[0].id : null;
}
