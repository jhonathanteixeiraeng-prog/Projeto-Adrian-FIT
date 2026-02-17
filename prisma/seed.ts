import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // Create Personal Trainer - Adrian Santos
    const hashedPassword = await hash('Adrian@2024', 10);

    const personalUser = await prisma.user.upsert({
        where: { email: 'adrian@adriansantos.com.br' },
        update: {},
        create: {
            email: 'adrian@adriansantos.com.br',
            name: 'Adrian Santos',
            password: hashedPassword,
            role: 'PERSONAL',
            phone: '11999999999',
            personal: {
                create: {},
            },
        },
        include: { personal: true },
    });

    console.log('✅ Personal Trainer created:', personalUser.name);

    console.log('🌱 Seed completed!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
