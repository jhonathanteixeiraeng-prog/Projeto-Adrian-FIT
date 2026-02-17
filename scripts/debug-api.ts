import { PrismaClient } from '@prisma/client';
import { calculateSubstitution, parseQuantity } from '../src/lib/substitution';

const prisma = new PrismaClient();

async function main() {
    const studentId = 'cmliga2zy0004t0ojym961alm';
    const mealId = 'cmligldib0002wbg50cozxx77';

    console.log('--- Debugging Substitution Logic ---');

    const meal = await prisma.dietMeal.findUnique({
        where: { id: mealId }
    });

    if (!meal) {
        console.error('Meal not found');
        return;
    }

    const foods = JSON.parse(meal.foods);
    const originalFoodIndex = 0;
    const originalFood = foods[originalFoodIndex];

    const newFood = {
        name: 'Pão francês',
        calories: 265, // per 100g
        protein: 9,
        carbs: 58,
        fat: 1
    };

    try {
        console.log('1. Calculating substitution...');
        const originalQtyVal = parseQuantity(originalFood.quantity || '100g');
        const denom = originalQtyVal || 100;
        const originalCaloriesPer100 = (Number(originalFood.calories) * 100) / denom;

        const result = calculateSubstitution(
            {
                ...originalFood,
                calories: originalCaloriesPer100,
                protein: (Number(originalFood.protein) * 100) / denom,
                carbs: (Number(originalFood.carbs) * 100) / denom,
                fat: (Number(originalFood.fat) * 100) / denom
            },
            originalQtyVal,
            {
                ...newFood,
                calories: Number(newFood.calories),
                protein: Number(newFood.protein),
                carbs: Number(newFood.carbs),
                fat: Number(newFood.fat)
            }
        );
        console.log('Result:', result);

        console.log('2. Updating meal foods...');
        const newFoodItem = {
            name: newFood.name,
            quantity: `${result.newQuantity}g`,
            calories: Math.round(result.newCalories),
            protein: Math.round(result.newProtein),
            carbs: Math.round(result.newCarbs),
            fat: Math.round(result.newFat),
            isSubstitution: true,
            originalName: originalFood.name
        };
        foods[originalFoodIndex] = newFoodItem;

        await prisma.dietMeal.update({
            where: { id: mealId },
            data: { foods: JSON.stringify(foods) }
        });
        console.log('Meal updated successfully');

        console.log('3. Logging history...');
        const diff = result.newCalories - Number(originalFood.calories);
        await prisma.foodSubstitutionHistory.create({
            data: {
                studentId: studentId,
                mealId: mealId,
                originalFood: originalFood.name,
                originalAmount: originalFood.quantity || '?',
                newFood: newFood.name,
                newAmount: `${result.newQuantity}g`,
                caloriesDiff: isNaN(diff) ? 0 : diff
            }
        });
        console.log('History logged successfully');

    } catch (err: any) {
        console.error('FAILED at step:', err.message);
        console.error(err.stack);
    }
}

main().finally(() => prisma.$disconnect());
