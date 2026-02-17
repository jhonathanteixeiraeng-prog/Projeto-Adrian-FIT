import { foodDatabase } from './food-database';

interface StudentData {
    weight: number; // kg
    height: number; // cm
    age: number; // years
    gender: 'MALE' | 'FEMALE';
    activityLevel: 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
    goal: 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';
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
    BREAKFAST: ['Ovo', 'Aveia', 'Banana', 'Pão', 'Tapioca', 'Iogurte', 'Maçã'],
    LUNCH: ['Arroz', 'Feijão', 'Frango', 'Carne', 'Batata', 'Brócolis', 'Azeite', 'Ovo'],
    DINNER: ['Arroz', 'Feijão', 'Frango', 'Carne', 'Batata', 'Brócolis', 'Azeite', 'Ovo'],
    SNACK: ['Banana', 'Aveia', 'Iogurte', 'Amendoim', 'Maçã', 'Tapioca', 'Pão', 'Ovo'],
};

function filterBrazilianStaples(foods: typeof foodDatabase, mealType: string) {
    const staples = brazilianStaplesByMealType[mealType] || [];
    const preferred = foods.filter((food) => staples.some((keyword) => food.name.includes(keyword)));
    // Keep fallback when preferred set is too small to build the meal.
    return preferred.length >= 2 ? preferred : foods;
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
        'SEDENTARY': 1.2,
        'LIGHT': 1.375,
        'MODERATE': 1.55,
        'ACTIVE': 1.725,
        'VERY_ACTIVE': 1.9,
    };
    return bmr * (multipliers[activityLevel] || 1.2);
}

export function calculateTargetCalories(tdee: number, goal: string): number {
    switch (goal) {
        case 'WEIGHT_LOSS': return tdee - 500;
        case 'MUSCLE_GAIN': return tdee + 300;
        case 'MAINTENANCE': default: return tdee;
    }
}

export function generateDietPlan(data: StudentData): MealPlan {
    const bmr = calculateBMR(data.weight, data.height, data.age, data.gender);
    const tdee = calculateTDEE(bmr, data.activityLevel);
    const targetCalories = calculateTargetCalories(tdee, data.goal);

    // Macro split (Approximate)
    // Weight Loss: 40% Protein, 35% Fat, 25% Carbs
    // Maintenance: 30% Protein, 35% Fat, 35% Carbs
    // Muscle Gain: 30% Protein, 20% Fat, 50% Carbs
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

    // Generate Meals
    // Simple algorithm: 4 primary meals + 2 snacks
    const mealsStructure = [
        { name: 'Café da Manhã', time: '07:00', type: 'BREAKFAST', ratio: 0.25 },
        { name: 'Lanche da Manhã', time: '10:00', type: 'SNACK', ratio: 0.1 },
        { name: 'Almoço', time: '13:00', type: 'LUNCH', ratio: 0.3 },
        { name: 'Lanche da Tarde', time: '16:00', type: 'SNACK', ratio: 0.1 },
        { name: 'Jantar', time: '19:00', type: 'DINNER', ratio: 0.2 },
        { name: 'Ceia', time: '22:00', type: 'SNACK', ratio: 0.05 },
    ];

    const generatedMeals: GeneratedMeal[] = mealsStructure.map(structure => {
        const mealCalories = targetCalories * structure.ratio;
        const foods: GeneratedFood[] = [];
        let currentCalories = 0;

        // Select foods based on meal type
        // This is a simplified selection logic
        let candidates = foodDatabase;

        if (structure.type === 'BREAKFAST') {
            candidates = foodDatabase.filter(f => ['Ovo', 'Aveia', 'Banana', 'Pão', 'Queijo', 'Iogurte', 'Tapioca', 'Maçã'].some(k => f.name.includes(k)));
        } else if (structure.type === 'LUNCH' || structure.type === 'DINNER') {
            candidates = foodDatabase.filter(f => ['Frango', 'Arroz', 'Batata', 'Brócolis', 'Carne', 'Salmão', 'Feijão', 'Azeite'].some(k => f.name.includes(k)));
        } else {
            candidates = foodDatabase.filter(f => ['Whey', 'Banana', 'Iogurte', 'Amendoim', 'Maçã'].some(k => f.name.includes(k)));
        }

        candidates = filterBrazilianStaples(candidates, structure.type);

        // Add protein source (from top 5 protein options to keep quality + variation)
        const proteinPool = [...candidates].sort((a, b) => b.protein - a.protein).slice(0, 5);
        const proteinSource = proteinPool[Math.floor(Math.random() * Math.max(1, proteinPool.length))];
        if (proteinSource) {
            const quantity = (mealCalories * 0.4) / proteinSource.calories;
            foods.push(createGeneratedFood(proteinSource, quantity));
            currentCalories += proteinSource.calories * quantity;
        }

        // Add carb source (from top 5 carb options to keep quality + variation)
        const carbPool = [...candidates]
            .filter((food) => food.id !== proteinSource?.id)
            .sort((a, b) => b.carbs - a.carbs)
            .slice(0, 5);
        const carbSource = carbPool[Math.floor(Math.random() * Math.max(1, carbPool.length))];
        if (carbSource && carbSource.id !== proteinSource?.id) {
            const quantity = (mealCalories * 0.4) / carbSource.calories;
            foods.push(createGeneratedFood(carbSource, quantity));
            currentCalories += carbSource.calories * quantity;
        }

        // Fill remaining with random compliant food if needed, or adjust portions
        // For simplicity, we stick to 2 main items per meal in this basic generator

        return {
            name: structure.name,
            time: structure.time,
            foods
        };
    });

    // Recalculate actual totals
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    generatedMeals.forEach(meal => {
        meal.foods.forEach(food => {
            totalCalories += food.calories * food.quantity;
            totalProtein += food.protein * food.quantity;
            totalCarbs += food.carbs * food.quantity;
            totalFat += food.fat * food.quantity;
        });
    });

    return {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein),
        carbs: Math.round(totalCarbs),
        fat: Math.round(totalFat),
        meals: generatedMeals
    };
}

function createGeneratedFood(food: typeof foodDatabase[0], quantity: number): GeneratedFood {
    // Round quantity to nearest 0.5 or 1
    const roundedQty = Math.max(0.5, Math.round(quantity * 2) / 2);

    return {
        foodId: food.id,
        name: food.name,
        portion: food.portion,
        quantity: roundedQty,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat
    };
}
