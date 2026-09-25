import { normalizeDietFood, withUnambiguousQuantity } from '@/lib/diet-normalizer';
import { calculateBMR, calculateTDEE } from '@/lib/diet-generator';
import { normalizeText } from '@/lib/utils';
import {
    amountToQuantity,
    describePortion,
    formatAmount,
    parseAmount,
    quantityToAmount,
    resolveUnit,
    type UnitKey,
} from './units';

export type EditorKind = 'plan' | 'template';

export interface EditorFood {
    uid: string;
    foodId?: string;
    name: string;
    /** Porção base a que os macros se referem. */
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    /** Multiplicador da porção base (NaN enquanto a quantidade digitada for inválida). */
    quantity: number;
    /** Texto digitado no campo de quantidade, na unidade `unit`. */
    amount: string;
    unit: UnitKey;
    notes: string;
    substitutionNote: string;
    source?: string;
}

export interface EditorMeal {
    uid: string;
    /** Id da refeição no banco; permite atualizar no lugar e preservar as marcações do aluno. */
    dbId?: string;
    name: string;
    time: string;
    notes: string;
    foods: EditorFood[];
    collapsed: boolean;
}

export interface EditorTargets {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
}

export interface EditorState {
    title: string;
    studentId: string;
    startDate: string;
    endDate: string;
    active: boolean;
    targets: EditorTargets;
    meals: EditorMeal[];
}

export interface MacroTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export type MacroKey = keyof MacroTotals;

/** Alimento vindo da busca, dos recentes/favoritos ou criado na hora. */
export interface FoodSnapshot {
    id?: string;
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    isSystem?: boolean;
    source?: string;
}

export interface StudentProfile {
    id: string;
    name: string;
    email?: string | null;
    avatar?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    height?: number | null;
    weight?: number | null;
    goal?: string | null;
    activityLevel?: string | null;
    restrictions?: string | null;
}

