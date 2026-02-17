import { PrismaClient } from '@prisma/client';
import { foodDatabase } from '../src/lib/food-database';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding foods...');

    for (const food of foodDatabase) {
        const existing = await prisma.food.findFirst({
            where: { name: food.name } // Avoid duplicates by name for now
        });

        if (!existing) {
            await prisma.food.create({
                data: {
                    name: food.name,
                    portion: food.portion,
                    calories: food.calories,
                    protein: food.protein,
                    carbs: food.carbs,
                    fat: food.fat,
                    isSystem: true
                }
            });
            console.log(`Created: ${food.name}`);
        } else {
            console.log(`Skipped (exists): ${food.name}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
