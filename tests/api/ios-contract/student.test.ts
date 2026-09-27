import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));
vi.mock('next-auth/next', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth/next')>()), getServerSession: vi.fn() }));

import { getServerSession } from 'next-auth';
import { getServerSession as getServerSessionNext } from 'next-auth/next';

import { GET as getStudentDashboard } from '@/app/api/student/dashboard/route';
import { GET as getStudentPersonal } from '@/app/api/student/personal/route';
import { GET as getStudentWorkoutPlan } from '@/app/api/student/workout-plan/route';
import { GET as getWorkoutHistory } from '@/app/api/student/workout/history/route';
import { GET as getSetLogs, POST as saveSetLog } from '@/app/api/student/set-logs/route';
import { POST as completeWorkout } from '@/app/api/student/workout/complete/route';
import { POST as syncHealthMetrics } from '@/app/api/student/workout/health-metrics/route';
import { GET as getStudentDiet } from '@/app/api/student/diet/route';
import { POST as completeDietMeal } from '@/app/api/student/diet/complete/route';
import { GET as getStudentAdherence } from '@/app/api/student/adherence/route';
import { GET as listCheckins, POST as createCheckin } from '@/app/api/checkins/route';
import { GET as listPhotos, POST as createPhoto } from '@/app/api/student/photos/route';
import { GET as getStudentNotifications, PATCH as updateStudentNotifications } from '@/app/api/student/notifications/route';
import { GET as listMessages, POST as sendMessage } from '@/app/api/messages/[id]/route';

import { envelopeData, expectAck, expectShape, optional, type Shape } from '../../helpers/contract';
import { createPersonal, createStudent, prisma, resetDatabase } from '../../helpers/db';
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

// ios/AdrianFit/AdrianFit/Core/Models.swift:615
const dietMeal: Shape = {
    // DietMeal
    id: 'string',
    name: 'string',
    time: 'string',
    foods: [dietFood],
    notes: 'string?',
    calories: 'number?',
    completed: 'boolean?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:605
const dietPlan: Shape = {
    // DietPlan
    id: 'string',
    title: 'string',
    calories: 'number?',
    protein: 'number?',
    carbs: 'number?',
    fat: 'number?',
    meals: [dietMeal],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:116
const todayExercise: Shape = {
    // TodayExercise
    id: 'string',
    name: 'string',
    sets: 'number',
    reps: 'string',
    rest: 'number',
    load: 'string?',
    rpe: 'string?',
    groupId: 'string?',
    completed: 'boolean',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:47
const todayWorkout: Shape = {
    // TodayWorkout
    id: 'string',
    name: 'string',
    exercises: [todayExercise],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:34
const personalSummary: Shape = {
    // PersonalSummary
    name: 'string',
    brandName: 'string',
    avatar: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:40
const studentStats: Shape = {
    // StudentStats
    streak: 'number',
    weeklyWorkouts: 'number',
    weeklyGoal: 'number',
    nextCheckin: 'string',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:27
const studentDashboard: Shape = {
    // StudentDashboard
    personal: personalSummary,
    workout: optional(todayWorkout),
    diet: optional(dietPlan),
    stats: studentStats,
};

// ios/AdrianFit/AdrianFit/Features/Student/StudentHomeView.swift:346
const personalContact: Shape = {
    // PersonalContact
    user: {
        id: 'string',
    },
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:166
const exerciseItem: Shape = {
    // ExerciseItem
    id: 'string',
    exerciseId: 'string?',
    name: 'string',
    muscleGroup: 'string',
    sets: 'number',
    reps: 'string',
    rest: 'number',
    restBySet: optional(['number']),
    load: 'string?',
    rpe: 'string?',
    groupId: 'string?',
    notes: 'string?',
    videoUrl: 'string?',
    instructions: 'string?',
    equipment: 'string?',
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:150
const workoutDay: Shape = {
    // WorkoutDay
    id: 'string',
    name: 'string',
    dayOfWeek: 'number',
    exercises: [exerciseItem],
};

// ios/AdrianFit/AdrianFit/Core/Models.swift:138
const workoutPlan: Shape = {
    // WorkoutPlan
    id: 'string',
    title: 'string',
    startDate: 'string',
    endDate: 'string',
    workoutDays: [workoutDay],
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:84
const workoutSessionSet: Shape = {
    // WorkoutSessionSet
    setIndex: 'number',
    weight: 'number',
    reps: 'number',
    volume: 'number',
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:64
const workoutSessionExercise: Shape = {
    // WorkoutSessionExercise
    exerciseId: 'string',
    name: 'string',
    muscleGroup: 'string',
    bestWeight: 'number',
    totalVolume: 'number',
    sets: [workoutSessionSet],
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:37
const workoutSessionRecord: Shape = {
    // WorkoutSessionRecord
    id: 'string',
    workoutDayId: 'string',
    dayName: 'string',
    localDate: 'string',
    status: 'string',
    startedAt: 'string',
    completedAt: 'string',
    completedSets: 'number',
    totalSets: 'number',
    percentage: 'number',
    durationSeconds: 'number',
    totalVolume: 'number',
    activeEnergyKilocalories: 'number?',
    averageHeartRateBPM: 'number?',
    maxHeartRateBPM: 'number?',
    healthWorkoutUUID: 'string?',
    legacy: 'boolean?',
    exercises: [workoutSessionExercise],
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:99
const exerciseProgressPoint: Shape = {
    // ExerciseProgressPoint
    localDate: 'string',
    bestWeight: 'number',
    volume: 'number',
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:84
const exerciseProgressRecord: Shape = {
    // ExerciseProgressRecord
    exerciseId: 'string',
    name: 'string',
    muscleGroup: 'string',
    bestWeight: 'number',
    firstWeight: 'number',
    latestWeight: 'number',
    changePercentage: 'number',
    totalSets: 'number',
    totalVolume: 'number',
    points: [exerciseProgressPoint],
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:27
const workoutHistorySummary: Shape = {
    // WorkoutHistorySummary
    workoutsThisWeek: 'number',
    totalWorkouts: 'number',
    weeklyGoal: 'number',
    weeklyStreak: 'number',
    totalVolume: 'number',
    averageDurationSeconds: 'number',
    averageCompletionPercentage: 'number',
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:21
const workoutHistoryResponse: Shape = {
    // WorkoutHistoryResponse
    summary: workoutHistorySummary,
    sessions: [workoutSessionRecord],
    exerciseProgress: [exerciseProgressRecord],
};

// ios/AdrianFit/AdrianFit/Features/Student/WorkoutPlanView.swift:1028
const setLogEntry: Shape = {
    // SetLogEntry
    exerciseId: 'string',
    setIndex: 'number',
    weight: 'number',
    reps: 'number',
};

// ios/AdrianFit/AdrianFit/Features/Student/WorkoutPlanView.swift:1035
const exercisePR: Shape = {
    // ExercisePR
    exerciseId: 'string',
    weight: 'number',
};

// ios/AdrianFit/AdrianFit/Features/Student/WorkoutPlanView.swift:1040
const sessionLogs: Shape = {
    // SessionLogs
    today: [setLogEntry],
    previous: [setLogEntry],
    prs: [exercisePR],
};

// ios/AdrianFit/AdrianFit/Features/Student/WorkoutPlanView.swift:750
const savedLog: Shape = {
    // Saved
    id: 'string?',
    removed: 'boolean?',
};

// ios/AdrianFit/AdrianFit/Core/WorkoutHistoryModels.swift:16
const workoutCompletionResult: Shape = {
    // WorkoutCompletionResult
    id: 'string',
    percentage: 'number',
};

// ios/AdrianFit/AdrianFit/Core/PhoneWorkoutConnectivity.swift:80
const healthMetricsResult: Shape = {
    // Result
    id: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Student/StudentHomeView.swift:270
const dietCompleteResult: Shape = {
    // Result
    mealId: 'string',
    completed: 'boolean',
};

// ios/AdrianFit/AdrianFit/Features/Student/StudentProgressView.swift:40
const adherenceMetric: Shape = {
    // AdherenceMetric
    adherence: 'number',
    summary: 'string',
};

// ios/AdrianFit/AdrianFit/Features/Student/StudentProgressView.swift:45
const adherenceData: Shape = {
    // AdherenceData
    workout: adherenceMetric,
    diet: adherenceMetric,
};

// ios/AdrianFit/AdrianFit/Features/Student/StudentProgressView.swift:6
const checkinFull: Shape = {
    // CheckinFull
    id: 'string',
    date: 'string',
    weight: 'number',
    sleepHours: 'number?',
    energyLevel: 'number?',
    hungerLevel: 'number?',
    stressLevel: 'number?',
    workoutAdherence: 'number',
    dietAdherence: 'number',
    notes: 'string?',
    chest: 'number?',
    waist: 'number?',
    abdomen: 'number?',
    hips: 'number?',
    armRight: 'number?',
    armLeft: 'number?',
    thighRight: 'number?',
    thighLeft: 'number?',
    calfRight: 'number?',
    calfLeft: 'number?',
    bodyFatPercentage: 'number?',
};

// ios/AdrianFit/AdrianFit/Features/Student/ProgressPhotosView.swift:5
const remoteProgressPhoto: Shape = {
    // RemoteProgressPhoto
    id: 'string',
    url: 'string',
    angle: 'string',
    weight: 'number?',
    createdAt: 'string',
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

// ios/AdrianFit/AdrianFit/Core/Models.swift:849
const chatMessage: Shape = {
    // ChatMessage
    id: 'string',
    fromMe: 'boolean',
    text: 'string',
    time: 'string',
    read: 'boolean',
    createdAt: 'string',
};

describe('iOS contract: student (Group 3)', () => {
    // C23: GET /api/student/dashboard -> StudentDashboard
    it('C23: GET /api/student/dashboard decodes as StudentDashboard', async () => {
        const trainer = await createPersonal({ name: 'Adrian Trainer' });
        await prisma.personal.update({
            where: { id: trainer.personal.id },
            data: { brandName: 'Adrian Fitness Coaching' },
        });

        const { student, session } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Puxada Aberta', muscleGroup: 'Costas' },
        });

        const todayDayOfWeek = new Date().getUTCDay();
        await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Plano Atual',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [
                        {
                            dayOfWeek: todayDayOfWeek,
                            name: 'Treino de Hoje',
                            order: 0,
                            items: {
                                create: [{ exerciseId: exerciseRecord.id, sets: 3, reps: '10', rest: 60, order: 0 }],
                            },
                        },
                    ],
                },
            },
        });

        await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Dieta Atual',
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
                            foods: JSON.stringify([
                                { name: 'Arroz', portion: '100g', quantity: 150, calories: 195, protein: 4, carbs: 42, fat: 1.5 },
                            ]),
                        },
                    ],
                },
            },
        });

        signIn(session);
        const { status, body } = await json(await getStudentDashboard(request('GET', '/api/student/dashboard')));
        expect(status).toBe(200);

        const data = envelopeData(body) as { workout?: { exercises: unknown[] }; diet?: { meals: unknown[] } };
        expect(data.workout).toBeDefined();
        expect(data.workout!.exercises.length).toBeGreaterThan(0);
        expect(data.diet).toBeDefined();
        expect(data.diet!.meals.length).toBeGreaterThan(0);

        expectShape(data, studentDashboard);
    });

    // C24: GET /api/student/personal -> PersonalContact
    it('C24: GET /api/student/personal decodes as PersonalContact', async () => {
        const trainer = await createPersonal();
        const { session } = await createStudent(trainer.personal.id);

        signIn(session);
        const { status, body } = await json(await getStudentPersonal(request('GET', '/api/student/personal')));
        expect(status).toBe(200);

        const data = envelopeData(body);
        expectShape(data, personalContact);
    });

    // C25: GET /api/student/workout-plan -> WorkoutPlan
    it('C25: GET /api/student/workout-plan decodes as WorkoutPlan', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Rosca Direta', muscleGroup: 'Braços', equipment: 'Barra W' },
        });

        await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Braços',
                active: true,
                startDate: new Date('2026-09-10T12:00:00Z'),
                endDate: new Date('2026-11-10T12:00:00Z'),
                workoutDays: {
                    create: [
                        {
                            dayOfWeek: 3,
                            name: 'Treino Braços',
                            order: 0,
                            items: {
                                create: [
                                    {
                                        exerciseId: exerciseRecord.id,
                                        sets: 3,
                                        reps: '12',
                                        rest: 60,
                                        restBySet: JSON.stringify([60, 60, 60]),
                                        load: '20kg',
                                        rpe: '8',
                                        order: 0,
                                    },
                                ],
                            },
                        },
                    ],
                },
            },
        });

        signIn(session);
        const { status, body } = await json(await getStudentWorkoutPlan(request('GET', '/api/student/workout-plan')));
        expect(status).toBe(200);

        const data = envelopeData(body) as { workoutDays: Array<{ exercises: unknown[] }> };
        expect(data.workoutDays.length).toBeGreaterThan(0);
        expect(data.workoutDays[0].exercises.length).toBeGreaterThan(0);

        expectShape(data, workoutPlan);
    });

    // C26: GET /api/student/workout/history -> WorkoutHistoryResponse
    it('C26: GET /api/student/workout/history decodes as WorkoutHistoryResponse', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Agachamento Barra', muscleGroup: 'Pernas' },
        });

        const plan = await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Pernas Histórico',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [{ dayOfWeek: 1, name: 'Pernas A', order: 0 }],
                },
            },
            include: { workoutDays: true },
        });
        const day = plan.workoutDays[0];

        const workoutSessionRecordDb = await prisma.workoutSession.create({
            data: {
                studentId: student.id,
                workoutDayId: day.id,
                dayName: 'Pernas A',
                localDate: '2026-09-25',
                status: 'COMPLETED',
                startedAt: new Date('2026-09-25T14:00:00Z'),
                completedAt: new Date('2026-09-25T15:00:00Z'),
                completedSets: 4,
                totalSets: 4,
                percentage: 100,
                durationSeconds: 3600,
                totalVolume: 4000,
                activeEnergyKilocalories: 450,
                averageHeartRateBPM: 135,
                maxHeartRateBPM: 165,
                healthWorkoutUUID: 'uuid-1234',
            },
        });

        await prisma.setLog.create({
            data: {
                studentId: student.id,
                dayId: day.id,
                exerciseId: exerciseRecord.id,
                setIndex: 0,
                weight: 100,
                reps: 10,
                localDate: '2026-09-25',
                date: new Date('2026-09-25T14:10:00Z'),
                sessionId: workoutSessionRecordDb.id,
            },
        });

        signIn(session);
        const { status, body } = await json(
            await getWorkoutHistory(request('GET', '/api/student/workout/history?today=2026-09-27'))
        );
        expect(status).toBe(200);

        const data = envelopeData(body) as { sessions: Array<{ exercises: unknown[] }>; exerciseProgress: unknown[] };
        expect(data.sessions.length).toBeGreaterThan(0);
        expect(data.sessions[0].exercises.length).toBeGreaterThan(0);
        expect(data.exerciseProgress.length).toBeGreaterThan(0);

        expectShape(data, workoutHistoryResponse);
    });

    // C27: GET e POST /api/student/set-logs -> SessionLogs / Saved
    it('C27: GET e POST /api/student/set-logs decode as SessionLogs and Saved', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Tríceps Corda', muscleGroup: 'Braços' },
        });

        const plan = await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Tríceps',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [
                        {
                            dayOfWeek: 4,
                            name: 'Tríceps Dia',
                            order: 0,
                            items: {
                                create: [{ exerciseId: exerciseRecord.id, sets: 3, reps: '10', rest: 60, order: 0 }],
                            },
                        },
                    ],
                },
            },
            include: { workoutDays: true },
        });
        const day = plan.workoutDays[0];

        // Seed a previous log and a PR
        await prisma.setLog.create({
            data: {
                studentId: student.id,
                dayId: day.id,
                exerciseId: exerciseRecord.id,
                setIndex: 0,
                weight: 25,
                reps: 12,
                localDate: '2026-09-20',
                date: new Date('2026-09-20T10:00:00Z'),
            },
        });

        signIn(session);

        // 1. POST /api/student/set-logs
        const postBody = {
            exerciseId: exerciseRecord.id,
            dayId: day.id,
            setIndex: 0,
            weight: 30,
            reps: 10,
            remove: false,
            localDate: '2026-09-27',
        };
        const postRes = await json(await saveSetLog(request('POST', '/api/student/set-logs', postBody)));
        expect(postRes.status).toBe(200);
        expectShape(envelopeData(postRes.body), savedLog);

        // 2. GET /api/student/set-logs
        const getRes = await json(
            await getSetLogs(request('GET', `/api/student/set-logs?dayId=${day.id}&localDate=2026-09-27`))
        );
        expect(getRes.status).toBe(200);

        const data = envelopeData(getRes.body) as { today: unknown[]; previous: unknown[]; prs: unknown[] };
        expect(data.today.length).toBeGreaterThan(0);
        expect(data.previous.length).toBeGreaterThan(0);
        expect(data.prs.length).toBeGreaterThan(0);

        expectShape(data, sessionLogs);
    });

    // C28: POST /api/student/workout/complete -> WorkoutCompletionResult
    it('C28: POST /api/student/workout/complete decodes as WorkoutCompletionResult', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);
        const exerciseRecord = await prisma.exercise.create({
            data: { name: 'Barra Fixa', muscleGroup: 'Costas' },
        });

        const plan = await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Conclusão',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [{ dayOfWeek: 1, name: 'Treino Costas', order: 0 }],
                },
            },
            include: { workoutDays: true },
        });
        const day = plan.workoutDays[0];

        // Needs at least one setLog on that day
        await prisma.setLog.create({
            data: {
                studentId: student.id,
                dayId: day.id,
                exerciseId: exerciseRecord.id,
                setIndex: 0,
                weight: 0,
                reps: 8,
                localDate: '2026-09-27',
                date: new Date(),
            },
        });

        signIn(session);

        const body = {
            dayId: day.id,
            completedSets: 3,
            totalSets: 3,
            startedAt: new Date(Date.now() - 3600_000).toISOString(),
            completedAt: new Date().toISOString(),
            durationSeconds: 3600,
            localDate: '2026-09-27',
            timezoneOffsetMinutes: -180,
        };

        const { status, body: resBody } = await json(await completeWorkout(request('POST', '/api/student/workout/complete', body)));
        expect(status).toBe(200);

        const data = envelopeData(resBody);
        expectShape(data, workoutCompletionResult);
    });

    // C29: POST /api/student/workout/health-metrics -> Result
    it('C29: POST /api/student/workout/health-metrics decodes as Result', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);
        const plan = await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Métricas',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [{ dayOfWeek: 1, name: 'Treino A', order: 0 }],
                },
            },
            include: { workoutDays: true },
        });
        const day = plan.workoutDays[0];

        await prisma.workoutSession.create({
            data: {
                studentId: student.id,
                workoutDayId: day.id,
                dayName: 'Treino A',
                localDate: '2026-09-27',
                status: 'COMPLETED',
                startedAt: new Date(Date.now() - 3600_000),
                completedAt: new Date(),
                completedSets: 3,
                totalSets: 3,
                percentage: 100,
                durationSeconds: 3600,
                totalVolume: 3000,
            },
        });

        signIn(session);

        const body = {
            dayId: day.id,
            localDate: '2026-09-27',
            activeEnergyKilocalories: 420,
            averageHeartRateBPM: 130,
            maxHeartRateBPM: 160,
            durationSeconds: 3600,
            healthWorkoutUUID: 'watch-uuid-5678',
        };

        const { status, body: resBody } = await json(
            await syncHealthMetrics(request('POST', '/api/student/workout/health-metrics', body))
        );
        expect(status).toBe(200);

        const data = envelopeData(resBody);
        expectShape(data, healthMetricsResult);
    });

    // C30: GET /api/student/diet e POST /api/student/diet/complete -> DietPlan / Result
    it('C30: GET /api/student/diet e POST /api/student/diet/complete decode as DietPlan and Result', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);

        const plan = await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Dieta do Aluno',
                calories: 2200,
                protein: 160,
                carbs: 230,
                fat: 65,
                active: true,
                meals: {
                    create: [
                        {
                            name: 'Café da Manhã',
                            time: '08:00',
                            order: 0,
                            foods: JSON.stringify([
                                { name: 'Ovo cozido', portion: '2 unidades', quantity: 2, calories: 140, protein: 12, carbs: 1, fat: 10 },
                            ]),
                        },
                    ],
                },
            },
            include: { meals: true },
        });
        const meal = plan.meals[0];

        signIn(session);

        // 1. GET /api/student/diet
        const getRes = await json(await getStudentDiet(request('GET', '/api/student/diet')));
        expect(getRes.status).toBe(200);

        const planData = envelopeData(getRes.body) as { meals: Array<{ foods: unknown[] }> };
        expect(planData.meals.length).toBeGreaterThan(0);
        expect(planData.meals[0].foods.length).toBeGreaterThan(0);
        expectShape(planData, dietPlan);

        // 2. POST /api/student/diet/complete
        const postRes = await json(
            await completeDietMeal(request('POST', '/api/student/diet/complete', { mealId: meal.id, completed: true }))
        );
        expect(postRes.status).toBe(200);
        expectShape(envelopeData(postRes.body), dietCompleteResult);
    });

    // C31: GET /api/student/adherence -> AdherenceData
    it('C31: GET /api/student/adherence decodes as AdherenceData', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);

        await prisma.workoutPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Ficha Treino Adesão',
                active: true,
                startDate: new Date('2026-09-01T12:00:00Z'),
                endDate: new Date('2026-11-01T12:00:00Z'),
                workoutDays: {
                    create: [{ dayOfWeek: 1, name: 'Treino A', order: 0 }],
                },
            },
        });

        await prisma.dietPlan.create({
            data: {
                studentId: student.id,
                personalId: trainer.personal.id,
                title: 'Dieta Adesão',
                active: true,
                meals: {
                    create: [{ name: 'Almoço', time: '12:00', order: 0, foods: '[]' }],
                },
            },
        });

        signIn(session);
        const { status, body } = await json(await getStudentAdherence(request('GET', '/api/student/adherence')));
        expect(status).toBe(200);

        const data = envelopeData(body);
        expectShape(data, adherenceData);
    });

    // C32: GET e POST /api/checkins -> [CheckinFull] / CheckinFull
    it('C32: GET e POST /api/checkins decode as [CheckinFull] and CheckinFull', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);

        signIn(session);

        // 1. POST /api/checkins
        const checkinBody = {
            weight: 78.5,
            sleepHours: 8,
            energyLevel: 4,
            hungerLevel: 3,
            stressLevel: 2,
            workoutAdherence: 95,
            dietAdherence: 90,
            notes: 'Semana muito boa de treinos!',
            chest: 102,
            waist: 82,
            abdomen: 84,
            hips: 98,
            armRight: 37,
            armLeft: 36.5,
            thighRight: 58,
            thighLeft: 57.5,
            calfRight: 38,
            calfLeft: 38,
            bodyFatPercentage: 14.5,
        };

        const postRes = await json(await createCheckin(request('POST', '/api/checkins', checkinBody)));
        expect(postRes.status).toBe(200);
        expectShape(envelopeData(postRes.body), checkinFull);

        // 2. GET /api/checkins
        const getRes = await json(await listCheckins(request('GET', '/api/checkins')));
        expect(getRes.status).toBe(200);

        const checkins = envelopeData(getRes.body) as unknown[];
        expect(checkins.length).toBeGreaterThan(0);
        expectShape(checkins, [checkinFull]);
    });

    // C33: GET e POST /api/student/photos -> [RemoteProgressPhoto] / RemoteProgressPhoto
    it('C33: GET e POST /api/student/photos decode as [RemoteProgressPhoto] and RemoteProgressPhoto', async () => {
        const trainer = await createPersonal();
        const { session } = await createStudent(trainer.personal.id);

        signIn(session);

        const ownerKey = session.id.replace(/[^A-Za-z0-9]/g, '');
        const validPhotoUrl = `/api/photos/${ownerKey}-12345678-1234-1234-1234-123456789abc.jpg`;

        // 1. POST /api/student/photos
        const photoBody = {
            url: validPhotoUrl,
            angle: 'FRONT',
            weight: 80,
            notes: 'Foto frontal',
        };

        const postRes = await json(await createPhoto(request('POST', '/api/student/photos', photoBody)));
        expect(postRes.status).toBe(201);
        expectShape(envelopeData(postRes.body), remoteProgressPhoto);

        // 2. GET /api/student/photos
        const getRes = await json(await listPhotos(request('GET', '/api/student/photos')));
        expect(getRes.status).toBe(200);

        const photos = envelopeData(getRes.body) as unknown[];
        expect(photos.length).toBeGreaterThan(0);
        expectShape(photos, [remoteProgressPhoto]);
    });

    // C34: GET e PATCH /api/student/notifications -> NotificationsPayload / APIAck
    it('C34: GET e PATCH /api/student/notifications decode as NotificationsPayload and APIAck', async () => {
        const trainer = await createPersonal();
        const { student, session } = await createStudent(trainer.personal.id);

        const notif = await prisma.notification.create({
            data: {
                userId: session.id,
                type: 'WORKOUT_REMINDER',
                title: 'Hora de treinar!',
                body: 'Treino A agendado para hoje',
                read: false,
            },
        });

        signIn(session);

        // 1. GET /api/student/notifications
        const getRes = await json(await getStudentNotifications(request('GET', '/api/student/notifications')));
        expect(getRes.status).toBe(200);

        const data = envelopeData(getRes.body) as { notifications: unknown[] };
        expect(data.notifications.length).toBeGreaterThan(0);
        expectShape(data, notificationsPayload);

        // 2. PATCH /api/student/notifications
        const patchRes = await json(
            await updateStudentNotifications(request('PATCH', '/api/student/notifications', { id: notif.id }))
        );
        expect(patchRes.status).toBe(200);
        expectAck(patchRes.body);
    });

    // C35: GET e POST /api/messages/[id] -> [ChatMessage] / ChatMessage
    it('C35: GET e POST /api/messages/[id] decode as [ChatMessage] and ChatMessage', async () => {
        const trainer = await createPersonal();
        const { session } = await createStudent(trainer.personal.id);

        signIn(session);

        // 1. POST /api/messages/[trainerUserId]
        const postRes = await json(
            await sendMessage(request('POST', `/api/messages/${trainer.user.id}`, { text: 'Boa tarde professor!' }), {
                params: Promise.resolve({ id: trainer.user.id }),
            })
        );
        expect(postRes.status).toBe(200);
        expectShape(envelopeData(postRes.body), chatMessage);

        // 2. GET /api/messages/[trainerUserId]
        const getRes = await json(
            await listMessages(request('GET', `/api/messages/${trainer.user.id}`), {
                params: Promise.resolve({ id: trainer.user.id }),
            })
        );
        expect(getRes.status).toBe(200);

        const messages = envelopeData(getRes.body) as unknown[];
        expect(messages.length).toBeGreaterThan(0);
        expectShape(messages, [chatMessage]);
    });
});
