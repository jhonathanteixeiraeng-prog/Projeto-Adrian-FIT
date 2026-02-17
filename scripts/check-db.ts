import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const students = await prisma.student.count();
    const dietPlans = await prisma.dietPlan.count();
    const workoutPlans = await prisma.workoutPlan.count();
    const dietMeals = await prisma.dietMeal.count();
    const workoutDays = await prisma.workoutDay.count();
    const users = await prisma.user.count();
    const history = await prisma.foodSubstitutionHistory.count();

    console.log('Database Status:');
    console.log(`Users: ${users}`);
    console.log(`Students: ${students}`);
    console.log(`Diet Plans: ${dietPlans}`);
    console.log(`Diet Meals: ${dietMeals}`);
    console.log(`Workout Plans: ${workoutPlans}`);
    console.log(`Workout Days: ${workoutDays}`);
    console.log(`Substitution History: ${history}`);

    const allStudents = await prisma.student.findMany({
        include: { user: true }
    });
    console.log('Students List:');
    allStudents.forEach(s => console.log(`- ${s.user.name} (${s.user.email})`));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
