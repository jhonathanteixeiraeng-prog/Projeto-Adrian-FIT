import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));
vi.mock('next-auth/next', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth/next')>()), getServerSession: vi.fn() }));

import { getServerSession } from 'next-auth';
import { getServerSession as getServerSessionNext } from 'next-auth/next';

import { POST as createStudentRoute } from '@/app/api/students/route';
import { PUT as updateStudentRoute } from '@/app/api/students/[id]/route';
import { POST as createWorkoutPlanRoute } from '@/app/api/workout-plans/route';
import { PUT as updateWorkoutPlanRoute } from '@/app/api/workout-plans/[id]/route';
import { PUT as updateDietRoute } from '@/app/api/diets/[id]/route';
import { POST as createWorkoutPlanFromTemplateRoute } from '@/app/api/workout-plans/from-template/route';
import { POST as createDietPlanRoute } from '@/app/api/diet-plans/route';
import { POST as createDietPlanFromTemplateRoute } from '@/app/api/diet-plans/from-template/route';
import { POST as createWorkoutTemplateFromPlanRoute } from '@/app/api/workout-templates/from-plan/route';
import { POST as createDietTemplateRoute } from '@/app/api/diet-templates/route';
import { POST as createDietTemplateFromPlanRoute } from '@/app/api/diet-templates/from-plan/route';
import { POST as createExerciseRoute } from '@/app/api/exercises/route';
import { PUT as updateExerciseRoute } from '@/app/api/exercises/[id]/route';
import { POST as createFoodRoute } from '@/app/api/foods/route';
import { PATCH as updatePersonalNotificationsRoute } from '@/app/api/personal/notifications/route';
import { PUT as updateProfileRoute } from '@/app/api/profile/route';

import { envelopeData, expectAck, expectShape, optional, type Shape } from '../../helpers/contract';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../../helpers/db';
import { json, request, signIn as baseSignIn, type TestSession } from '../../helpers/http';

function signIn(session: TestSession | null) {
    baseSignIn(session);
    vi.mocked(getServerSessionNext).mockImplementation(vi.mocked(getServerSession) as never);
}

beforeEach(async () => {
    await resetDatabase();
    vi.mocked(getServerSessionNext).mockImplementation(vi.mocked(getServerSession) as never);
});

// --- Shapes copied from iOS Swift models ---

// ios/AdrianFit/AdrianFit/Core/Models.swift:888
const identifiedValue: Shape = {
    // IdentifiedValue
    id: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Personal/StudentFormView.swift:137
const created: Shape = {
    // Created
    id: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Personal/StudentFormView.swift:342
const updated: Shape = {
    // Updated
    id: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Personal/ExercisesLibraryView.swift:199
const saved: Shape = {
    // Saved
    id: 'string',
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

// ios/AdrianFit/AdrianFit/Core/EditingModels.swift:390
const dietMealRaw: Shape = {
    // DietMealRaw
    id: 'string',
    name: 'string',
    time: 'string',
    foods: 'string',
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

describe('iOS contract: personal write (Group 2)', () => {
    // C12: POST /api/students -> Created
    it('C12: POST /api/students decodes as Created', async () => {
        const trainer = await createPersonal();
        signIn(trainer.session);

        const body = {
            name: 'Aluno Novo Contrato',
            email: 'aluno-novo-contrato@example.com',
            phone: '11988887777',
            password: 'senha-aluno-123',
        };

        const { status, body: resBody } = await json(await createStudentRoute(request('POST', '/api/students', body)));
        expect(status).toBe(200);

        const data = envelopeData(resBody);
        expectShape(data, created);
    });

    // C13: PUT /api/students/[id] -> Updated / APIAck
    it('C13: PUT /api/students/[id] decodes as Updated and APIAck', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        signIn(trainer.session);

        const body = {
            name: 'Aluno Atualizado',
            phone: '11977776666',
            goal: 'Hipertrofia',
        };

        const { status, body: resBody } = await json(
            await updateStudentRoute(request('PUT', `/api/students/${student.id}`, body), { params: Promise.resolve({ id: student.id }) })
        );
        expect(status).toBe(200);

        // StudentFormView decodes as Updated
        const data = envelopeData(resBody);
        expectShape(data, updated);

        // DietPlanEditorView decodes with putAck
        expectAck(resBody);
    });

    // C14: POST /api/workout-plans -> WorkoutPlanDetail
    it('C14: POST /api/workout-plans decodes as WorkoutPlanDetail', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Leg Press 45', muscleGroup: 'Pernas', equipment: 'Aparelho', difficulty: 'INICIANTE' },
        });

        signIn(trainer.session);

        const body = {
            title: 'Ficha Hipertrofia B',
            studentId: student.id,
            startDate: '2026-10-01',
            endDate: '2026-12-01',
            active: true,
            workoutDays: [
                {
                    name: 'Treino A',
                    dayOfWeek: 1,
                    items: [
                        {
                            exerciseId: exerciseRecord.id,
                            sets: 4,
                            reps: '10',
                            rest: 60,
                            restBySet: JSON.stringify([60, 60, 60, 60]),
                            load: '100kg',
                            rpe: '8',
                            groupId: 'g1',
                            notes: 'Descer até 90 graus',
                        },
                    ],
                },
            ],
        };

        const { status, body: resBody } = await json(await createWorkoutPlanRoute(request('POST', '/api/workout-plans', body)));
        expect(status).toBe(201);

        const data = envelopeData(resBody) as { workoutDays: Array<{ items: unknown[] }> };
        expect(data.workoutDays.length).toBeGreaterThan(0);
        expect(data.workoutDays[0].items.length).toBeGreaterThan(0);

        expectShape(data, workoutPlanDetail);
    });

    // C15: PUT /api/workout-plans/[id] (sem ids) -> WorkoutPlanDetail
    it('C15: PUT /api/workout-plans/[id] (sem ids) decodes as WorkoutPlanDetail', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const plan = await createWorkoutPlan(student.id, trainer.personal.id, 'Ficha Inicial');
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Crucifixo Reto', muscleGroup: 'Peito', equipment: 'Halteres', difficulty: 'INTERMEDIARIO' },
        });

        signIn(trainer.session);

        // App sends days and items without IDs when saving
        const body = {
            title: 'Ficha Inicial Atualizada',
            startDate: '2026-10-05',
            endDate: '2026-12-05',
            active: true,
            workoutDays: [
                {
                    name: 'Treino Superior',
                    dayOfWeek: 2,
                    items: [
                        {
                            exerciseId: exerciseRecord.id,
                            sets: 3,
                            reps: '12',
                            rest: 45,
                            restBySet: JSON.stringify([45, 45, 45]),
                            load: '14kg',
                            rpe: '7',
                            groupId: null,
                            notes: 'Movimento controlado',
                        },
                    ],
                },
            ],
        };

        const { status, body: resBody } = await json(
            await updateWorkoutPlanRoute(request('PUT', `/api/workout-plans/${plan.id}`, body), { params: Promise.resolve({ id: plan.id }) })
        );
        expect(status).toBe(200);

        const data = envelopeData(resBody) as { workoutDays: Array<{ items: unknown[] }> };
        expect(data.workoutDays.length).toBeGreaterThan(0);
        expect(data.workoutDays[0].items.length).toBeGreaterThan(0);

        expectShape(data, workoutPlanDetail);
    });

    // C16: PUT /api/diets/[id] (sem version) -> DietPlanDetail
    it('C16: PUT /api/diets/[id] (sem version) decodes as DietPlanDetail', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const plan = await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Dieta Antiga',
                calories: 2200,
                protein: 150,
                carbs: 250,
                fat: 65,
                active: true,
                meals: {
                    create: [{ name: 'Almoço', time: '12:00', order: 0, foods: '[]' }],
                },
            },
        });

        signIn(trainer.session);

        // iOS app sends update without version
        const body = {
            title: 'Dieta Nova Atualizada',
            calories: 2400,
            protein: 170,
            carbs: 270,
            fat: 70,
            active: true,
            meals: [
                {
                    name: 'Almoço Completo',
                    time: '12:30',
                    notes: 'Almoço reforçado',
                    items: [
                        {
                            foodId: 'food-arroz',
                            name: 'Arroz integral',
                            portion: '100g',
                            quantity: 150,
                            calories: 195,
                            protein: 4,
                            carbs: 42,
                            fat: 1.5,
                        },
                    ],
                },
            ],
        };

        const { status, body: resBody } = await json(
            await updateDietRoute(request('PUT', `/api/diets/${plan.id}`, body), { params: Promise.resolve({ id: plan.id }) })
        );
        expect(status).toBe(200);

        const data = envelopeData(resBody) as { meals: unknown[] };
        expect(data.meals.length).toBeGreaterThan(0);

        expectShape(data, dietPlanDetail);
    });

    // C17: POST /api/workout-plans/from-template -> IdentifiedValue
    it('C17: POST /api/workout-plans/from-template decodes as IdentifiedValue', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Remada Curvada', muscleGroup: 'Costas' },
        });
        const template = await prisma.workoutTemplate.create({
            data: {
                personalId: trainer.personal.id,
                title: 'Modelo Costas',
                templateDays: {
                    create: [
                        {
                            name: 'Dia Costas',
                            dayOfWeek: 1,
                            order: 0,
                            items: {
                                create: [{ exerciseId: exerciseRecord.id, sets: 4, reps: '10', rest: 60, order: 0 }],
                            },
                        },
                    ],
                },
            },
        });

        signIn(trainer.session);

        const body = {
            templateId: template.id,
            studentId: student.id,
            title: 'Ficha Clonada',
            startDate: '2026-10-01',
            endDate: '2026-12-01',
        };

        const { status, body: resBody } = await json(
            await createWorkoutPlanFromTemplateRoute(request('POST', '/api/workout-plans/from-template', body))
        );
        expect(status).toBe(201);

        const data = envelopeData(resBody);
        expectShape(data, identifiedValue);
    });

    // C18: POST /api/diet-plans e /api/diet-plans/from-template -> IdentifiedValue (postRaw)
    it('C18: POST /api/diet-plans e /api/diet-plans/from-template decode as IdentifiedValue (raw body)', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        signIn(trainer.session);

        // 1. POST /api/diet-plans
        const createPlanBody = {
            title: 'Plano Direto',
            studentId: student.id,
            targetCalories: 2100,
            targetProtein: 150,
            targetCarbs: 220,
            targetFat: 65,
            active: true,
            meals: [
                {
                    name: 'Ceia',
                    time: '22:00',
                    items: [
                        {
                            name: 'Iogurte natural',
                            portion: '170g',
                            quantity: 1,
                            calories: 100,
                            protein: 10,
                            carbs: 8,
                            fat: 3,
                        },
                    ],
                },
            ],
        };

        const res1 = await json(await createDietPlanRoute(request('POST', '/api/diet-plans', createPlanBody)));
        expect(res1.status).toBe(201);
        expectShape(res1.body, identifiedValue);

        // 2. POST /api/diet-plans/from-template
        const template = await prisma.dietTemplate.create({
            data: {
                personalId: trainer.personal.id,
                title: 'Modelo para clonar',
                calories: 2000,
                protein: 150,
                carbs: 200,
                fat: 60,
                meals: {
                    create: [
                        {
                            name: 'Almoço',
                            time: '12:00',
                            order: 0,
                            foods: JSON.stringify([
                                { name: 'Arroz', portion: '100g', quantity: 100, calories: 130, protein: 2.5, carbs: 28, fat: 0.3 },
                            ]),
                        },
                    ],
                },
            },
        });

        const cloneBody = {
            templateId: template.id,
            studentId: student.id,
            title: 'Dieta Clonada',
        };

        const res2 = await json(await createDietPlanFromTemplateRoute(request('POST', '/api/diet-plans/from-template', cloneBody)));
        expect(res2.status).toBe(201);
        expectShape(res2.body, identifiedValue);
    });

    // C19: POST /api/workout-templates/from-plan, /api/diet-templates e /api/diet-templates/from-plan -> IdentifiedValue
    it('C19: POST /api/workout-templates/from-plan, /api/diet-templates e /api/diet-templates/from-plan decode as IdentifiedValue', async () => {
        const trainer = await createPersonal();
        const { student } = await createStudent(trainer.personal.id);
        signIn(trainer.session);

        // 1. POST /api/workout-templates/from-plan
        const workoutPlan = await createWorkoutPlan(student.id, trainer.personal.id, 'Ficha para Template');
        const resWorkoutFromPlan = await json(
            await createWorkoutTemplateFromPlanRoute(
                request('POST', '/api/workout-templates/from-plan', { planId: workoutPlan.id, title: 'Modelo Treino' })
            )
        );
        expect(resWorkoutFromPlan.status).toBe(201);
        expectShape(envelopeData(resWorkoutFromPlan.body), identifiedValue);

        // 2. POST /api/diet-templates
        const dietTemplateBody = {
            title: 'Novo Modelo Dieta',
            calories: 2500,
            protein: 180,
            carbs: 250,
            fat: 70,
            meals: [
                {
                    name: 'Café',
                    time: '07:30',
                    items: [
                        { name: 'Ovos mexidos', portion: '2 unidades', quantity: 2, calories: 140, protein: 12, carbs: 1, fat: 10 },
                    ],
                },
            ],
        };
        const resDietTemplate = await json(await createDietTemplateRoute(request('POST', '/api/diet-templates', dietTemplateBody)));
        expect(resDietTemplate.status).toBe(201);
        expectShape(envelopeData(resDietTemplate.body), identifiedValue);

        // 3. POST /api/diet-templates/from-plan
        const dietPlan = await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Dieta para Template',
                calories: 2000,
                protein: 150,
                carbs: 200,
                fat: 60,
                active: true,
                meals: {
                    create: [
                        {
                            name: 'Almoço',
                            time: '12:00',
                            order: 0,
                            foods: JSON.stringify([{ name: 'Frango', portion: '100g', quantity: 150, calories: 240, protein: 45, carbs: 0, fat: 5 }]),
                        },
                    ],
                },
            },
        });
        const resDietFromPlan = await json(
            await createDietTemplateFromPlanRoute(
                request('POST', '/api/diet-templates/from-plan', { planId: dietPlan.id, title: 'Modelo Dieta from Plan' })
            )
        );
        expect(resDietFromPlan.status).toBe(201);
        expectShape(envelopeData(resDietFromPlan.body), identifiedValue);
    });

    // C20: POST /api/exercises e PUT /api/exercises/[id] -> Saved (raw body)
    it('C20: POST /api/exercises e PUT /api/exercises/[id] decode as Saved (raw body)', async () => {
        const trainer = await createPersonal();
        signIn(trainer.session);

        // 1. POST /api/exercises
        const createBody = {
            name: 'Elevação Lateral Halteres',
            muscleGroup: 'Ombros',
            equipment: 'Halteres',
            difficulty: 'INICIANTE',
            instructions: 'Eleve os braços até a linha dos ombros',
            tips: 'Controle na descida',
        };
        const res1 = await json(await createExerciseRoute(request('POST', '/api/exercises', createBody)));
        expect(res1.status).toBe(201);
        expectShape(res1.body, saved);

        const createdId = (res1.body as { id: string }).id;

        // 2. PUT /api/exercises/[id]
        const updateBody = {
            name: 'Elevação Lateral Halteres Modificado',
            muscleGroup: 'Ombros',
            equipment: 'Halteres',
            difficulty: 'INTERMEDIARIO',
        };
        const res2 = await json(
            await updateExerciseRoute(request('PUT', `/api/exercises/${createdId}`, updateBody), { params: Promise.resolve({ id: createdId }) })
        );
        expect(res2.status).toBe(200);
        expectShape(res2.body, saved);
    });

    // C21: POST /api/foods -> FoodSearchItem
    it('C21: POST /api/foods decodes as FoodSearchItem', async () => {
        const trainer = await createPersonal();
        signIn(trainer.session);

        const body = {
            name: 'Whey Protein Isolado Teste',
            portion: '30g',
            calories: 120,
            protein: 27,
            carbs: 1,
            fat: 0.5,
        };

        const { status, body: resBody } = await json(await createFoodRoute(request('POST', '/api/foods', body)));
        expect(status).toBe(200);

        const data = envelopeData(resBody);
        expectShape(data, foodSearchItem);
    });

    // C22: PATCH /api/personal/notifications e PUT /api/profile -> APIAck
    it('C22: PATCH /api/personal/notifications e PUT /api/profile decode as APIAck', async () => {
        const trainer = await createPersonal();
        const notification = await prisma.notification.create({
            data: {
                userId: trainer.user.id,
                type: 'WORKOUT_REMINDER',
                title: 'Aviso Teste',
                body: 'Corpo aviso',
                read: false,
            },
        });

        signIn(trainer.session);

        // 1. PATCH /api/personal/notifications
        const resNotif = await json(
            await updatePersonalNotificationsRoute(request('PATCH', '/api/personal/notifications', { id: notification.id }))
        );
        expect(resNotif.status).toBe(200);
        expectAck(resNotif.body);

        // 2. PUT /api/profile
        const resProfile = await json(
            await updateProfileRoute(request('PUT', '/api/profile', { name: 'Personal Atualizado', phone: '11999990000' }))
        );
        expect(resProfile.status).toBe(200);
        expectAck(resProfile.body);
    });
});
