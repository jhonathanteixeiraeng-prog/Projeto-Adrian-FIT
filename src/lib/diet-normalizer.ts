/**
 * Normalizador de alimentos de planos alimentares.
 *
 * Convenção canônica usada pelo app iOS (e a partir de agora por toda a stack):
 * - quantity: número multiplicador da porção base
 * - calories/protein/carbs/fat: macros na porção base descrita em `portion`
 * - totalCalories/totalProtein/totalCarbs/totalFat: macros totais para a quantidade servida
 *
 * O normalizador aceita dados legados em qualquer formato (string descritiva,
 * valores por 100 g, por unidade etc.) e converge para o formato canônico.
 */

export interface NormalizedDietFood {
    foodId?: string;
    name: string;
    portion: string;
    quantity: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    notes?: string;
    substitutionNote?: string;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
}

interface PortionInfo {
    baseValue: number;
    baseUnit: string;
    isMassReference: boolean; // true quando a porção base é uma massa/volume (g/ml)
}

const MASS_UNITS = /^(g|gramas?|ml|m[lL]|mg)$/i;
const HOUSEHOLD_UNITS = /\b(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos|pote|potes|lata|latas|concha|conchas|pedaco|pedaço|pedacos|pedaços|file|filé|file|posta|postas|bife|bifes|ovo|ovos|banana|bananas|maca|maça|laranja)\b/i;

function toNumber(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim();
        if (!normalized) return 0;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function parsePortion(portion: unknown): PortionInfo {
    const text = String(portion || '100g').replace(',', '.').trim().toLowerCase();

    // Caso explícito "100g" / "100 g"
    if (/^(100\s?g|100\s?ml)$/.test(text)) {
        return { baseValue: 100, baseUnit: text.includes('ml') ? 'ml' : 'g', isMassReference: true };
    }

    // Extrair massa/volume entre parênteses, ex: "1 unidade (80g)" ou "1 scoop (30g)"
    const parenMatch = text.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)$/);
    if (parenMatch) {
        return {
            baseValue: parseFloat(parenMatch[1]),
            baseUnit: parenMatch[2],
            isMassReference: true,
        };
    }

    // Extrair número no início, ex: "1 unidade", "4 colheres de sopa", "2 fatias"
    const leadingMatch = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (leadingMatch) {
        return {
            baseValue: parseFloat(leadingMatch[1]),
            baseUnit: leadingMatch[2].trim() || 'unidade',
            isMassReference: MASS_UNITS.test(leadingMatch[2].trim()),
        };
    }

    return { baseValue: 1, baseUnit: text || 'porção', isMassReference: false };
}

function parseQuantity(quantity: unknown, portionInfo: PortionInfo): number {
    // Número já é multiplicador na convenção canônica
    if (typeof quantity === 'number') {
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    }

    const text = String(quantity || '').replace(',', '.').trim().toLowerCase();
    if (!text) return 1;

    // Extrair o primeiro número decimal da string
    const numberMatch = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (!numberMatch) return 1;

    const value = parseFloat(numberMatch[1]);
    if (!Number.isFinite(value) || value <= 0) return 1;

    const rest = numberMatch[2].trim();

    // Se não há unidade, precisamos inferir o significado do número.
    if (!rest) {
        // Quando a porção base é uma referência de massa (ex: "100g") e o valor
        // é grande (>= 10), é muito provável que o usuário tenha digitado gramas
        // no editor web. Caso contrário, tratamos como multiplicador.
        if (portionInfo.isMassReference && value >= 10) {
            return portionInfo.baseValue > 0 ? value / portionInfo.baseValue : value / 100;
        }
        return value;
    }

    // Unidade de massa/volume (g, ml, mg)
    if (MASS_UNITS.test(rest)) {
        if (portionInfo.isMassReference && portionInfo.baseValue > 0) {
            return value / portionInfo.baseValue;
        }
        // Porção base não é massa (ex: "1 unidade") mas quantity veio em gramas:
        // não sabemos converter sem densidade; assumimos multiplicador para não zerar
        return value;
    }

    // Unidade caseira (unidade, fatia, colher etc.)
    if (HOUSEHOLD_UNITS.test(rest) || rest.length > 0) {
        // Se a porção base é uma referência de massa (ex: "100g") e a quantidade
        // veio em unidade caseira (ex: "4 fatias"), não sabemos o peso da unidade.
        // Interpretamos como multiplicador da porção base para evitar valores
        // próximos de zero.
        if (portionInfo.isMassReference) {
            return value;
        }
        if (portionInfo.baseValue > 0) {
            return value / portionInfo.baseValue;
        }
        return value;
    }

    return value;
}

