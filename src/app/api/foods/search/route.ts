import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

        let results = localFoods.map(f => ({
            ...f,
            source: 'local'
        }));

        // 2. If valid results are few, search OpenFoodFacts
        // Reduce threshold to trigger external search more easily for testing
        // if (results.length < 5) {
        // Actually, let's always search external if query is specific enough and local results are not perfect matches
        if (true) { // Always try external for now to ensure we get results
            try {
                const offResponse = await fetch(
                    `https://br.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=25`
                );
                const offData = await offResponse.json();

                if (offData.products && Array.isArray(offData.products)) {
                    const externalFoods = offData.products
                        .filter((p: any) => p.product_name && p.nutriments)
                        .map((p: any) => ({
                            id: `off_${p.code}`, // Temporary ID
                            name: p.product_name,
                            portion: '100g', // Standardize to 100g for OFF
                            calories: p.nutriments['energy-kcal_100g'] || 0,
                            protein: p.nutriments.proteins_100g || 0,
                            carbs: p.nutriments.carbohydrates_100g || 0,
                            fat: p.nutriments.fat_100g || 0,
                            source: 'external',
                            isSystem: false
                        }));

                    // Filter out external results that might be duplicates of local ones (simple name check)
                    const localNames = new Set(results.map(r => r.name.toLowerCase()));
                    const uniqueExternal = externalFoods.filter((f: any) => !localNames.has(f.name.toLowerCase()));

                    results = [...results, ...uniqueExternal];
                }
            } catch (err) {
                console.error('OpenFoodFacts Error:', err);
                // Continue with local results
            }
        }

        // Rank results to prioritize common Brazilian foods and local matches.
        const ranked = results
            .map((r: any) => ({
                ...r,
                __score: scoreFood(r.name || '', query, (r.source || 'external') as 'local' | 'external')
            }))
            .sort((a: any, b: any) => b.__score - a.__score)
            .slice(0, 20)
            .map(({ __score, ...rest }: any) => rest);

        return NextResponse.json({ success: true, data: ranked });

    } catch (error) {
        console.error('Search Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar alimentos' }, { status: 500 });
    }
}
