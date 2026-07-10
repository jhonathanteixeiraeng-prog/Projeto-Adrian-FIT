import { foodDatabase } from './food-database';

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
    foods?: FoodInput[];
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
}

function normalizeText(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function sanitizeFoods(foods: FoodInput[]): FoodInput[] {
    return foods
        .filter((food) => !!food && !!food.name)
        .map((food, index) => ({
            id: String(food.id || `food-${index}`),
            name: String(food.name),
            portion: String(food.portion || '100g'),
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
        }))
        .filter((food) => Number.isFinite(food.calories) && food.calories > 0);
}

function getFoodsPool(inputFoods?: FoodInput[]) {
    const dbFoods = sanitizeFoods((inputFoods || []) as FoodInput[]);
    const everydayFoods = sanitizeFoods(foodDatabase as FoodInput[]);
    const merged = [...everydayFoods, ...dbFoods];
    const unique = new Map<string, FoodInput>();

    for (const food of merged) {
        const key = normalizeText(food.name);
        if (!unique.has(key)) unique.set(key, food);
    }

    return Array.from(unique.values());
}

type FoodCategory = 'BREAKFAST_PROTEIN' | 'FRUIT' | 'BREAKFAST_CARB' | 'LEAN_PROTEIN' |
    'BRAZILIAN_CARB' | 'VEGETABLE' | 'SNACK_PROTEIN' | 'HEALTHY_FAT';

const approvedFoodPatterns: Record<FoodCategory, RegExp[]> = {
    BREAKFAST_PROTEIN: [
        /^ovo inteiro$/,
        /^ovo, de galinha, inteiro, cozido/,
        /^iogurte,? natural(?:, desnatado)?$/,
        /^iogurte grego$/,
        /^queijo, minas, frescal$/,
    ],
    FRUIT: [/^banana$/, /^maca$/],
    BREAKFAST_CARB: [
        /^aveia$/,
        /^pao integral$/,
        /^pao, trigo, forma, integral$/,
        /^tapioca$/,
    ],
    LEAN_PROTEIN: [
        /^frango grelhado$/,
        /^frango, peito, sem pele, (?:cozido|grelhado)$/,
        /^carne bovina magra$/,
        /^carne, bovina, patinho, sem gordura, grelhado$/,
        /^salmao$/,
    ],
    BRAZILIAN_CARB: [
        /^arroz branco$/,
        /^arroz, (?:integral|tipo 1), cozido$/,
        /^feijao carioca$/,
        /^feijao, carioca, cozido$/,
        /^batata doce$/,
        /^batata, doce, cozida$/,
        /^mandioca, cozida$/,
    ],
    VEGETABLE: [
        /^brocolis$/,
        /^brocolis, cozido$/,
        /^cenoura, cozida$/,
        /^abobora, (?:cabotian, cozida|moranga, refogada)$/,
    ],
    SNACK_PROTEIN: [
        /^iogurte,? natural(?:, desnatado)?$/,
        /^iogurte grego$/,
        /^queijo, minas, frescal$/,
        /^queijo cottage$/,
        /^ovo inteiro$/,
        /^ovo, de galinha, inteiro, cozido/,
        /^whey protein$/,
    ],
    HEALTHY_FAT: [/^azeite de oliva$/],
};

function getApprovedFoods(foods: FoodInput[], category: FoodCategory, excludedIds: Set<string>) {
    const patterns = approvedFoodPatterns[category];
    return foods.filter((food) => {
        if (excludedIds.has(food.id)) return false;
        const name = normalizeText(food.name);
        return patterns.some((pattern) => pattern.test(name));
    });
}

function pickApprovedFood(foods: FoodInput[], category: FoodCategory, excludedIds: Set<string>) {
    const candidates = getApprovedFoods(foods, category, excludedIds);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
}

type HouseholdMeasure = {
    name: string;
    portion: string;
    grams: number;
    step: number;
};

function getHouseholdMeasure(food: FoodInput): HouseholdMeasure | null {
    const name = normalizeText(food.name);

    if (name.includes('ovo') && !name.includes('gema') && !name.includes('clara')) {
        return { name: 'Ovo inteiro', portion: '1 unidade', grams: 50, step: 1 };
    }
    if (name.includes('banana')) {
        return { name: 'Banana', portion: '1 unidade média', grams: 80, step: 1 };
    }
    if (name.includes('maca')) {
        return { name: 'Maçã', portion: '1 unidade média', grams: 130, step: 1 };
    }
    if (name.includes('pao')) {
        return { name: 'Pão', portion: '1 fatia', grams: 25, step: 1 };
    }
    if (name.includes('azeite')) {
        return { name: 'Azeite de oliva', portion: '1 colher de sopa (15ml)', grams: 13.5, step: 0.5 };
    }
    if (name.includes('whey')) {
        return { name: 'Whey protein', portion: '1 scoop (30g)', grams: 30, step: 0.5 };
    }
    if (name.includes('iogurte')) {
        return { name: 'Iogurte natural', portion: '1 pote (170g)', grams: 170, step: 0.5 };
    }
    if (name.includes('queijo') && (name.includes('minas') || name.includes('cottage'))) {
        return {
            name: name.includes('cottage') ? 'Queijo cottage' : 'Queijo minas frescal',
            portion: '1 porção (30g)',
            grams: 30,
            step: 0.5,
        };
    }

    return null;
}

function portionAmountInGrams(portion: string): number | null {
    const normalized = normalizeText(portion).replace(',', '.');
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
    return match ? Number(match[1]) : null;
}

function roundToStep(value: number, step: number) {
    return Math.max(step, Math.round(value / step) * step);
}

function maxHouseholdQuantity(food: FoodInput) {
    const name = normalizeText(food.name);
    if (name.includes('ovo')) return 4;
    if (name.includes('iogurte')) return 2;
    if (name.includes('queijo')) return 3;
    if (name.includes('banana') || name.includes('maca')) return 2;
    if (name.includes('pao')) return 4;
    if (name.includes('whey')) return 1.5;
    if (name.includes('azeite')) return 1;
    return 4;
}

function maxBasePortions(food: FoodInput) {
    const name = normalizeText(food.name);
    if (name.includes('feijao')) return 2;
    if (name.includes('brocolis') || name.includes('cenoura') || name.includes('abobora')) return 2;
    if (name.includes('aveia')) return 2;
    if (name.includes('frango') || name.includes('carne') || name.includes('salmao')) return 2.5;
    if (name.includes('arroz') || name.includes('batata') || name.includes('mandioca')) return 2.5;
    return 3;
}

function getFriendlyFoodName(food: FoodInput) {
    const name = normalizeText(food.name);
    if (name.includes('frango')) return name.includes('cozido') ? 'Peito de frango cozido' : 'Peito de frango grelhado';
    if (name.includes('patinho')) return 'Patinho grelhado';
    if (name.includes('arroz') && name.includes('integral')) return 'Arroz integral cozido';
    if (name.includes('arroz')) return 'Arroz branco cozido';
    if (name.includes('feijao')) return 'Feijão carioca cozido';
    if (name.includes('batata') && name.includes('doce')) return 'Batata-doce cozida';
    if (name.includes('mandioca')) return 'Mandioca cozida';
    if (name.includes('brocolis')) return 'Brócolis cozido';
    if (name.includes('cenoura')) return 'Cenoura cozida';
    if (name.includes('abobora')) return 'Abóbora cozida';
    return food.name;
}

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

export function generateDietPlan(data: StudentData): MealPlan {
    const bmr = calculateBMR(data.weight, data.height, data.age, data.gender);
    const tdee = calculateTDEE(bmr, data.activityLevel);
    const targetCalories = calculateTargetCalories(tdee, data.goal);
    const foodsPool = getFoodsPool(data.foods);

    let proteinRatio = 0.3;
    let fatRatio = 0.35;
    let carbsRatio = 0.35;

    if (data.goal === 'WEIGHT_LOSS') {
        proteinRatio = 0.4;
        fatRatio = 0.35;
        carbsRatio = 0.25;
    } else if (data.goal === 'MUSCLE_GAIN') {
        proteinRatio = 0.3;
        fatRatio = 0.2;
        carbsRatio = 0.5;
    }

    const targetProtein = (targetCalories * proteinRatio) / 4;
    const targetFat = (targetCalories * fatRatio) / 9;
    const targetCarbs = (targetCalories * carbsRatio) / 4;

    const mealsStructure = [
        { name: 'Café da Manhã', time: '07:00', type: 'BREAKFAST', ratio: 0.25 },
        { name: 'Lanche da Manhã', time: '10:00', type: 'SNACK', ratio: 0.1 },
        { name: 'Almoço', time: '13:00', type: 'LUNCH', ratio: 0.3 },
        { name: 'Lanche da Tarde', time: '16:00', type: 'SNACK', ratio: 0.1 },
        { name: 'Jantar', time: '19:00', type: 'DINNER', ratio: 0.2 },
        { name: 'Ceia', time: '22:00', type: 'SNACK', ratio: 0.05 },
    ];

    const mealBlueprints: Record<string, Array<{ category: FoodCategory; calorieShare: number }>> = {
        BREAKFAST: [
            { category: 'BREAKFAST_PROTEIN', calorieShare: 0.4 },
            { category: 'BREAKFAST_CARB', calorieShare: 0.4 },
            { category: 'FRUIT', calorieShare: 0.2 },
        ],
        SNACK: [
            { category: 'SNACK_PROTEIN', calorieShare: 0.55 },
            { category: 'FRUIT', calorieShare: 0.45 },
        ],
        LUNCH: [
            { category: 'LEAN_PROTEIN', calorieShare: 0.45 },
            { category: 'BRAZILIAN_CARB', calorieShare: 0.45 },
            { category: 'VEGETABLE', calorieShare: 0.1 },
        ],
        DINNER: [
            { category: 'LEAN_PROTEIN', calorieShare: 0.45 },
            { category: 'BRAZILIAN_CARB', calorieShare: 0.45 },
            { category: 'VEGETABLE', calorieShare: 0.1 },
        ],
    };

    const generatedMeals: GeneratedMeal[] = mealsStructure.map((structure) => {
        const mealCalories = targetCalories * structure.ratio;
        const foods: GeneratedFood[] = [];
        const selectedIds = new Set<string>();
        const blueprint = mealBlueprints[structure.type] || mealBlueprints.SNACK;

        for (const slot of blueprint) {
            const selected = pickApprovedFood(foodsPool, slot.category, selectedIds);
            if (!selected || selected.calories <= 0) continue;

            selectedIds.add(selected.id);
            const quantity = (mealCalories * slot.calorieShare) / selected.calories;
            foods.push(createGeneratedFood(selected, quantity));
        }

        return {
            name: structure.name,
            time: structure.time,
            foods,
        };
    });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    generatedMeals.forEach((meal) => {
        meal.foods.forEach((food) => {
            totalCalories += food.calories * food.quantity;
            totalProtein += food.protein * food.quantity;
            totalCarbs += food.carbs * food.quantity;
            totalFat += food.fat * food.quantity;
        });
    });

    // Keep generator stable when list is small or filtered heavily.
    const safeCalories = totalCalories > 0 ? totalCalories : targetCalories;
    const safeProtein = totalProtein > 0 ? totalProtein : targetProtein;
    const safeCarbs = totalCarbs > 0 ? totalCarbs : targetCarbs;
    const safeFat = totalFat > 0 ? totalFat : targetFat;

    return {
        calories: Math.round(safeCalories),
        protein: Math.round(safeProtein),
        carbs: Math.round(safeCarbs),
        fat: Math.round(safeFat),
        meals: generatedMeals,
    };
}

function createGeneratedFood(food: FoodInput, quantity: number): GeneratedFood {
    const householdMeasure = getHouseholdMeasure(food);
    const baseGrams = portionAmountInGrams(food.portion);

    if (householdMeasure && !baseGrams) {
        return {
            foodId: food.id,
            name: householdMeasure.name,
            portion: householdMeasure.portion,
            quantity: Math.min(roundToStep(quantity, householdMeasure.step), maxHouseholdQuantity(food)),
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
        };
    }

    if (householdMeasure && baseGrams) {
        const nutritionFactor = householdMeasure.grams / baseGrams;
        const householdQuantity = roundToStep(
            (quantity * baseGrams) / householdMeasure.grams,
            householdMeasure.step
        );

        return {
            foodId: food.id,
            name: householdMeasure.name,
            portion: householdMeasure.portion,
            quantity: Math.min(householdQuantity, maxHouseholdQuantity(food)),
            calories: food.calories * nutritionFactor,
            protein: food.protein * nutritionFactor,
            carbs: food.carbs * nutritionFactor,
            fat: food.fat * nutritionFactor,
        };
    }

    const roundedQty = Math.min(
        Math.max(0.5, Math.round(quantity * 2) / 2),
        maxBasePortions(food)
    );

    return {
        foodId: food.id,
        name: getFriendlyFoodName(food),
        portion: food.portion,
        quantity: roundedQty,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
    };
}
