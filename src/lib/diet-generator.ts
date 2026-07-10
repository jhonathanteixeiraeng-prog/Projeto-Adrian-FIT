import { tacoFoods, type TacoFood, type FoodGroup, type RestrictionTag } from './taco-foods';

export interface FoodInput {
    id: string;
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface StudentData {
    weight: number; // kg
    height: number; // cm
    age: number; // years
    gender: 'MALE' | 'FEMALE';
    activityLevel: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
    goal: 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';
    // Mantido por compatibilidade. A geração automática usa apenas a base
    // curada de alimentos saudáveis (taco-foods); alimentos do banco seguem
    // disponíveis para inclusão manual na dieta.
    foods?: FoodInput[];
    // Restrições alimentares em texto livre (campo Student.restrictions).
    restrictions?: string;
}

interface MealPlan {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    meals: GeneratedMeal[];
}

interface GeneratedMeal {
    name: string;
    time: string;
    foods: GeneratedFood[];
}

interface GeneratedFood {
    foodId: string;
    name: string;
    quantity: number;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    substitutionNote?: string;
}

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/gi, ' ')
        .toLowerCase()
        .trim();
}

// ==========================================
// Restrições alimentares
// ==========================================

function getExcludedTags(restrictions: string): Set<RestrictionTag> {
    const excluded = new Set<RestrictionTag>();
    if (!restrictions) return excluded;

    if (/\bvegan[oa]?\b/.test(restrictions)) {
        ['carne', 'carne-vermelha', 'porco', 'peixe', 'ovo', 'lactose'].forEach((tag) =>
            excluded.add(tag as RestrictionTag)
        );
    }
    if (/vegetarian/.test(restrictions)) {
        ['carne', 'carne-vermelha', 'porco', 'peixe'].forEach((tag) =>
            excluded.add(tag as RestrictionTag)
        );
    }
    if (/lactose|laticinio|\bleite\b/.test(restrictions)) excluded.add('lactose');
    if (/gluten|celiac|doenca celiaca/.test(restrictions)) excluded.add('gluten');
    if (/\bovos?\b/.test(restrictions)) excluded.add('ovo');
    if (/peixe|pescado|frutos do mar|marisco|camarao|atum|sardinha|salmao|tilapia/.test(restrictions)) {
        excluded.add('peixe');
    }
    if (/amendoim|castanha|amendoa|oleaginosa|nozes/.test(restrictions)) excluded.add('oleaginosa');
    if (/carne vermelha|carne bovina|\bboi\b/.test(restrictions)) excluded.add('carne-vermelha');
    if (/porco|suin[oa]|bacon/.test(restrictions)) excluded.add('porco');

    return excluded;
}

// Palavras genéricas de preparo/medida que não identificam o alimento.
const NAME_STOPWORDS = new Set([
    'cozido', 'cozida', 'grelhado', 'grelhada', 'assado', 'assada', 'refogado', 'refogada',
    'mexidos', 'desfiado', 'moida', 'magra', 'integral', 'natural', 'desnatado', 'frescal',
    'fresca', 'branco', 'preto', 'carioca', 'verde', 'extra', 'virgem', 'flocos', 'pouco',
    'oleo', 'lata', 'sopa', 'file', 'posta', 'fatia', 'unidade', 'media', 'medio',
]);

function isFoodMentioned(food: TacoFood, restrictions: string): boolean {
    if (!restrictions) return false;
    const tokens = normalizeText(food.name)
        .split(/\s+/)
        .filter((token) => token.length >= 4 && !NAME_STOPWORDS.has(token));
    return tokens.some((token) => restrictions.includes(token));
}

function getAvailableFoods(restrictionsRaw?: string): TacoFood[] {
    const restrictions = normalizeText(restrictionsRaw || '');
    const excludedTags = getExcludedTags(restrictions);

    return tacoFoods.filter((food) => {
        if (food.tags.some((tag) => excludedTags.has(tag))) return false;
        if (isFoodMentioned(food, restrictions)) return false;
        return true;
    });
}

