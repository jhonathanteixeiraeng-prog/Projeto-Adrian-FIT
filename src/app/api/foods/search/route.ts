import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchTacoFoods } from '@/lib/taco-api';

type SearchFoodResult = {
    id: string;
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isSystem: boolean;
    source: 'local' | 'external';
};

const BRAZILIAN_STAPLES = [
    'arroz', 'feijao', 'frango', 'ovo', 'banana', 'aveia', 'tapioca', 'batata',
    'batata doce', 'mandioca', 'macaxeira', 'aipim', 'carne', 'peixe', 'salmao',
    'brocolis', 'abobora', 'pao integral', 'iogurte', 'queijo cottage', 'azeite'
];

const DEPRIORITIZE_TERMS = [
    'biscoito', 'cookie', 'chocolate', 'barra', 'cereal', 'salgadinho', 'recheado',
    'wafer', 'nuggets', 'sorvete', 'doce', 'achocolatado'
];

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function scoreFood(name: string, query: string, source: 'local' | 'external') {
    const n = normalizeText(name);
    const q = normalizeText(query);

    let score = 0;

    if (n === q) score += 200;
    if (n.startsWith(q)) score += 120;
    if (n.includes(q)) score += 60;

    if (BRAZILIAN_STAPLES.some((k) => n.includes(k))) score += 80;
    if (DEPRIORITIZE_TERMS.some((k) => n.includes(k))) score -= 90;

    if (source === 'local') score += 40;

    return score;
}

async function persistImportedFoods(foods: Array<{
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}>) {
    if (foods.length === 0) return;

    const normalizedSeen = new Set<string>();
    const uniqueFoods = foods.filter((food) => {
        const key = normalizeText(food.name);
        if (!key || normalizedSeen.has(key)) return false;
        normalizedSeen.add(key);
        return true;
    });

    if (uniqueFoods.length === 0) return;

    const existing = await prisma.food.findMany({
        where: {
            name: {
                in: uniqueFoods.map((food) => food.name),
            },
        },
        select: { name: true },
    });

    const existingNormalized = new Set(existing.map((food) => normalizeText(food.name)));

    const dataToCreate = uniqueFoods
        .filter((food) => !existingNormalized.has(normalizeText(food.name)))
        .map((food) => ({
            name: food.name,
            portion: food.portion || '100g',
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
            isSystem: true,
        }));

    if (dataToCreate.length === 0) return;

    await prisma.food.createMany({
        data: dataToCreate,
    });
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
        return NextResponse.json({ success: true, data: [] });
    }

    try {
        // 1. Search Local DB
        const localFoods = await prisma.food.findMany({
            where: {
                name: {
                    contains: query,
                    // mode: 'insensitive' // SQLite doesn't support mode: insensitive natively for all collations, but let's try or handle in app
                }
            },
            take: 20
        });

        // SQLite case-insensitive filter manual if needed, but 'contains' is usually case-insensitive in default SQLite for ASCII
        // For accurate results, we might need a raw query or just rely on default.

        let results: SearchFoodResult[] = localFoods.map((food) => ({
            id: food.id,
            name: food.name,
            portion: food.portion || '100g',
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
            isSystem: Boolean(food.isSystem),
            source: 'local',
        }));

        // 2. Search TACO API and feed DB for future use
        if (results.length < 20) {
            try {
                const tacoFoods = await searchTacoFoods(query, 30);

                if (tacoFoods.length > 0) {
                    const localNames = new Set(results.map((r) => normalizeText(r.name || '')));
                    const uniqueExternal: SearchFoodResult[] = tacoFoods
                        .filter((f) => !localNames.has(normalizeText(f.name)))
                        .map((f) => ({
                            id: `taco_${f.id}`,
                            name: f.name,
                            portion: f.portion || '100g',
                            calories: f.calories || 0,
                            protein: f.protein || 0,
                            carbs: f.carbs || 0,
                            fat: f.fat || 0,
                            source: 'external',
                            isSystem: true
                        }));

                    if (uniqueExternal.length > 0) {
                        await persistImportedFoods(uniqueExternal);
                    }

                    results = [...results, ...uniqueExternal];
                }
            } catch (err) {
                console.error('TACO API Error:', err);
                // Continue with local results
            }
        }

        // Rank results to prioritize common Brazilian foods and local matches.
        const ranked = results
            .map((r) => ({
                ...r,
                __score: scoreFood(r.name || '', query, r.source)
            }))
            .sort((a, b) => b.__score - a.__score)
            .slice(0, 20)
            .map(({ __score, ...rest }) => rest);

        return NextResponse.json({ success: true, data: ranked });

    } catch (error) {
        console.error('Search Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar alimentos' }, { status: 500 });
    }
}
