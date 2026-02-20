export type TacoFoodResult = {
    id: string;
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

const DEFAULT_ENDPOINT_PATHS = [
    '/foods/search',
    '/api/foods/search',
    '/foods',
    '/api/foods',
    '/alimentos',
    '/api/alimentos',
];

const DEFAULT_QUERY_KEYS = ['q', 'query', 'search', 'nome'];

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) return fallback;

    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return fallback;

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function firstString(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

function firstNumber(source: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = source[key];
        const parsed = toNumber(value, Number.NaN);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return 0;
}

function extractArray(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const keys = ['data', 'results', 'foods', 'alimentos', 'items', 'content'];
    for (const key of keys) {
        if (Array.isArray(payload[key])) {
            return payload[key];
        }
    }

    if (payload.data && typeof payload.data === 'object') {
        for (const key of keys) {
            if (Array.isArray(payload.data[key])) {
                return payload.data[key];
            }
        }
    }

    return [];
}

function mapRawFood(raw: any, index: number): TacoFoodResult | null {
    if (!raw || typeof raw !== 'object') return null;

    const item = raw as Record<string, unknown>;
    const nutrients =
        (typeof item.nutrients === 'object' && item.nutrients ? item.nutrients : null) ||
        (typeof item.nutritional === 'object' && item.nutritional ? item.nutritional : null) ||
        (typeof item.nutritionalValues === 'object' && item.nutritionalValues ? item.nutritionalValues : null) ||
        (typeof item.valoresNutricionais === 'object' && item.valoresNutricionais ? item.valoresNutricionais : null) ||
        (typeof item.composition === 'object' && item.composition ? item.composition : null) ||
        {};

    const nutrientSource = nutrients as Record<string, unknown>;

    const name = firstString(item, ['name', 'nome', 'food', 'alimento', 'description', 'descricao']);
    if (!name) return null;

    const portion = firstString(item, ['portion', 'porcao', 'serving', 'medida']) || '100g';

    const calories =
        firstNumber(item, ['calories', 'kcal', 'energiaKcal', 'energia_kcal', 'energy_kcal', 'energyKcal']) ||
        firstNumber(nutrientSource, ['calories', 'kcal', 'energiaKcal', 'energia_kcal', 'energy_kcal', 'energyKcal']);

    const protein =
        firstNumber(item, ['protein', 'proteins', 'proteina', 'proteinas']) ||
        firstNumber(nutrientSource, ['protein', 'proteins', 'proteina', 'proteinas']);

    const carbs =
        firstNumber(item, ['carbs', 'carboidratos', 'carboidrato', 'carbohydrates']) ||
        firstNumber(nutrientSource, ['carbs', 'carboidratos', 'carboidrato', 'carbohydrates']);

    const fat =
        firstNumber(item, ['fat', 'fats', 'lipids', 'lipideos', 'gorduras', 'gordura']) ||
        firstNumber(nutrientSource, ['fat', 'fats', 'lipids', 'lipideos', 'gorduras', 'gordura']);

    const id = String(item.id || item.codigo || item.code || `taco-${normalizeText(name)}-${index}`);

    if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) {
        return null;
    }

    return {
        id,
        name,
        portion,
        calories,
        protein,
        carbs,
        fat,
    };
}

function getBaseUrl() {
    const raw = process.env.TACO_API_BASE_URL || process.env.TACO_API_URL || '';
    return raw.trim().replace(/\/+$/, '');
}

function getEndpointPaths() {
    const custom = (process.env.TACO_API_ENDPOINT_PATHS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    if (custom.length > 0) return custom;
    return DEFAULT_ENDPOINT_PATHS;
}

function getQueryKeys() {
    const custom = (process.env.TACO_API_QUERY_KEYS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    if (custom.length > 0) return custom;
    return DEFAULT_QUERY_KEYS;
}

function buildHeaders() {
    const token = process.env.TACO_API_TOKEN || process.env.TACO_API_KEY || '';
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };

    if (!token) return headers;

    headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    headers['x-api-key'] = token;
    return headers;
}

export async function searchTacoFoods(query: string, limit = 30): Promise<TacoFoodResult[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return [];

    const baseUrl = getBaseUrl();
    if (!baseUrl) return [];

    const endpointPaths = getEndpointPaths();
    const queryKeys = getQueryKeys();
    const headers = buildHeaders();

    const allResults: TacoFoodResult[] = [];
    const seen = new Set<string>();

    for (const path of endpointPaths) {
        for (const key of queryKeys) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 7000);

                const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
                url.searchParams.set(key, normalizedQuery);
                url.searchParams.set('limit', String(limit));

                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers,
                    signal: controller.signal,
                    cache: 'no-store',
                });

                clearTimeout(timeout);

                if (!response.ok) continue;

                const payload = await response.json();
                const array = extractArray(payload);
                if (array.length === 0) continue;

                for (let i = 0; i < array.length; i += 1) {
                    const mapped = mapRawFood(array[i], i);
                    if (!mapped) continue;

                    const keyName = normalizeText(mapped.name);
                    if (seen.has(keyName)) continue;

                    seen.add(keyName);
                    allResults.push(mapped);
                    if (allResults.length >= limit) return allResults;
                }

                if (allResults.length > 0) return allResults;
            } catch {
                // Try next endpoint/param combination
            }
        }
    }

    return allResults.slice(0, limit);
}

export async function searchTacoFoodsByTerms(terms: string[], limitPerTerm = 25): Promise<TacoFoodResult[]> {
    const merged: TacoFoodResult[] = [];
    const seen = new Set<string>();

    for (const term of terms) {
        const foods = await searchTacoFoods(term, limitPerTerm);
        for (const food of foods) {
            const key = normalizeText(food.name);
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(food);
        }
    }

    return merged;
}