// ==========================================
// Templates de refeição (prato brasileiro)
// ==========================================

interface TemplateSlot {
    groups: FoodGroup[];
    share: number; // fração das calorias da refeição
    fallbackGroups?: FoodGroup[]; // usados se nenhum candidato nos grupos principais
    optional?: boolean;
}

interface MealTemplate {
    slots: TemplateSlot[];
}

const PROTEIN_GROUPS: FoodGroup[] = ['ave', 'carne', 'peixe', 'porco'];
const PROTEIN_FALLBACK: FoodGroup[] = ['ovo', 'leguminosa', 'laticinio'];

const breakfastTemplates: MealTemplate[] = [
    {
        slots: [
            { groups: ['ovo'], share: 0.35, fallbackGroups: ['laticinio', 'oleaginosa'] },
            { groups: ['pao'], share: 0.40, fallbackGroups: ['tapioca', 'cereal', 'tuberculo'] },
            { groups: ['fruta'], share: 0.25 },
        ],
    },
    {
        slots: [
            { groups: ['tapioca'], share: 0.45, fallbackGroups: ['pao', 'cereal'] },
            { groups: ['ovo', 'laticinio'], share: 0.35, fallbackGroups: ['oleaginosa'] },
            { groups: ['fruta'], share: 0.20 },
        ],
    },
    {
        slots: [
            { groups: ['laticinio'], share: 0.35, fallbackGroups: ['ovo', 'suplemento'] },
            { groups: ['cereal'], share: 0.40, fallbackGroups: ['pao', 'tapioca'] },
            { groups: ['fruta'], share: 0.25 },
        ],
    },
    {
        slots: [
            { groups: ['pao'], share: 0.40, fallbackGroups: ['tapioca', 'cereal'] },
            { groups: ['laticinio'], share: 0.35, fallbackGroups: ['ovo'] },
            { groups: ['fruta'], share: 0.25 },
        ],
    },
];

const mainMealTemplates: MealTemplate[] = [
    {
        // Clássico: arroz, feijão, proteína, legume, salada
        slots: [
            { groups: ['arroz'], share: 0.28 },
            { groups: ['feijao'], share: 0.14, fallbackGroups: ['leguminosa'] },
            { groups: PROTEIN_GROUPS, share: 0.38, fallbackGroups: PROTEIN_FALLBACK },
            { groups: ['legume'], share: 0.12 },
            { groups: ['folhoso'], share: 0.04, optional: true },
            { groups: ['azeite'], share: 0.04, optional: true },
        ],
    },
    {
        // Tubérculo: batata-doce/mandioca/inhame + proteína + legumes
        slots: [
            { groups: ['tuberculo'], share: 0.40, fallbackGroups: ['arroz'] },
            { groups: PROTEIN_GROUPS, share: 0.40, fallbackGroups: PROTEIN_FALLBACK },
            { groups: ['legume'], share: 0.14 },
            { groups: ['azeite'], share: 0.06, optional: true },
        ],
    },
    {
        // Leguminosa: arroz + lentilha/grão-de-bico + proteína
        slots: [
            { groups: ['arroz'], share: 0.26 },
            { groups: ['leguminosa'], share: 0.16, fallbackGroups: ['feijao'] },
            { groups: PROTEIN_GROUPS, share: 0.38, fallbackGroups: PROTEIN_FALLBACK },
            { groups: ['legume'], share: 0.14 },
            { groups: ['azeite'], share: 0.06, optional: true },
        ],
    },
    {
        // Massa: macarrão + proteína + legumes
        slots: [
            { groups: ['massa'], share: 0.42, fallbackGroups: ['arroz', 'tuberculo'] },
            { groups: ['ave', 'carne'], share: 0.38, fallbackGroups: [...PROTEIN_GROUPS, ...PROTEIN_FALLBACK] },
            { groups: ['legume'], share: 0.14 },
            { groups: ['azeite'], share: 0.06, optional: true },
        ],
    },
];

