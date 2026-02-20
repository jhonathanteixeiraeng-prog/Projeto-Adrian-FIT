import { PrismaClient } from '@prisma/client';
import { foodDatabase } from '../src/lib/food-database';
import { searchTacoFoodsByTerms } from '../src/lib/taco-api';

const prisma = new PrismaClient();

const TACO_IMPORT_TERMS = [
    'arroz', 'feijao', 'frango', 'ovo', 'banana', 'aveia', 'tapioca', 'batata',
    'batata doce', 'mandioca', 'carne bovina', 'peixe', 'salmao', 'atum', 'brocolis',
    'alface', 'tomate', 'cenoura', 'abobora', 'abobrinha', 'couve', 'espinafre',
    'iogurte', 'queijo', 'leite', 'pao integral', 'azeite', 'amendoim', 'whey'
];

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

type SeedFood = {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

async function loadFoodsFromSources(): Promise<SeedFood[]> {
    const tacoConfigured = !!(process.env.TACO_API_BASE_URL || process.env.TACO_API_URL);
    if (!tacoConfigured) {
        console.log('ℹ️ TACO API não configurada. Usando base local de fallback.');
        return foodDatabase.map((food) => ({
            name: food.name,
            portion: food.portion || '100g',
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
        }));
    }

    const imported = await searchTacoFoodsByTerms(TACO_IMPORT_TERMS, 40);
    if (imported.length === 0) {
        console.log('⚠️ TACO API configurada, mas não retornou alimentos. Usando fallback local.');
        return foodDatabase.map((food) => ({
            name: food.name,
            portion: food.portion || '100g',
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
        }));
    }

    console.log(`✅ Alimentos importados da TACO API: ${imported.length}`);
    return imported.map((food) => ({
        name: food.name,
        portion: food.portion || '100g',
        calories: Number(food.calories || 0),
        protein: Number(food.protein || 0),
        carbs: Number(food.carbs || 0),
        fat: Number(food.fat || 0),
    }));
}

async function main() {
    console.log('🌱 Seeding foods...');

    const sourceFoods = await loadFoodsFromSources();

    const dedupMap = new Map<string, SeedFood>();
    for (const food of sourceFoods) {
        const key = normalizeText(food.name);
        if (!key) continue;
        if (!dedupMap.has(key)) {
            dedupMap.set(key, food);
        }
    }

    let created = 0;
    let updated = 0;

    for (const food of Array.from(dedupMap.values())) {
        const existing = await prisma.food.findFirst({
            where: { name: food.name }
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
            created += 1;
        } else {
            await prisma.food.update({
                where: { id: existing.id },
                data: {
                    portion: food.portion,
                    calories: food.calories,
                    protein: food.protein,
                    carbs: food.carbs,
                    fat: food.fat,
                    isSystem: true
                }
            });
            updated += 1;
        }
    }

    console.log(`✅ Foods sync done. Created: ${created} | Updated: ${updated} | Total processed: ${dedupMap.size}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
