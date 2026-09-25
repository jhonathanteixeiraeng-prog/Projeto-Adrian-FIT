/**
 * Busca de alimentos (somente servidor).
 *
 * Os alimentos do sistema (TACO, ~400 itens) ficam num índice em memória com os nomes já
 * normalizados (sem acento/caixa), recarregado a cada 10 minutos ou quando novos alimentos do
 * sistema são importados. Os alimentos próprios do personal são poucos e lidos a cada busca.
 */
import prisma from '@/lib/prisma';
import auditedFoods from '@/data/taco-audited-foods.json';

export type SearchFoodResult = {
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

type IndexedFood = SearchFoodResult & { key: string; searchName: string };

type AuditedFood = {
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

const INDEX_TTL_MS = 10 * 60 * 1000;
const MAX_LIMIT = 50;

const BRAZILIAN_STAPLES = [
    'arroz', 'feijao', 'frango', 'ovo', 'banana', 'aveia', 'tapioca', 'batata',
    'batata doce', 'mandioca', 'macaxeira', 'aipim', 'carne', 'peixe', 'salmao',
    'brocolis', 'abobora', 'pao integral', 'iogurte', 'queijo cottage', 'azeite'
];

// Preparos simples costumam ser o que se prescreve ("Arroz, tipo 1, cozido" antes de "Arroz carreteiro").
const BASIC_PREPARATIONS = ['cozido', 'cozida', 'cru', 'crua', 'grelhado', 'grelhada', 'assado', 'assada'];

const DEPRIORITIZE_TERMS = [
    'biscoito', 'cookie', 'chocolate', 'barra', 'cereal', 'salgadinho', 'recheado',
    'wafer', 'nuggets', 'sorvete', 'doce', 'achocolatado'
];

export function normalizeFoodName(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeForSearch(value: string) {
    return normalizeFoodName(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesQuery(searchName: string, normalizedQuery: string) {
    if (!searchName || !normalizedQuery) return false;
    if (searchName.includes(normalizedQuery)) return true;
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => searchName.includes(token));
}

function scoreFood(searchName: string, normalizedQuery: string, isSystem: boolean) {
    let score = 0;
    if (searchName === normalizedQuery) score += 200;
    if (searchName.startsWith(normalizedQuery)) score += 120;
    if (searchName.includes(normalizedQuery)) score += 60;
    // Palavras que começam com o termo ("arroz" em "arroz integral") pesam mais que trechos no meio.
    if (normalizedQuery.split(' ').every((token) => searchName.split(' ').some((word) => word.startsWith(token)))) score += 30;
    if (BRAZILIAN_STAPLES.some((k) => searchName.includes(k))) score += 80;
    if (DEPRIORITIZE_TERMS.some((k) => searchName.includes(k))) score -= 90;
    if (searchName.split(' ').some((word) => BASIC_PREPARATIONS.includes(word))) score += 25;
    score += 50; // alimentos do banco local
    if (isSystem) score += 20;
    // Nomes curtos costumam ser o alimento "base" ("Banana" antes de "Banana, doce em calda").
    score -= Math.min(searchName.length, 60) / 6;
    return score;
}

function toIndexed(food: {
    id: string;
    name: string;
    portion: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    isSystem: boolean;
}): IndexedFood {
    const name = food.name || '';
    return {
        id: food.id,
        name,
        portion: food.portion || '100g',
        calories: Number(food.calories || 0),
        protein: Number(food.protein || 0),
        carbs: Number(food.carbs || 0),
        fat: Number(food.fat || 0),
        isSystem: Boolean(food.isSystem),
        source: 'local',
        key: normalizeFoodName(name),
        searchName: normalizeForSearch(name),
    };
}

const foodSelect = {
    id: true,
    name: true,
    portion: true,
    calories: true,
    protein: true,
    carbs: true,
    fat: true,
    isSystem: true,
} as const;

let systemIndex: { foods: IndexedFood[]; loadedAt: number } | null = null;
let systemIndexLoading: Promise<IndexedFood[]> | null = null;

async function getSystemFoodIndex(): Promise<IndexedFood[]> {
    if (systemIndex && Date.now() - systemIndex.loadedAt < INDEX_TTL_MS) return systemIndex.foods;
    if (!systemIndexLoading) {
        systemIndexLoading = prisma.food
            .findMany({ where: { isSystem: true }, select: foodSelect, orderBy: { name: 'asc' } })
            .then((rows) => {
                const foods = rows.map(toIndexed);
                systemIndex = { foods, loadedAt: Date.now() };
                return foods;
            })
            .finally(() => {
                systemIndexLoading = null;
            });
    }
    return systemIndexLoading;
}

export function invalidateFoodIndex() {
    systemIndex = null;
}

/** Ids de usuários cujos alimentos próprios a sessão pode ver (o personal, ou o personal do aluno). */
export async function getVisibleCreatorIds(user: { id?: string; role?: string } | null | undefined): Promise<string[]> {
    if (!user?.id) return [];
    if (user.role === 'PERSONAL') return [user.id];
    if (user.role === 'STUDENT') {
        const student = await prisma.student.findUnique({
            where: { userId: user.id },
            select: { personal: { select: { userId: true } } },
        });
        return student?.personal?.userId ? [student.personal.userId] : [];
    }
    return [];
}

async function persistImportedFoods(foods: AuditedFood[]) {
    if (foods.length === 0) return;

    const seen = new Set<string>();
    const uniqueFoods = foods.filter((food) => {
        const key = normalizeFoodName(food.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    if (uniqueFoods.length === 0) return;

    const existing = await prisma.food.findMany({
        where: { name: { in: uniqueFoods.map((food) => food.name) } },
        select: { name: true },
    });
    const existingKeys = new Set(existing.map((food) => normalizeFoodName(food.name)));

    const dataToCreate = uniqueFoods
        .filter((food) => !existingKeys.has(normalizeFoodName(food.name)))
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

    await prisma.food.createMany({ data: dataToCreate });
    invalidateFoodIndex();
}

function searchInAuditedDataset(normalizedQuery: string): IndexedFood[] {
    return (auditedFoods as AuditedFood[])
        .map((food, index) => ({
            ...toIndexed({
                id: `audit_${index}_${normalizeFoodName(food.name).replace(/\s+/g, '_')}`,
                name: food.name,
                portion: food.portion,
                calories: food.calories,
                protein: food.protein,
                carbs: food.carbs,
                fat: food.fat,
                isSystem: true,
            }),
        }))
        .filter((food) => matchesQuery(food.searchName, normalizedQuery));
}

/**
 * Busca sem acento/caixa, multi-palavra ("feijao carioca" encontra "Feijão, carioca, cozido").
 * Mesmo formato de resposta usado pelo app iOS e pela troca de alimentos do aluno.
 */
export async function searchFoods(query: string, creatorIds: string[], limit = 20): Promise<SearchFoodResult[]> {
    const normalizedQuery = normalizeForSearch(query);
    if (normalizedQuery.length < 2) return [];
    const take = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const [systemFoods, customRows] = await Promise.all([
        getSystemFoodIndex(),
        creatorIds.length > 0
            ? prisma.food.findMany({
                where: { isSystem: false, createdById: { in: creatorIds } },
                select: foodSelect,
                take: 2000,
            })
            : Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    let matches: IndexedFood[] = [];
    for (const food of [...systemFoods, ...customRows.map(toIndexed)]) {
        if (!food.key || seen.has(food.key) || !matchesQuery(food.searchName, normalizedQuery)) continue;
        seen.add(food.key);
        matches.push(food);
    }

    // Fallback auditado para bases locais ainda não populadas.
    if (matches.length === 0) {
        const audited = searchInAuditedDataset(normalizedQuery).slice(0, 60);
        if (audited.length > 0) {
            await persistImportedFoods(audited);
            matches = audited;
        }
    }

    return matches
        .map((food) => ({ food, score: scoreFood(food.searchName, normalizedQuery, food.isSystem) }))
        .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name, 'pt-BR'))
        .slice(0, take)
        .map(({ food }) => {
            const { key: _key, searchName: _searchName, ...result } = food;
            return result;
        });
}