let uidSequence = 0;
export function newUid(prefix: string) {
    uidSequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${uidSequence.toString(36)}`;
}

const toNumber = (value: unknown) => {
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, decimals: number) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};

// ---------------------------------------------------------------------------
// Datas (inputs type="date" usam AAAA-MM-DD no fuso local)
// ---------------------------------------------------------------------------

export function dateInputFromDate(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function defaultDateRange(days = 30) {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);
    return { startDate: dateInputFromDate(start), endDate: dateInputFromDate(end) };
}

/** Datas gravadas pelo servidor (ISO) → AAAA-MM-DD. Usa UTC para 00:00 ou 12:00 UTC e dia local caso contrário. */
export function dateInputFromIso(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const isDateOnly =
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0 &&
        (date.getUTCHours() === 0 || date.getUTCHours() === 12);
    return isDateOnly ? date.toISOString().slice(0, 10) : dateInputFromDate(date);
}

export function formatDateBR(value: string | null | undefined) {
    const input = dateInputFromIso(value);
    if (!input) return '';
    const [year, month, day] = input.split('-');
    return `${day}/${month}/${year}`;
}

// ---------------------------------------------------------------------------
// Conversões API ⇄ editor
// ---------------------------------------------------------------------------

function isPersistentFoodId(id: unknown): id is string {
    return typeof id === 'string' && id.length > 0 && !id.startsWith('audit_');
}

function buildFood(values: {
    foodId?: string;
    name: string;
    portion: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    quantity: number;
    notes?: string;
    substitutionNote?: string;
    displayUnit?: string | null;
    source?: string;
}): EditorFood {
    const option = resolveUnit(describePortion(values.portion), values.displayUnit);
    return {
        uid: newUid('food'),
        foodId: values.foodId,
        name: values.name,
        portion: values.portion,
        calories: values.calories,
        protein: values.protein,
        carbs: values.carbs,
        fat: values.fat,
        quantity: values.quantity,
        amount: formatAmount(quantityToAmount(values.quantity, option), option.key),
        unit: option.key,
        notes: values.notes ?? '',
        substitutionNote: values.substitutionNote ?? '',
        source: values.source,
    };
}

/** Alimento já no formato canônico devolvido pela API (não normaliza de novo). */
export function foodFromStored(raw: any): EditorFood {
    const quantity = toNumber(raw?.quantity);
    return buildFood({
        foodId: isPersistentFoodId(raw?.foodId) ? raw.foodId : undefined,
        name: String(raw?.name || 'Alimento'),
        portion: String(raw?.portion || '100g'),
        calories: toNumber(raw?.calories),
        protein: toNumber(raw?.protein),
        carbs: toNumber(raw?.carbs),
        fat: toNumber(raw?.fat),
        quantity: quantity > 0 ? quantity : 1,
        notes: typeof raw?.notes === 'string' ? raw.notes : '',
        substitutionNote: typeof raw?.substitutionNote === 'string' ? raw.substitutionNote : '',
        displayUnit: typeof raw?.displayUnit === 'string' ? raw.displayUnit : null,
        source: typeof raw?.source === 'string' ? raw.source : undefined,
    });
}

/** Alimento bruto (IA, gerador automático): passa pelo normalizador como o servidor faria. */
export function foodFromRaw(raw: any, source?: string): EditorFood {
    const normalized = normalizeDietFood(raw);
    return foodFromStored({ ...normalized, foodId: raw?.foodId, source: source ?? normalized.source });
}

export function foodFromSnapshot(snapshot: FoodSnapshot): EditorFood {
    const normalized = normalizeDietFood({ ...snapshot, quantity: 1 });
    const food = foodFromStored({
        ...normalized,
        foodId: snapshot.id,
        source: snapshot.source ?? (snapshot.isSystem === false ? 'custom' : undefined),
    });
    return food;
}

export function snapshotFromFood(food: EditorFood): FoodSnapshot {
    return {
        id: food.foodId,
        name: food.name,
        portion: food.portion,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        source: food.source,
    };
}

export function foodKey(food: { id?: string; foodId?: string; name: string }) {
    return food.id || food.foodId || normalizeText(food.name);
}

function mealFromStored(meal: any, foods: unknown): EditorMeal {
    return {
        uid: newUid('meal'),
        dbId: typeof meal?.id === 'string' ? meal.id : undefined,
        name: String(meal?.name || ''),
        time: String(meal?.time || ''),
        notes: typeof meal?.notes === 'string' ? meal.notes : '',
        foods: (Array.isArray(foods) ? foods : []).map(foodFromStored),
        collapsed: false,
    };
}

function targetText(value: unknown, total?: number) {
    const parsed = toNumber(value);
    if (!(parsed > 0)) return '';
    const rounded = Math.round(parsed);
    if (total !== undefined && total > 0 && rounded === Math.round(total)) return '';
    return String(rounded);
}

export function targetsFromValues(
    values: { calories?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown } | null | undefined,
    totals?: MacroTotals
): EditorTargets {
    return {
        calories: targetText(values?.calories, totals?.calories),
        protein: targetText(values?.protein, totals?.protein),
        carbs: targetText(values?.carbs, totals?.carbs),
        fat: targetText(values?.fat, totals?.fat),
    };
}

export const EMPTY_TARGETS: EditorTargets = { calories: '', protein: '', carbs: '', fat: '' };

export function emptyState(): EditorState {
    const { startDate, endDate } = defaultDateRange();
    return {
        title: '',
        studentId: '',
        startDate,
        endDate,
        active: true,
        targets: { ...EMPTY_TARGETS },
        meals: [createMeal([])],
    };
}

/** Plano de GET /api/diets/[id] (alimentos já normalizados em `meals[].foods`). */
export function stateFromPlan(plan: any): EditorState {
    const meals = (plan?.meals ?? []).map((meal: any) => mealFromStored(meal, meal?.foods ?? meal?.items));
    const totals = planTotals(meals);
    return {
        title: String(plan?.title || ''),
        studentId: String(plan?.studentId || ''),
        startDate: dateInputFromIso(plan?.startDate),
        endDate: dateInputFromIso(plan?.endDate),
        active: Boolean(plan?.active),
        targets: targetsFromValues(plan, totals),
        meals,
    };
}

/** Modelo de GET /api/diet-templates (alimentos normalizados em `meals[].items`). */
export function mealsFromTemplate(template: any): EditorMeal[] {
    return (template?.meals ?? []).map((meal: any) => ({
        ...mealFromStored(meal, meal?.items ?? meal?.foods),
        dbId: undefined,
    }));
}

/** Copia refeições para um novo plano (sem ids do banco). */
export function cloneMealsForNewPlan(meals: EditorMeal[]): EditorMeal[] {
    return meals.map((meal) => ({ ...meal, uid: newUid('meal'), dbId: undefined, foods: meal.foods.map((food) => ({ ...food, uid: newUid('food') })) }));
}

export function toApiFood(food: EditorFood) {
    const safe = withUnambiguousQuantity({
        portion: food.portion,
        quantity: round(food.quantity, 4),
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
    });
    return {
        foodId: food.foodId,
        name: food.name.trim() || 'Alimento',
        portion: safe.portion,
        quantity: safe.quantity,
        calories: safe.calories,
        protein: safe.protein,
        carbs: safe.carbs,
        fat: safe.fat,
        notes: food.notes.trim() || undefined,
        substitutionNote: food.substitutionNote.trim() || undefined,
        // Se a porção foi reescrita (quantidades muito grandes), a unidade volta a ser g/ml.
        displayUnit: safe.portion === food.portion ? food.unit : undefined,
        source: food.source,
    };
}

export function toApiMeals(meals: EditorMeal[], foodsKey: 'items' | 'foods', includeIds: boolean) {
    return meals.map((meal, index) => ({
        ...(includeIds && meal.dbId ? { id: meal.dbId } : {}),
        name: meal.name.trim() || `Refeição ${index + 1}`,
        time: meal.time || '12:00',
        notes: meal.notes.trim() || undefined,
        [foodsKey]: meal.foods.map(toApiFood),
    }));
}

// ---------------------------------------------------------------------------
// Totais, metas e validação
// ---------------------------------------------------------------------------

export const ZERO_TOTALS: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export function foodTotals(food: EditorFood): MacroTotals {
    const quantity = Number.isFinite(food.quantity) ? food.quantity : 0;
    return {
        calories: food.calories * quantity,
        protein: food.protein * quantity,
        carbs: food.carbs * quantity,
        fat: food.fat * quantity,
    };
}

export function sumTotals(items: MacroTotals[]): MacroTotals {
    return items.reduce(
        (acc, item) => ({
            calories: acc.calories + item.calories,
            protein: acc.protein + item.protein,
            carbs: acc.carbs + item.carbs,
            fat: acc.fat + item.fat,
        }),
        { ...ZERO_TOTALS }
    );
}

export function mealTotals(meal: EditorMeal) {
    return sumTotals(meal.foods.map(foodTotals));
}

export function planTotals(meals: EditorMeal[]) {
    return sumTotals(meals.map(mealTotals));
}

export function parseTarget(text: string): number | null {
    const value = parseAmount(text);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Valores gravados no plano: a meta digitada, ou a soma dos alimentos quando vazia. */
export function resolvedTargets(targets: EditorTargets, totals: MacroTotals): MacroTotals {
    return {
        calories: parseTarget(targets.calories) ?? Math.round(totals.calories),
        protein: parseTarget(targets.protein) ?? Math.round(totals.protein),
        carbs: parseTarget(targets.carbs) ?? Math.round(totals.carbs),
        fat: parseTarget(targets.fat) ?? Math.round(totals.fat),
    };
}

export function targetsFromTotals(totals: MacroTotals): EditorTargets {
    return {
        calories: String(Math.round(totals.calories)),
        protein: String(Math.round(totals.protein)),
        carbs: String(Math.round(totals.carbs)),
        fat: String(Math.round(totals.fat)),
    };
}

/** Representação estável do conteúdo para detectar alterações não salvas. */
export function snapshotOf(state: EditorState, kind: EditorKind): string {
    return JSON.stringify({
        title: state.title.trim(),
        plan: kind === 'plan' ? [state.studentId, state.startDate, state.endDate, state.active] : null,
        targets: [state.targets.calories, state.targets.protein, state.targets.carbs, state.targets.fat].map((value) => value.trim()),
        meals: state.meals.map((meal) => [
            meal.name.trim(),
            meal.time,
            meal.notes.trim(),
            meal.foods.map((food) => [
                food.foodId ?? '',
                food.name,
                food.portion,
                food.calories,
                food.protein,
                food.carbs,
                food.fat,
                Number.isFinite(food.quantity) ? round(food.quantity, 4) : 'invalid',
                food.unit,
                food.notes.trim(),
                food.substitutionNote.trim(),
            ]),
        ]),
    });
}

export interface EditorIssues {
    title?: string;
    student?: string;
    startDate?: string;
    endDate?: string;
    meals?: string;
    /** uids dos alimentos com quantidade inválida. */
    foods: Set<string>;
    count: number;
}

export function validateState(state: EditorState, kind: EditorKind): EditorIssues {
    const issues: EditorIssues = { foods: new Set(), count: 0 };
    if (!state.title.trim()) issues.title = 'Informe o título.';
    if (kind === 'plan') {
        if (!state.studentId) issues.student = 'Selecione o aluno.';
        if (!state.startDate) issues.startDate = 'Informe o início.';
        if (!state.endDate) issues.endDate = 'Informe o término.';
        else if (state.startDate && state.endDate < state.startDate) issues.endDate = 'O término deve ser depois do início.';
    }
    const foodCount = state.meals.reduce((total, meal) => total + meal.foods.length, 0);
    if (foodCount === 0) issues.meals = 'Adicione pelo menos um alimento.';
    state.meals.forEach((meal) =>
        meal.foods.forEach((food) => {
            if (!(Number.isFinite(food.quantity) && food.quantity > 0)) issues.foods.add(food.uid);
        })
    );
    issues.count =
        [issues.title, issues.student, issues.startDate, issues.endDate, issues.meals].filter(Boolean).length + issues.foods.size;
    return issues;
}

// ---------------------------------------------------------------------------
// Gasto energético e metas sugeridas
// ---------------------------------------------------------------------------

export type GoalKey = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';

export const GOAL_OPTIONS: { value: GoalKey; label: string; delta: number }[] = [
    { value: 'WEIGHT_LOSS', label: 'Emagrecimento (−500 kcal)', delta: -500 },
    { value: 'MAINTENANCE', label: 'Manutenção', delta: 0 },
    { value: 'MUSCLE_GAIN', label: 'Hipertrofia (+300 kcal)', delta: 300 },
];

export function normalizeGoal(raw?: string | null): GoalKey {
    const value = normalizeText(raw).toUpperCase();
    if (/WEIGHT_LOSS|EMAG|CUT|PERDA|SECAR|DEFINI/.test(value)) return 'WEIGHT_LOSS';
    if (/MUSCLE_GAIN|HIPER|BULK|GANHO|MASSA/.test(value)) return 'MUSCLE_GAIN';
    return 'MAINTENANCE';
}

export const ACTIVITY_LABELS: Record<string, string> = {
    SEDENTARY: 'sedentário',
    LIGHT: 'atividade leve',
    MODERATE: 'atividade moderada',
    ACTIVE: 'ativo',
    VERY_ACTIVE: 'muito ativo',
};

export function ageFrom(birthDate: string | null | undefined): number | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getUTCFullYear();
    const monthDiff = today.getMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getUTCDate())) age -= 1;
    return age >= 0 && age < 120 ? age : null;
}

export interface EnergyEstimate {
    age: number;
    tdee: number;
    goal: GoalKey;
    goalDelta: number;
    targetCalories: number;
    activityLevel: string;
    activityAssumed: boolean;
}

/** Harris-Benedict revisada × nível de atividade (mesmo cálculo do gerador automático). */
export function estimateEnergy(student: StudentProfile | null | undefined): EnergyEstimate | null {
    if (!student) return null;
    const weight = Number(student.weight);
    const height = Number(student.height);
    const age = ageFrom(student.birthDate);
    if (!(weight > 0) || !(height > 0) || age === null) return null;
    const activityLevel = student.activityLevel && ACTIVITY_LABELS[student.activityLevel] ? student.activityLevel : 'MODERATE';
    const bmr = calculateBMR(weight, height, age, student.gender === 'FEMALE' ? 'FEMALE' : 'MALE');
    const tdee = Math.round(calculateTDEE(bmr, activityLevel));
    const goal = normalizeGoal(student.goal);
    const goalDelta = GOAL_OPTIONS.find((option) => option.value === goal)?.delta ?? 0;
    return {
        age,
        tdee,
        goal,
        goalDelta,
        targetCalories: Math.max(1000, Math.round((tdee + goalDelta) / 10) * 10),
        activityLevel,
        activityAssumed: !student.activityLevel,
    };
}

/** Distribuição padrão (a mesma do gerador): proteína 30–35% limitada a 2,2 g/kg, gordura 25%, resto carboidrato. */
export function suggestTargets(calories: number, weight: number | null | undefined, goal: GoalKey): EditorTargets {
    const proteinRatio = goal === 'WEIGHT_LOSS' ? 0.35 : 0.3;
    const proteinCap = weight && weight > 0 ? weight * 2.2 : Number.POSITIVE_INFINITY;
    const protein = Math.round(Math.min((calories * proteinRatio) / 4, proteinCap));
    const fat = Math.round((calories * 0.25) / 9);
    const carbs = Math.round(Math.max((calories - protein * 4 - fat * 9) / 4, 20));
    return { calories: String(Math.round(calories)), protein: String(protein), carbs: String(carbs), fat: String(fat) };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const DEFAULT_MEALS = [
    { name: 'Café da manhã', time: '07:00' },
    { name: 'Lanche da manhã', time: '10:00' },
    { name: 'Almoço', time: '12:30' },
    { name: 'Lanche da tarde', time: '16:00' },
    { name: 'Jantar', time: '19:30' },
    { name: 'Ceia', time: '22:00' },
];

export function createMeal(existing: EditorMeal[]): EditorMeal {
    const used = new Set(existing.map((meal) => normalizeText(meal.name)));
    const next = DEFAULT_MEALS.find((meal) => !used.has(normalizeText(meal.name)));
    return {
        uid: newUid('meal'),
        name: next?.name ?? `Refeição ${existing.length + 1}`,
        time: next?.time ?? '12:00',
        notes: '',
        foods: [],
        collapsed: false,
    };
}

export type FoodPatch = Partial<Pick<EditorFood, 'amount' | 'unit' | 'notes' | 'substitutionNote' | 'name'>>;

export type EditorAction =
    | { type: 'load'; state: EditorState }
    | { type: 'set'; patch: Partial<Omit<EditorState, 'meals' | 'targets'>> }
    | { type: 'setTarget'; key: MacroKey; value: string }
    | { type: 'setTargets'; targets: EditorTargets }
    /** Ids do banco por uid da refeição (resposta do salvamento). */
    | { type: 'setMealIds'; ids: Record<string, string> }
    | { type: 'replaceMeals'; meals: EditorMeal[]; append?: boolean }
    | { type: 'addMeal'; meal: EditorMeal }
    | { type: 'updateMeal'; mealUid: string; patch: Partial<Pick<EditorMeal, 'name' | 'time' | 'notes' | 'collapsed'>> }
    | { type: 'removeMeal'; mealUid: string }
    | { type: 'duplicateMeal'; mealUid: string; newUid: string }
    | { type: 'moveMeal'; mealUid: string; delta: number }
    | { type: 'addFood'; mealUid: string; food: EditorFood }
    | { type: 'updateFood'; mealUid: string; foodUid: string; patch: FoodPatch }
    | { type: 'removeFood'; mealUid: string; foodUid: string }
    | { type: 'duplicateFood'; mealUid: string; foodUid: string; newUid: string }
    | { type: 'moveFood'; mealUid: string; foodUid: string; delta: number }
    | { type: 'moveFoodToMeal'; fromMealUid: string; foodUid: string; toMealUid: string };

function moveItem<T>(list: T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) return list;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    return next;
}

function applyFoodPatch(food: EditorFood, patch: FoodPatch): EditorFood {
    const next = { ...food, ...patch };
    const option = resolveUnit(describePortion(food.portion), next.unit);
    if (patch.unit !== undefined && patch.amount === undefined) {
        // Troca de unidade mantém a quantidade real e reescreve o texto na nova unidade.
        next.amount = Number.isFinite(food.quantity) ? formatAmount(quantityToAmount(food.quantity, option), option.key) : food.amount;
        next.quantity = food.quantity;
    } else if (patch.amount !== undefined) {
        const amount = parseAmount(patch.amount);
        next.quantity = Number.isFinite(amount) ? amountToQuantity(amount, option) : NaN;
    }
    next.unit = option.key;
    return next;
}

function mapMeal(state: EditorState, mealUid: string, update: (meal: EditorMeal) => EditorMeal): EditorState {
    return { ...state, meals: state.meals.map((meal) => (meal.uid === mealUid ? update(meal) : meal)) };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'load':
            return action.state;
        case 'set':
            return { ...state, ...action.patch };
        case 'setTarget':
            return { ...state, targets: { ...state.targets, [action.key]: action.value } };
        case 'setTargets':
            return { ...state, targets: action.targets };
        case 'setMealIds':
            return {
                ...state,
                meals: state.meals.map((meal) => (action.ids[meal.uid] ? { ...meal, dbId: action.ids[meal.uid] } : meal)),
            };
        case 'replaceMeals':
            return { ...state, meals: action.append ? [...state.meals, ...action.meals] : action.meals };
        case 'addMeal':
            return { ...state, meals: [...state.meals, action.meal] };
        case 'updateMeal':
            return mapMeal(state, action.mealUid, (meal) => ({ ...meal, ...action.patch }));
        case 'removeMeal':
            return { ...state, meals: state.meals.filter((meal) => meal.uid !== action.mealUid) };
        case 'duplicateMeal': {
            const index = state.meals.findIndex((meal) => meal.uid === action.mealUid);
            if (index < 0) return state;
            const source = state.meals[index];
            const copy: EditorMeal = {
                ...source,
                uid: action.newUid,
                dbId: undefined,
                name: `${source.name} (cópia)`,
                collapsed: false,
                foods: source.foods.map((food) => ({ ...food, uid: newUid('food') })),
            };
            const meals = [...state.meals];
            meals.splice(index + 1, 0, copy);
            return { ...state, meals };
        }
        case 'moveMeal': {
            const index = state.meals.findIndex((meal) => meal.uid === action.mealUid);
            return { ...state, meals: moveItem(state.meals, index, action.delta) };
        }
        case 'addFood':
            return mapMeal(state, action.mealUid, (meal) => ({ ...meal, collapsed: false, foods: [...meal.foods, action.food] }));
        case 'updateFood':
            return mapMeal(state, action.mealUid, (meal) => ({
                ...meal,
                foods: meal.foods.map((food) => (food.uid === action.foodUid ? applyFoodPatch(food, action.patch) : food)),
            }));
        case 'removeFood':
            return mapMeal(state, action.mealUid, (meal) => ({
                ...meal,
                foods: meal.foods.filter((food) => food.uid !== action.foodUid),
            }));
        case 'duplicateFood':
            return mapMeal(state, action.mealUid, (meal) => {
                const index = meal.foods.findIndex((food) => food.uid === action.foodUid);
                if (index < 0) return meal;
                const foods = [...meal.foods];
                foods.splice(index + 1, 0, { ...meal.foods[index], uid: action.newUid });
                return { ...meal, foods };
            });
        case 'moveFood':
            return mapMeal(state, action.mealUid, (meal) => ({
                ...meal,
                foods: moveItem(meal.foods, meal.foods.findIndex((food) => food.uid === action.foodUid), action.delta),
            }));
        case 'moveFoodToMeal': {
            if (action.fromMealUid === action.toMealUid) return state;
            const food = state.meals.find((meal) => meal.uid === action.fromMealUid)?.foods.find((item) => item.uid === action.foodUid);
            if (!food) return state;
            return {
                ...state,
                meals: state.meals.map((meal) => {
                    if (meal.uid === action.fromMealUid) return { ...meal, foods: meal.foods.filter((item) => item.uid !== action.foodUid) };
                    if (meal.uid === action.toMealUid) return { ...meal, collapsed: false, foods: [...meal.foods, food] };
                    return meal;
                }),
            };
        }
        default:
            return state;
    }
}
