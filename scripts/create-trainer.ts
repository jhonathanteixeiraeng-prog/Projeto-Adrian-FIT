/**
 * Creates a trainer account, the only way to create one (public sign-up is closed):
 *
 *   npm run trainer:create -- --email ana@exemplo.com --name "Ana Souza" [--phone 11999999999]
 *
 * The password is TRAINER_PASSWORD when set, otherwise a random one printed once. It never lives in the
 * code (the old seed created an account with a fixed password; audit, improvement 8). Uses DATABASE_URL
 * and the Prisma client generated for that database (see DEPLOY-VERCEL-NEON-GITHUB.md).
 */
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const USAGE = 'Uso: npm run trainer:create -- --email ana@exemplo.com --name "Ana Souza" [--phone 11999999999]';

function option(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
    const email = option('email')?.toLowerCase();
    const name = option('name');
    const phone = option('phone');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
        console.error(USAGE);
        process.exitCode = 1;
        return;
    }

    const given = process.env.TRAINER_PASSWORD;
    if (given !== undefined && given.length < 8) {
        console.error('TRAINER_PASSWORD precisa de pelo menos 8 caracteres.');
        process.exitCode = 1;
        return;
    }

    const prisma = new PrismaClient();
    try {
        // Case-insensitive, like the login (older accounts may keep capitals).
        const taken = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE LOWER(email) = ${email}`;
        if (taken.length > 0) {
            console.error(`Já existe uma conta com ${email}.`);
            process.exitCode = 1;
            return;
        }

        const password = given || randomBytes(12).toString('base64url');
        const user = await prisma.user.create({
            data: { email, name, phone: phone || null, role: 'PERSONAL', password: await hash(password, 12), personal: { create: {} } },
        });
        console.log(`Conta de personal criada: ${user.name} <${user.email}>`);
        if (!given) console.log(`Senha inicial (aparece só agora; troque em Configurações depois de entrar): ${password}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