const snackTemplates: MealTemplate[] = [
    {
        slots: [
            { groups: ['laticinio'], share: 0.55, fallbackGroups: ['ovo', 'suplemento'] },
            { groups: ['fruta'], share: 0.45 },
        ],
    },
    {
        slots: [
            { groups: ['fruta'], share: 0.45 },
            { groups: ['oleaginosa'], share: 0.55, fallbackGroups: ['laticinio', 'ovo'] },
        ],
    },
    {
        slots: [
            { groups: ['pao'], share: 0.50, fallbackGroups: ['tapioca', 'fruta'] },
            { groups: ['laticinio'], share: 0.50, fallbackGroups: ['ovo'] },
        ],
    },
    {
        slots: [
            { groups: ['suplemento'], share: 0.55, fallbackGroups: ['laticinio', 'ovo'] },
            { groups: ['fruta'], share: 0.45 },
        ],
    },
    {
        slots: [
            { groups: ['ovo'], share: 0.55, fallbackGroups: ['laticinio', 'oleaginosa'] },
            { groups: ['fruta'], share: 0.45 },
        ],
    },
];

const supperTemplates: MealTemplate[] = [
    {
        slots: [{ groups: ['laticinio'], share: 1, fallbackGroups: ['ovo', 'fruta'] }],
    },
    {
        slots: [
            { groups: ['laticinio'], share: 0.6, fallbackGroups: ['ovo'] },
            { groups: ['fruta'], share: 0.4 },
        ],
    },
    {
        slots: [
            { groups: ['ovo'], share: 0.6, fallbackGroups: ['laticinio', 'oleaginosa'] },
            { groups: ['fruta'], share: 0.4 },
        ],
    },
];

const templatesByMealType: Record<string, MealTemplate[]> = {
    BREAKFAST: breakfastTemplates,
    LUNCH: mainMealTemplates,
    DINNER: mainMealTemplates,
    SNACK: snackTemplates,
    SUPPER: supperTemplates,
};

// ==========================================
// Seleção de alimentos
// ==========================================

function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function candidatesForSlot(slot: TemplateSlot, foods: TacoFood[]): TacoFood[] {
    const primary = foods.filter((food) => slot.groups.includes(food.group));
    if (primary.length > 0) return primary;
    if (slot.fallbackGroups) {
        return foods.filter((food) => slot.fallbackGroups!.includes(food.group));
    }
    return [];
}

function isTemplateFeasible(template: MealTemplate, foods: TacoFood[]): boolean {
    return template.slots.every(
        (slot) => slot.optional || candidatesForSlot(slot, foods).length > 0
    );
}

function pickFood(candidates: TacoFood[], usedIds: Set<string>): TacoFood | null {
    if (candidates.length === 0) return null;
    const unused = candidates.filter((food) => !usedIds.has(food.id));
    const pool = unused.length > 0 ? unused : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
}

function roundToStep(value: number, step: number) {
    return Math.round(value / step) * step;
}

function clampQty(value: number, food: TacoFood) {
    return Math.min(Math.max(roundToStep(value, food.step), food.step), food.maxQty);
}

// ==========================================
// Cálculos energéticos
// ==========================================

export function calculateBMR(weight: number, height: number, age: number, gender: 'MALE' | 'FEMALE'): number {
    // Harris-Benedict Equation Revised
    if (gender === 'MALE') {
        return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
    } else {
        return 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
    }
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
    const multipliers: Record<string, number> = {
        SEDENTARY: 1.2,
        LIGHT: 1.375,
        MODERATE: 1.55,
        ACTIVE: 1.725,
        VERY_ACTIVE: 1.9,
    };
    return bmr * (multipliers[activityLevel] || 1.2);
}

export function calculateTargetCalories(tdee: number, goal: string): number {
    switch (goal) {
        case 'WEIGHT_LOSS':
            return tdee - 500;
        case 'MUSCLE_GAIN':
            return tdee + 300;
        case 'MAINTENANCE':
        default:
            return tdee;
    }
}

// ==========================================
// Ajuste de macros
// ==========================================

