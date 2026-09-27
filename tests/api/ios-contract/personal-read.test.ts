import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { GET as getDashboard } from '@/app/api/dashboard/route';
import { GET as getStudent } from '@/app/api/students/[id]/route';
import { GET as listWorkoutPlans } from '@/app/api/workout-plans/route';
import { GET as getWorkoutPlan } from '@/app/api/workout-plans/[id]/route';
import { GET as listDiets } from '@/app/api/diets/route';
import { GET as getDiet } from '@/app/api/diets/[id]/route';
import { GET as listWorkoutTemplates } from '@/app/api/workout-templates/route';
import { GET as listDietTemplates } from '@/app/api/diet-templates/route';
import { GET as listExercises } from '@/app/api/exercises/route';
import { GET as searchFoods } from '@/app/api/foods/search/route';
import { GET as getPersonalNotifications } from '@/app/api/personal/notifications/route';

import { envelopeData, expectShape, optional, type Shape } from '../../helpers/contract';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../../helpers/db';
import { json, request, signIn } from '../../helpers/http';

beforeEach(resetDatabase);

// --- Shapes copied from iOS Swift models ---

// ios/AdrianFit/AdrianFit/Core/Models.swift:809
const attentionStudent: Shape = {
    // AttentionStudent
    id: 'string',
    name: 'string',
    email: 'string?',
    workoutAdherence: 'number?',
    dietAdherence: 'number?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:798
const personalDashboard: Shape = {
    // PersonalDashboard
    totalStudents: 'number',
    activeStudents: 'number',
    studentsWithoutWorkout72h: 'number',
    averageWorkoutAdherence: 'number',
    averageDietAdherence: 'number',
    pendingCheckins: 'number',
    lowAdherenceStudents: [attentionStudent],
    studentsWithoutWorkout72hList: [attentionStudent],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:828
const studentUser: Shape = {
    // StudentUser
    id: 'string',
    name: 'string',
    email: 'string',
    phone: 'string?',
    avatar: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:841
const checkinSummary: Shape = {
    // CheckinSummary
    id: 'string',
    date: 'string',
    weight: 'number',
    workoutAdherence: 'number',
    dietAdherence: 'number',
};

// ios/AdrianFit/AdrianFit/Features/Personal/StudentFormView.swift:18
const anamnesisData: Shape = {
    // AnamnesisData
    restrictions: 'string?',
    injuries: 'string?',
    medications: 'string?',
    activityLevel: 'string?',
    notes: 'string?',
};

// ios/AdrianFit/AdrianFit/Features/Personal/StudentFormView.swift:5
const studentFull: Shape = {
    // StudentFull
    id: 'string',
    birthDate: 'string?',
    gender: 'string?',
    height: 'number?',
    weight: 'number?',
    goal: 'string?',
    status: 'string?',
    user: studentUser,
    anamnesis: optional(anamnesisData),
    checkins: optional([checkinSummary]),
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:858 & 862
const relatedStudent: Shape = {
    // RelatedStudent
    user: {
        // RelatedUser
        name: 'string',
        email: 'string?',
    },
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:867
const itemCount: Shape = {
    // ItemCount
    workoutDays: 'number?',
    templateDays: 'number?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:872
const personalWorkoutPlan: Shape = {
    // PersonalWorkoutPlan
    id: 'string',
    title: 'string',
    startDate: 'string',
    endDate: 'string',
    active: 'boolean',
    version: 'number',
    student: relatedStudent,
    _count: optional(itemCount),
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:5
const exercise: Shape = {
    // Exercise
    id: 'string',
    name: 'string',
    muscleGroup: 'string',
    equipment: 'string?',
    difficulty: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:32
const workoutItemDetail: Shape = {
    // WorkoutItemDetail
    id: 'string',
    sets: 'number',
    reps: 'string',
    rest: 'number',
    restBySet: 'string?',
    load: 'string?',
    rpe: 'string?',
    groupId: 'string?',
    notes: 'string?',
    exercise,
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:25
const workoutDayDetail: Shape = {
    // WorkoutDayDetail
    id: 'string',
    name: 'string',
    dayOfWeek: 'number',
    items: [workoutItemDetail],
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:16
const workoutPlanDetail: Shape = {
    // WorkoutPlanDetail
    id: 'string',
    title: 'string',
    startDate: 'string',
    endDate: 'string',
    active: 'boolean',
    workoutDays: [workoutDayDetail],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:888
const identifiedValue: Shape = {
    // IdentifiedValue
    id: 'string',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:890
const personalDietPlan: Shape = {
    // PersonalDietPlan
    id: 'string',
    title: 'string',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
    active: 'boolean',
    student: relatedStudent,
    meals: [identifiedValue],
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:390
const dietMealRaw: Shape = {
    // DietMealRaw
    id: 'string',
    name: 'string',
    time: 'string',
    foods: 'string', // Swift expects JSON string: let foods: String
    notes: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:374
const dietPlanDetail: Shape = {
    // DietPlanDetail
    id: 'string',
    title: 'string',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
    active: 'boolean',
    meals: [dietMealRaw],
    student: optional({ id: 'string' }),
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:933
const templateExercise: Shape = {
    // TemplateExercise
    name: 'string',
    muscleGroup: 'string',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:922
const workoutTemplateItemSummary: Shape = {
    // WorkoutTemplateItemSummary
    id: 'string',
    sets: 'number',
    reps: 'string',
    rest: 'number',
    load: 'string?',
    rpe: 'string?',
    groupId: 'string?',
    exercise: optional(templateExercise),
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:915
const workoutTemplateDaySummary: Shape = {
    // WorkoutTemplateDaySummary
    id: 'string',
    name: 'string',
    dayOfWeek: 'number',
    items: [workoutTemplateItemSummary],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:902
const workoutTemplateSummary: Shape = {
    // WorkoutTemplateSummary
    id: 'string',
    title: 'string',
    description: 'string?',
    templateDays: [workoutTemplateDaySummary],
    _count: optional(itemCount),
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:625
const dietFood: Shape = {
    // DietFood
    foodId: 'string?',
    name: 'string',
    portion: 'string?',
    quantity: 'number?',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
    notes: 'string?',
    substitutionNote: 'string?',
    totalCalories: 'number?',
    totalProtein: 'number?',
    totalCarbs: 'number?',
    totalFat: 'number?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:948
const dietTemplateMealSummary: Shape = {
    // DietTemplateMealSummary
    id: 'string',
    name: 'string',
    time: 'string',
    items: [dietFood],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:938
const dietTemplateSummary: Shape = {
    // DietTemplateSummary
    id: 'string',
    title: 'string',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
    meals: [dietTemplateMealSummary],
};

// ios/AdrianFit/AdrianFit/Features/Personal/ExercisesLibraryView.swift:3
const exerciseFull: Shape = {
    // ExerciseFull
    id: 'string',
    name: 'string',
    muscleGroup: 'string',
    equipment: 'string?',
    difficulty: 'string?',
    videoUrl: 'string?',
    instructions: 'string?',
    tips: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:485
const foodSearchItem: Shape = {
    // FoodSearchItem
    id: 'string',
    name: 'string',
    portion: 'string?',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
};

// ios/AdrianFit/AdrianFit/Features/Shared/NotificationsView.swift:3
const appNotification: Shape = {
    // AppNotification
    id: 'string',
    type: 'string',
    title: 'string',
    body: 'string',
    read: 'boolean',
    createdAt: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Shared/NotificationsView.swift:30
const notificationsPayload: Shape = {
    // NotificationsPayload
    notifications: [appNotification],
    unreadMessages: 'number',
    unreadCount: 'number',
};

describe('iOS contract: personal read (Group 1)', () => {
    // C01: GET /api/dashboard -> PersonalDashboard
    it('C01: GET /api/dashboard decodes as PersonalDashboard', async () => {
        const trainer = await createPersonal();
        const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
        const { student } = await createStudent(trainer.personal.id, { phone: '11999998888' });
        await prisma.student.update({
            where: { id: student.id },
            data: { usesApp: true, usesAppSince: tenDaysAgo, createdAt: tenDaysAgo },
        });
        // Checkin with adherence < 60 so they enter lowAdherenceStudents and have pendingCheckins
        await prisma.checkin.create({
            data: {
                studentId: student.id,
                date: new Date(Date.now() - 8 * 86_400_000),
                weight: 75,
                workoutAdherence: 40,
                dietAdherence: 45,
                sleepHours: 7,
                energyLevel: 3,
                hungerLevel: 3,
                stressLevel: 3,
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await getDashboard(request('GET', '/api/dashboard')));
        expect(status).toBe(200);

        const data = envelopeData(body) as {
            lowAdherenceStudents: unknown[];
            studentsWithoutWorkout72hList: unknown[];
        };
        expect(data.lowAdherenceStudents.length).toBeGreaterThan(0);
        expect(data.studentsWithoutWorkout72hList.length).toBeGreaterThan(0);

        expectShape(data, personalDashboard);
    });

    // C02: GET /api/students/[id] -> StudentFull
    it('C02: GET /api/students/[id] decodes as StudentFull', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id, { phone: '11999998888' });
        await prisma.student.update({
            where: { id: student.id },
            data: {
                birthDate: new Date('1995-05-15T12:00:00.000Z'),
                gender: 'MALE',
                height: 178,
                weight: 82,
                goal: 'Hipertrofia',
                anamnesis: {
                    create: {
                        restrictions: 'Sem restrições',
                        injuries: 'Nenhuma',
                        medications: 'Nenhum',
                        activityLevel: 'ACTIVE',
                        notes: 'Treina há 2 anos',
                    },
                },
                checkins: {
                    create: [
                        {
                            date: new Date(),
                            weight: 82,
                            workoutAdherence: 90,
                            dietAdherence: 85,
                            sleepHours: 8,
                            energyLevel: 4,
                            hungerLevel: 3,
                            stressLevel: 2,
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(
            await getStudent(request('GET', `/api/students/${student.id}`), { params: Promise.resolve({ id: student.id }) })
        );
        expect(status).toBe(200);

        const data = envelopeData(body) as { checkins?: unknown[] };
        expect(data.checkins?.length).toBeGreaterThan(0);

        expectShape(data, studentFull);
    });

    // C03: GET /api/workout-plans -> [PersonalWorkoutPlan]
    it('C03: GET /api/workout-plans decodes as [PersonalWorkoutPlan]', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        await createWorkoutPlan(student.id, trainer.personal.id, 'Ficha Hipertrofia A');

        signIn(trainer.session);
        const { status, body } = await json(await listWorkoutPlans(request('GET', '/api/workout-plans')));
        expect(status).toBe(200);

        const plans = envelopeData(body) as unknown[];
        expect(plans.length).toBeGreaterThan(0);

        expectShape(plans, [personalWorkoutPlan]);
    });

    // C04: GET /api/workout-plans/[id] -> WorkoutPlanDetail (getRaw)
    it('C04: GET /api/workout-plans/[id] decodes as WorkoutPlanDetail (raw body)', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: {
                name: 'Agachamento Livre',
                muscleGroup: 'Pernas',
                equipment: 'Barra',
                difficulty: 'INTERMEDIARIO',
            },
        });
        const plan = await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Pernas',
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                active: true,
                workoutDays: {
                    create: [
                        {
                            dayOfWeek: 2,
                            name: 'Treino Pernas',
                            order: 0,
                            items: {
                                create: [
                                    {
                                        exerciseId: exerciseRecord.id,
                                        sets: 4,
                                        reps: '8-10',
                                        rest: 90,
                                        restBySet: '90,90,90,90',
                                        load: '80kg',
                                        rpe: '8',
                                        groupId: 'group-1',
                                        notes: 'Cuidado com a lombar',
                                        order: 0,
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);
        // iOS app calls api.getRaw("/api/workout-plans/\(planId)")
        const { status, body } = await json(
            await getWorkoutPlan(request('GET', `/api/workout-plans/${plan.id}`), { params: Promise.resolve({ id: plan.id }) })
        );
        expect(status).toBe(200);

        const data = body as { workoutDays: Array<{ items: unknown[] }> };
        expect(data.workoutDays.length).toBeGreaterThan(0);
        expect(data.workoutDays[0].items.length).toBeGreaterThan(0);

        expectShape(body, workoutPlanDetail);
    });

    // C05: GET /api/diets -> [PersonalDietPlan]
    it('C05: GET /api/diets decodes as [PersonalDietPlan]', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Plano Cutting',
                calories: 2000,
                protein: 160,
                carbs: 180,
                fat: 60,
                active: true,
                meals: {
                    create: [{ name: 'Café da manhã', time: '08:00', order: 0, foods: '[]' }],
                },
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await listDiets(request('GET', '/api/diets')));
        expect(status).toBe(200);

        const diets = envelopeData(body) as Array<{ meals: unknown[] }>;
        expect(diets.length).toBeGreaterThan(0);
        expect(diets[0].meals.length).toBeGreaterThan(0);

        expectShape(diets, [personalDietPlan]);
    });

    // C06: GET /api/diets/[id] -> DietPlanDetail
    // QUEBRADO: o app iOS (DietPlanDetail / DietMealRaw) espera `foods` como String JSON (`let foods: String`),
    // mas o servidor retorna `foods` como Array de objetos parseados (`[DietFood]`).
    it.fails('C06: GET /api/diets/[id] decodes as DietPlanDetail', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const plan = await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Plano Bulking',
                calories: 3000,
                protein: 200,
                carbs: 350,
                fat: 80,
                active: true,
                meals: {
                    create: [
                        {
                            name: 'Almoço',
                            time: '12:30',
                            order: 0,
                            notes: 'Beber água 30m após',
                            foods: JSON.stringify([
                                {
                                    foodId: 'food-1',
                                    name: 'Arroz branco',
                                    quantity: 200,
                                    portion: '100g',
                                    calories: 260,
                                    protein: 5,
                                    carbs: 56,
                                    fat: 1,
                                },
                            ]),
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(
            await getDiet(request('GET', `/api/diets/${plan.id}`), { params: Promise.resolve({ id: plan.id }) })
        );
        expect(status).toBe(200);

        const data = envelopeData(body) as { meals: unknown[] };
        expect(data.meals.length).toBeGreaterThan(0);

        expectShape(data, dietPlanDetail);
    });

    // C07: GET /api/workout-templates -> [WorkoutTemplateSummary]
    it('C07: GET /api/workout-templates decodes as [WorkoutTemplateSummary]', async () => {
        const trainer = await createPersonal();
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Puxada Frontal', muscleGroup: 'Costas' },
        });
        await prisma.workoutTemplate.create({
            data: {
                personalId: trainer.personal.id,
                title: 'Template Costas e Bíceps',
                description: 'Foco em dorsal',
                templateDays: {
                    create: [
                        {
                            name: 'Costas A',
                            dayOfWeek: 1,
                            order: 0,
                            items: {
                                create: [
                                    {
                                        exerciseId: exerciseRecord.id,
                                        sets: 3,
                                        reps: '10-12',
                                        rest: 60,
                                        load: '45kg',
                                        rpe: '8',
                                        groupId: 'group-1',
                                        order: 0,
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await listWorkoutTemplates());
        expect(status).toBe(200);

        const templates = envelopeData(body) as Array<{ templateDays: Array<{ items: unknown[] }> }>;
        expect(templates.length).toBeGreaterThan(0);
        expect(templates[0].templateDays.length).toBeGreaterThan(0);
        expect(templates[0].templateDays[0].items.length).toBeGreaterThan(0);

        expectShape(templates, [workoutTemplateSummary]);
    });

    // C08: GET /api/diet-templates -> [DietTemplateSummary]
    it('C08: GET /api/diet-templates decodes as [DietTemplateSummary]', async () => {
        const trainer = await createPersonal();
        await prisma.dietTemplate.create({
            data: {
                personalId: trainer.personal.id,
                title: 'Template Hipertrofia 2500kcal',
                calories: 2500,
                protein: 175,
                carbs: 280,
                fat: 65,
                meals: {
                    create: [
                        {
                            name: 'Jantar',
                            time: '20:00',
                            order: 0,
                            foods: JSON.stringify([
                                {
                                    foodId: 'food-2',
                                    name: 'Frango grelhado',
                                    portion: '100g',
                                    quantity: 150,
                                    calories: 240,
                                    protein: 45,
                                    carbs: 0,
                                    fat: 5,
                                },
                            ]),
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await listDietTemplates(request('GET', '/api/diet-templates')));
        expect(status).toBe(200);

        const templates = envelopeData(body) as Array<{ meals: Array<{ items: unknown[] }> }>;
        expect(templates.length).toBeGreaterThan(0);
        expect(templates[0].meals.length).toBeGreaterThan(0);
        expect(templates[0].meals[0].items.length).toBeGreaterThan(0);

        expectShape(templates, [dietTemplateSummary]);
    });

    // C09: GET /api/exercises -> [ExerciseFull]
    it('C09: GET /api/exercises decodes as [ExerciseFull]', async () => {
        const trainer = await createPersonal();
        await prisma.exercise.create({
            data: {
                name: 'Desenvolvimento com Halteres',
                muscleGroup: 'Ombros',
                equipment: 'Halteres',
                difficulty: 'INTERMEDIARIO',
                videoUrl: 'https://youtube.com/watch?v=desenv',
                instructions: 'Eleve os halteres acima da cabeça',
                tips: 'Mantenha os cotovelos alinhados',
                personalId: trainer.personal.id,
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await listExercises(request('GET', '/api/exercises')));
        expect(status).toBe(200);

        const exercises = envelopeData(body) as unknown[];
        expect(exercises.length).toBeGreaterThan(0);

        expectShape(exercises, [exerciseFull]);
    });

    // C10: GET /api/foods/search -> [FoodSearchItem]
    it('C10: GET /api/foods/search decodes as [FoodSearchItem]', async () => {
        const trainer = await createPersonal();
        signIn(trainer.session);

        const { status, body } = await json(await searchFoods(request('GET', '/api/foods/search?q=arroz')));
        expect(status).toBe(200);

        const foods = envelopeData(body) as unknown[];
        expect(foods.length).toBeGreaterThan(0);

        expectShape(foods, [foodSearchItem]);
    });

    // C11: GET /api/personal/notifications -> NotificationsPayload
    it('C11: GET /api/personal/notifications decodes as NotificationsPayload', async () => {
        const trainer = await createPersonal();
        const { student, user: studentUserRecord } = await createStudent(trainer.personal.id);

        await prisma.notification.create({
            data: {
                userId: trainer.user.id,
                type: 'WORKOUT_REMINDER',
                title: 'Aluno inativo',
                body: 'Aluno não treina há 3 dias',
                read: false,
            },
        });

        await prisma.message.create({
            data: {
                fromUserId: studentUserRecord.id,
                toUserId: trainer.user.id,
                text: 'Olá professor!',
                read: false,
            },
        });

        signIn(trainer.session);
        const { status, body } = await json(await getPersonalNotifications(request('GET', '/api/personal/notifications')));
        expect(status).toBe(200);

        const payload = envelopeData(body) as { notifications: unknown[] };
        expect(payload.notifications.length).toBeGreaterThan(0);

        expectShape(payload, notificationsPayload);
    });
});
