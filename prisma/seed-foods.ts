import { PrismaClient } from '@prisma/client';
import auditedFoods from '../src/data/taco-audited-foods.json';

const prisma = new PrismaClient();

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

type SeedFoodInput = {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

function toNumber(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.round(parsed * 100) / 100;
}

function loadAuditedFoods(): SeedFoodInput[] {
    return (auditedFoods as SeedFoodInput[]).map((food) => ({
        name: String(food.name || '').trim(),
        portion: String(food.portion || '100g').trim() || '100g',
        calories: toNumber(food.calories),
        protein: toNumber(food.protein),
        carbs: toNumber(food.carbs),
        fat: toNumber(food.fat),
    }));
}

async function main() {
    console.log('🌱 Sincronizando alimentos auditados...');
    const sourceFoods = loadAuditedFoods();

    const dedupMap = new Map<string, SeedFoodInput>();
    for (const food of sourceFoods) {
        const key = normalizeText(food.name);
        if (!key) continue;
        if (food.calories <= 0 && food.protein <= 0 && food.carbs <= 0 && food.fat <= 0) {
            continue;
        }
        if (!dedupMap.has(key)) {
            dedupMap.set(key, food);
        }
    }

    const payload = Array.from(dedupMap.values()).map((food) => ({
        name: food.name,
        portion: food.portion,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        isSystem: true,
    }));

    await prisma.$transaction(async (tx) => {
        await tx.food.deleteMany({ where: { isSystem: true } });
        if (payload.length > 0) {
            await tx.food.createMany({ data: payload });
        }
    });

    console.log(`✅ Alimentos sincronizados. Total auditado: ${payload.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
