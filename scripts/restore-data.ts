import { PrismaClient } from '@prisma/client';
import { generateDietPlan } from '../src/lib/diet-generator';

const prisma = new PrismaClient();

async function main() {
    const studentUser = await prisma.user.findUnique({
        where: { email: 'joao@email.com' },
        include: { student: true }
    });

    if (!studentUser || !studentUser.student) {
        console.error('João Santos not found. Please run seed first.');
        return;
    }

    const personal = await prisma.personal.findFirst();
    if (!personal) {
        console.error('Personal not found.');
        return;
    }

    console.log('Generating diet for:', studentUser.name);

    const mealPlan = generateDietPlan({
        weight: studentUser.student.weight ?? 70,
        height: studentUser.student.height ?? 170,
        age: 29, // Approximate
        gender: 'MALE',
        activityLevel: 'MODERATE',
        goal: 'MUSCLE_GAIN'
    });

    const dietPlan = await prisma.dietPlan.create({
        data: {
            studentId: studentUser.student.id,
            personalId: personal.id,
            title: 'Plano de Restauração - Hipertrofia',
            calories: mealPlan.calories,
            protein: mealPlan.protein,
            carbs: mealPlan.carbs,
            fat: mealPlan.fat,
            active: true,
            meals: {
                create: mealPlan.meals.map((meal, index) => ({
                    name: meal.name,
                    time: meal.time,
                    order: index,
                    foods: JSON.stringify(meal.foods.map(f => ({
                        name: f.name,
                        quantity: `${Math.round(f.quantity * 100)}g`, // basic scale to g
                        calories: Math.round(f.calories * f.quantity),
                        protein: Math.round(f.protein * f.quantity),
                        carbs: Math.round(f.carbs * f.quantity),
                        fat: Math.round(f.fat * f.quantity),
                    })))
                }))
            }
        }
    });

    console.log('✅ Diet plan restored:', dietPlan.id);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
