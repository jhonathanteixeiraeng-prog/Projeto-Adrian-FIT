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

const brazilianStaplesByMealType: Record<string, string[]> = {
    BREAKFAST: ['ovo', 'aveia', 'banana', 'pao', 'tapioca', 'iogurte', 'maca', 'queijo'],
    LUNCH: ['arroz', 'feijao', 'frango', 'carne', 'batata', 'brocolis', 'azeite', 'ovo', 'salada', 'peixe'],
    DINNER: ['arroz', 'feijao', 'frango', 'carne', 'batata', 'brocolis', 'azeite', 'ovo', 'salada', 'peixe'],
    SNACK: ['banana', 'aveia', 'iogurte', 'amendoim', 'maca', 'tapioca', 'pao', 'ovo', 'whey'],
};

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
    if (dbFoods.length > 0) {
        return dbFoods;
    }
    return sanitizeFoods(foodDatabase as FoodInput[]);
}

function filterBrazilianStaples(foods: FoodInput[], mealType: string) {
    const staples = brazilianStaplesByMealType[mealType] || [];
    const preferred = foods.filter((food) => {
        const normalizedName = normalizeText(food.name);
        return staples.some((keyword) => normalizedName.includes(keyword));
    });
    return preferred.length >= 2 ? preferred : foods;
}

function pickRandomFromTop<T>(items: T[], score: (item: T) => number, top = 5): T | null {
    if (items.length === 0) return null;
    const ranked = [...items].sort((a, b) => score(b) - score(a)).slice(0, top);
    return ranked[Math.floor(Math.random() * ranked.length)] || null;
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

    const generatedMeals: GeneratedMeal[] = mealsStructure.map((structure) => {
        const mealCalories = targetCalories * structure.ratio;
        const foods: GeneratedFood[] = [];

        let candidates = filterBrazilianStaples(foodsPool, structure.type);
        if (candidates.length === 0) candidates = foodsPool;

        const proteinSource = pickRandomFromTop(candidates, (item) => item.protein);
        if (proteinSource && proteinSource.calories > 0) {
            const quantity = (mealCalories * 0.4) / proteinSource.calories;
            foods.push(createGeneratedFood(proteinSource, quantity));
        }

        const carbCandidates = candidates.filter((food) => food.id !== proteinSource?.id);
        const carbSource = pickRandomFromTop(carbCandidates, (item) => item.carbs);
        if (carbSource && carbSource.calories > 0) {
            const quantity = (mealCalories * 0.4) / carbSource.calories;
            foods.push(createGeneratedFood(carbSource, quantity));
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
    const roundedQty = Math.max(0.5, Math.round(quantity * 2) / 2);

    return {
        foodId: food.id,
        name: food.name,
        portion: food.portion,
        quantity: roundedQty,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
    };
}
