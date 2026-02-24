import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import auditedFoods from '@/data/taco-audited-foods.json';

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

type AuditedFood = {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
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

function normalizeForSearch(value: string) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesQuery(name: string, query: string) {
    const normalizedName = normalizeForSearch(name);
    const normalizedQuery = normalizeForSearch(query);
    if (!normalizedName || !normalizedQuery) return false;

    if (normalizedName.includes(normalizedQuery)) return true;

    const tokens = normalizedQuery.split(' ').filter((token) => token.length > 0);
    if (tokens.length === 0) return false;
    return tokens.every((token) => normalizedName.includes(token));
}

function scoreFood(name: string, query: string, source: 'local' | 'external') {
    const n = normalizeForSearch(name);
    const q = normalizeForSearch(query);

    let score = 0;

    if (n === q) score += 200;
    if (n.startsWith(q)) score += 120;
    if (n.includes(q)) score += 60;

    if (BRAZILIAN_STAPLES.some((k) => n.includes(k))) score += 80;
    if (DEPRIORITIZE_TERMS.some((k) => n.includes(k))) score -= 90;

    if (source === 'local') score += 50;

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

function searchInAuditedDataset(query: string): SearchFoodResult[] {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    return (auditedFoods as AuditedFood[])
        .filter((food) => matchesQuery(food.name, normalizedQuery))
        .map((food, index) => ({
            id: `audit_${index}_${normalizeText(food.name).replace(/\s+/g, '_')}`,
            name: food.name,
            portion: food.portion || '100g',
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
            source: 'local',
            isSystem: true,
        }));
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').trim();

    if (!query || query.length < 2) {
        return NextResponse.json({ success: true, data: [] });
    }

    try {
        const normalizedQuery = normalizeText(query);
        const localFoods = await prisma.food.findMany({
            where: {
                isSystem: true,
            },
            orderBy: { name: 'asc' },
            take: 4000,
            select: {
                id: true,
                name: true,
                portion: true,
                calories: true,
                protein: true,
                carbs: true,
                fat: true,
                isSystem: true,
            },
        });

        let results: SearchFoodResult[] = localFoods
            .filter((food) => matchesQuery(food.name || '', normalizedQuery))
            .map((food) => ({
                id: food.id,
                name: food.name,
                portion: food.portion || '100g',
                calories: Number(food.calories || 0),
                protein: Number(food.protein || 0),
                carbs: Number(food.carbs || 0),
                fat: Number(food.fat || 0),
                source: 'local',
                isSystem: true,
            }));

        // Fallback auditado para casos de base local ainda não populada.
        if (results.length === 0) {
            const auditedResults = searchInAuditedDataset(query).slice(0, 60);
            if (auditedResults.length > 0) {
                await persistImportedFoods(auditedResults);
                results = auditedResults;
            }
        }

        const ranked = results
            .map((r) => ({
                ...r,
                __score: scoreFood(r.name || '', normalizedQuery, r.source)
            }))
            .sort((a, b) => b.__score - a.__score)
            .slice(0, 20)
            .map(({ __score, ...rest }) => rest);

        if (ranked.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        return NextResponse.json({ success: true, data: ranked });

    } catch (error) {
        console.error('Search Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar alimentos' }, { status: 500 });
    }
}