interface PlanItem {
    food: TacoFood;
    quantity: number;
    mealIndex: number;
}

function totalsOf(items: PlanItem[]) {
    return items.reduce(
        (acc, item) => {
            acc.calories += item.food.calories * item.quantity;
            acc.protein += item.food.protein * item.quantity;
            acc.carbs += item.food.carbs * item.quantity;
            acc.fat += item.food.fat * item.quantity;
            return acc;
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
}

// Ajusta as quantidades (em passos de porção caseira) até aproximar as
// calorias e a proteína das metas, dentro dos limites práticos de porção.
function fitMacros(items: PlanItem[], targetCalories: number, targetProtein: number) {
    const calTolerance = targetCalories * 0.05;
    const proteinTolerance = Math.max(targetProtein * 0.05, 5);

    const proteinDensity = (food: TacoFood) =>
        food.calories > 0 ? food.protein / food.calories : 0;

    const canIncrease = (item: PlanItem) => item.quantity + item.food.step <= item.food.maxQty + 1e-9;
    const canDecrease = (item: PlanItem) => item.quantity - item.food.step >= item.food.step - 1e-9;

    for (let iteration = 0; iteration < 120; iteration++) {
        const totals = totalsOf(items);
        const proteinGap = targetProtein - totals.protein;
        const calorieGap = targetCalories - totals.calories;

        let adjusted = false;

        if (proteinGap > proteinTolerance) {
            // Falta proteína: aumenta a fonte mais proteica disponível.
            const candidates = items
                .filter(canIncrease)
                .filter((item) => proteinDensity(item.food) > 0.05)
                .sort((a, b) => proteinDensity(b.food) - proteinDensity(a.food));
            if (candidates.length > 0) {
                candidates[0].quantity = roundToStep(candidates[0].quantity + candidates[0].food.step, candidates[0].food.step);
                adjusted = true;
            }
        } else if (proteinGap < -proteinTolerance) {
            const candidates = items
                .filter(canDecrease)
                .filter((item) => proteinDensity(item.food) > 0.05)
                .sort((a, b) => proteinDensity(b.food) - proteinDensity(a.food));
            if (candidates.length > 0) {
                candidates[0].quantity = roundToStep(candidates[0].quantity - candidates[0].food.step, candidates[0].food.step);
                adjusted = true;
            }
        }

        if (!adjusted) {
            if (calorieGap > calTolerance) {
                // Faltam calorias: aumenta fontes de energia (pouca proteína).
                const candidates = items
                    .filter(canIncrease)
                    .sort((a, b) => proteinDensity(a.food) - proteinDensity(b.food));
                if (candidates.length > 0) {
                    candidates[0].quantity = roundToStep(candidates[0].quantity + candidates[0].food.step, candidates[0].food.step);
                    adjusted = true;
                }
            } else if (calorieGap < -calTolerance) {
                const candidates = items
                    .filter(canDecrease)
                    .sort((a, b) => proteinDensity(a.food) - proteinDensity(b.food));
                if (candidates.length > 0) {
                    candidates[0].quantity = roundToStep(candidates[0].quantity - candidates[0].food.step, candidates[0].food.step);
                    adjusted = true;
                }
            }
        }

        if (!adjusted) break;
    }
}

// ==========================================
// Substituições
// ==========================================

function formatQty(value: number) {
    const rounded = Math.round(value * 10) / 10;
    return String(rounded).replace('.', ',');
}

function buildSubstitutionNote(item: PlanItem, availableFoods: TacoFood[]): string | undefined {
    const targetCalories = item.food.calories * item.quantity;
    const options = shuffle(
        availableFoods.filter(
            (food) => food.group === item.food.group && food.id !== item.food.id
        )
    ).slice(0, 2);

    if (options.length === 0) return undefined;

    const parts = options.map((sub) => {
        const qty = clampQty(targetCalories / sub.calories, sub);
        return `${sub.name} (${formatQty(qty)} × ${sub.portion})`;
    });

    return `Pode substituir por: ${parts.join(' ou ')}`;
}

// ==========================================
// Geração do plano
// ==========================================

export function generateDietPlan(data: StudentData): MealPlan {
    const bmr = calculateBMR(data.weight, data.height, data.age, data.gender);
    const tdee = calculateTDEE(bmr, data.activityLevel);
    const targetCalories = calculateTargetCalories(tdee, data.goal);
    const availableFoods = getAvailableFoods(data.restrictions);

    const proteinRatio = data.goal === 'WEIGHT_LOSS' ? 0.35 : 0.3;

    // Teto fisiológico de ~2,2g/kg: evita metas de proteína irreais quando o
    // gasto calórico é alto em relação ao peso corporal.
    const targetProtein = Math.min((targetCalories * proteinRatio) / 4, data.weight * 2.2);

    const mealsStructure = [
        { name: 'Café da Manhã', time: '07:00', type: 'BREAKFAST', ratio: 0.25 },
        { name: 'Lanche da Manhã', time: '10:00', type: 'SNACK', ratio: 0.10 },
        { name: 'Almoço', time: '13:00', type: 'LUNCH', ratio: 0.30 },
        { name: 'Lanche da Tarde', time: '16:00', type: 'SNACK', ratio: 0.10 },
        { name: 'Jantar', time: '19:00', type: 'DINNER', ratio: 0.20 },
        { name: 'Ceia', time: '22:00', type: 'SUPPER', ratio: 0.05 },
    ];

    const usedIds = new Set<string>();
    const usedTemplates = new Map<string, MealTemplate>();
    const items: PlanItem[] = [];
    const mealFoodItems: PlanItem[][] = mealsStructure.map(() => []);

    mealsStructure.forEach((structure, mealIndex) => {
        const mealCalories = targetCalories * structure.ratio;
        const templates = templatesByMealType[structure.type] || snackTemplates;

        const feasible = shuffle(templates).filter((template) =>
            isTemplateFeasible(template, availableFoods)
        );
        // Evita repetir o mesmo template em refeições do mesmo tipo no dia.
        const previous = usedTemplates.get(structure.type);
        const pool = feasible.filter((template) => template !== previous);
        const template = pool[0] || feasible[0] || templates[0];
        usedTemplates.set(structure.type, template);

        for (const slot of template.slots) {
            const candidates = candidatesForSlot(slot, availableFoods);
            const selected = pickFood(candidates, usedIds);
            if (!selected || selected.calories <= 0) continue;

            usedIds.add(selected.id);
            const quantity = clampQty((mealCalories * slot.share) / selected.calories, selected);
            const item: PlanItem = { food: selected, quantity, mealIndex };
            items.push(item);
            mealFoodItems[mealIndex].push(item);
        }
    });

    fitMacros(items, targetCalories, targetProtein);

    const generatedMeals: GeneratedMeal[] = mealsStructure.map((structure, mealIndex) => ({
        name: structure.name,
        time: structure.time,
        foods: mealFoodItems[mealIndex].map((item) => ({
            foodId: item.food.id,
            name: item.food.name,
            quantity: item.quantity,
            portion: item.food.portion,
            calories: item.food.calories,
            protein: item.food.protein,
            carbs: item.food.carbs,
            fat: item.food.fat,
            substitutionNote: buildSubstitutionNote(item, availableFoods),
        })),
    }));

    const totals = totalsOf(items);

    // Mantém o gerador estável se a lista ficar muito filtrada por restrições.
    const safeCalories = totals.calories > 0 ? totals.calories : targetCalories;
    const safeProtein = totals.protein > 0 ? totals.protein : targetProtein;
    const safeCarbs = totals.carbs > 0 ? totals.carbs : (targetCalories * 0.4) / 4;
    const safeFat = totals.fat > 0 ? totals.fat : (targetCalories * 0.3) / 9;

    return {
        calories: Math.round(safeCalories),
        protein: Math.round(safeProtein),
        carbs: Math.round(safeCarbs),
        fat: Math.round(safeFat),
        meals: generatedMeals,
    };
}