/**
 * Decide se os macros parecem estar por 100 g ou já estão na porção base.
 *
 * Regra conservadora:
 * - Se portion é exatamente "100g" ou "100 g", macros são por 100 g.
 * - Se portion tem massa entre parênteses E essa massa é 100 g, macros são por 100 g.
 * - Caso contrário, assumimos que estão na porção base descrita (padrão do gerador local).
 */
function isPer100g(portionInfo: PortionInfo, portionText: string): boolean {
    const normalized = portionText.replace(',', '.').trim().toLowerCase();

    if (normalized === '100g' || normalized === '100 g') return true;
    if (normalized === '100ml' || normalized === '100 ml') return true;

    if (portionInfo.isMassReference && Math.abs(portionInfo.baseValue - 100) < 0.001) {
        return true;
    }

    return false;
}

export function normalizeDietFood(raw: any): NormalizedDietFood {
    const food = raw || {};

    const name = String(food.name || '').trim() || 'Alimento';
    const foodId = food.foodId ? String(food.foodId) : undefined;
    const portionText = String(food.portion || '100g').trim() || '100g';
    const notes = food.notes ? String(food.notes) : undefined;
    const substitutionNote = food.substitutionNote
        ? String(food.substitutionNote)
        : food.substitutionText
            ? String(food.substitutionText)
            : undefined;

    const portionInfo = parsePortion(portionText);
    const quantity = parseQuantity(food.quantity, portionInfo);

    let calories = toNumber(food.calories);
    let protein = toNumber(food.protein);
    let carbs = toNumber(food.carbs);
    let fat = toNumber(food.fat);

    // Se os macros estiverem por 100 g, convertemos para a porção base.
    // A porção base já está em `portionInfo.baseValue` (em g/ml).
    if (isPer100g(portionInfo, portionText) && portionInfo.baseValue > 0) {
        const factor = portionInfo.baseValue / 100;
        calories = Math.round(calories * factor * 100) / 100;
        protein = Math.round(protein * factor * 100) / 100;
        carbs = Math.round(carbs * factor * 100) / 100;
        fat = Math.round(fat * factor * 100) / 100;
    }

    // Macros por porção base × multiplicador = totais
    let totalCalories = Math.round(calories * quantity * 100) / 100;
    let totalProtein = Math.round(protein * quantity * 100) / 100;
    let totalCarbs = Math.round(carbs * quantity * 100) / 100;
    let totalFat = Math.round(fat * quantity * 100) / 100;

    // Salvaguarda: se há informação nutricional mas o total ficou zerado,
    // assumimos uma porção (quantity = 1) para não exibir "0 kcal" no app.
    const hasNutrition = calories > 0 || protein > 0 || carbs > 0 || fat > 0;
    if (hasNutrition && totalCalories <= 0 && totalProtein <= 0 && totalCarbs <= 0 && totalFat <= 0) {
        totalCalories = calories;
        totalProtein = protein;
        totalCarbs = carbs;
        totalFat = fat;
    }

    return {
        foodId,
        name,
        portion: portionText,
        quantity,
        calories,
        protein,
        carbs,
        fat,
        notes,
        substitutionNote,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
    };
}

export function normalizeDietMeal(meal: any) {
    const rawFoods = Array.isArray(meal?.foods)
        ? meal.foods
        : typeof meal?.foods === 'string'
            ? JSON.parse(meal.foods || '[]')
            : [];

    return {
        ...meal,
        foods: rawFoods.map(normalizeDietFood),
    };
}

export function normalizeDietPlan(plan: any) {
    if (!plan) return plan;
    const rawMeals = Array.isArray(plan.meals) ? plan.meals : [];
    return {
        ...plan,
        meals: rawMeals.map(normalizeDietMeal),
    };
}
