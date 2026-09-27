import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { POST as createCheckin } from '@/app/api/checkins/route';
import { GET as dashboard } from '@/app/api/student/dashboard/route';
import { POST as markMeal } from '@/app/api/student/diet/complete/route';
import { GET as studentDiet } from '@/app/api/student/diet/route';
import { GET as readSets, POST as saveSet } from '@/app/api/student/set-logs/route';
import { POST as completeWorkout } from '@/app/api/student/workout/complete/route';
import { createDietPlanForStudent, prepareMeals } from '@/lib/diet-plans';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';

beforeEach(resetDatabase);
afterEach(() => vi.useRealTimers());

const MANAUS = -240;

/** A student with an active plan: one day, one exercise with 3 sets. */
async function setUp() {
    const trainer = await createPersonal();
    const student = await createStudent(trainer.personal.id);
    const plan = await createWorkoutPlan(student.student.id, trainer.personal.id);
    const day = await prisma.workoutDay.findFirstOrThrow({ where: { planId: plan.id }, include: { items: true } });
    signIn(student.session);
    return { trainer, student, plan, dayId: day.id, exerciseId: day.items[0].exerciseId };
}

const post = async (body: Record<string, unknown>) => json(await saveSet(request('POST', '/api/student/set-logs', body)));

describe('set logs (A13, A07)', () => {
    it("take only sets of the student's current plan, with plausible numbers", async () => {
        const mine = await setUp();
        const other = await setUp(); // now signed in as the other student
        const base = { dayId: mine.dayId, exerciseId: mine.exerciseId, weight: 40, reps: 10, localDate: '2026-09-25', timezoneOffsetMinutes: MANAUS };
        expect((await post({ ...base, setIndex: 0 })).status).toBe(404);

        signIn(mine.student.session);
        expect((await post({ ...base, setIndex: -5 })).status).toBe(400);
        expect((await post({ ...base, setIndex: 3 })).status).toBe(400);
        expect((await post({ ...base, setIndex: 1.5 })).status).toBe(400);
        expect((await post({ ...base, setIndex: 0, exerciseId: other.exerciseId })).status).toBe(400);
        expect((await post({ ...base, setIndex: 0, weight: -10 })).status).toBe(400);
        expect((await post({ ...base, setIndex: 0, reps: 'dez' })).status).toBe(400);
        expect(await prisma.setLog.count()).toBe(0);

        expect((await post({ ...base, setIndex: 0, weight: '42,5' })).status).toBe(200);
        expect(await prisma.setLog.findFirst({ where: { dayId: mine.dayId } })).toMatchObject({ weight: 42.5, reps: 10, localDate: '2026-09-25' });
    });

    it('one log per set and day: repeated and simultaneous saves update it', async () => {
        const { dayId, exerciseId } = await setUp();
        const base = { dayId, exerciseId, setIndex: 1, localDate: '2026-09-25', timezoneOffsetMinutes: MANAUS };

        await Promise.all([post({ ...base, weight: 40, reps: 10 }), post({ ...base, weight: 40, reps: 10 }), post({ ...base, weight: 45, reps: 8 })]);
        await post({ ...base, weight: 50, reps: 6 });
        const logs = await prisma.setLog.findMany({ where: { dayId, setIndex: 1 } });
        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({ weight: 50, reps: 6 });

        expect((await post({ ...base, remove: true })).status).toBe(200);
        expect(await prisma.setLog.count({ where: { dayId } })).toBe(0);
    });

    it("belong to the student's calendar day, also late in the evening", async () => {
        const { dayId, exerciseId } = await setUp();
        // 21:00 in Manaus on the 25th is already the 26th in UTC (the server's day on Vercel).
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-26T01:00:00Z'));

        expect((await post({ dayId, exerciseId, setIndex: 0, weight: 40, reps: 10, timezoneOffsetMinutes: MANAUS })).status).toBe(200);
        expect((await prisma.setLog.findFirstOrThrow({ where: { dayId } })).localDate).toBe('2026-09-25');

        const read = async (query: string) => json(await readSets(request('GET', `/api/student/set-logs?dayId=${dayId}&${query}`)));
        expect((await read(`localDate=2026-09-25&tz=${MANAUS}`)).body.data.today).toHaveLength(1);
        expect((await read(`localDate=2026-09-26&tz=${MANAUS}`)).body.data.today).toHaveLength(0);
        expect((await read(`localDate=2026-09-26&tz=${MANAUS}`)).body.data.previous).toHaveLength(1);
    });

    it('finishing the workout records the session with the day\'s sets', async () => {
        const { dayId, exerciseId } = await setUp();
        const day = { localDate: '2026-09-25', timezoneOffsetMinutes: MANAUS };
        for (const setIndex of [0, 1, 2]) await post({ dayId, exerciseId, setIndex, weight: 40, reps: 10, ...day });

        const done = await json(await completeWorkout(request('POST', '/api/student/workout/complete', { dayId, completedSets: 3, totalSets: 3, ...day })));
        expect(done.status).toBe(200);
        expect(done.body.data).toMatchObject({ localDate: '2026-09-25', status: 'COMPLETED', totalVolume: 1200 });
        expect(await prisma.setLog.count({ where: { dayId, sessionId: done.body.data.id } })).toBe(3);
    });
});

describe('meals (A05, A07)', () => {
    it('a meal marked today stays marked when the diet is read again, and can be unmarked', async () => {
        const { trainer, student } = await setUp();
        const plan = await createDietPlanForStudent({
            personalId: trainer.personal.id,
            studentId: student.student.id,
            title: 'Plano',
            startDate: null,
            endDate: null,
            active: true,
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            meals: prepareMeals([{ name: 'Almoço', time: '12:00', items: [{ name: 'Arroz', quantity: 100, unit: 'g', calories: 130, protein: 2.5, carbs: 28, fat: 0.3 }] }] as never).meals,
        });
        const [meal] = await prisma.dietMeal.findMany({ where: { dietPlanId: plan.id } });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-26T01:00:00Z'));

        const mark = async (completed: boolean) =>
            json(await markMeal(request('POST', '/api/student/diet/complete', { mealId: meal.id, completed, localDate: '2026-09-25', timezoneOffsetMinutes: MANAUS })));
        const done = async (localDate: string) =>
            (await json(await studentDiet(request('GET', `/api/student/diet?localDate=${localDate}&tz=${MANAUS}`)))).body.data.meals[0].completed;

        expect((await mark(true)).status).toBe(200);
        expect(await done('2026-09-25')).toBe(true);
        expect(await done('2026-09-26')).toBe(false);
        await mark(true);
        expect(await prisma.mealCompletion.count()).toBe(1);
        await mark(false);
        expect(await done('2026-09-25')).toBe(false);
    });
});

describe('check-ins (A11, A12)', () => {
    const valid = { weight: '72,5', sleepHours: 7, energyLevel: 4, hungerLevel: 3, stressLevel: 2, workoutAdherence: 80, dietAdherence: 90, notes: 'Semana boa' };
    const send = async (body: Record<string, unknown>) => json(await createCheckin(request('POST', '/api/checkins', body)));

    it('refuse impossible values and accept zero hours of sleep', async () => {
        await setUp();
        for (const bad of [
            { weight: -70 },
            { weight: '72kg' },
            { sleepHours: 40 },
            { energyLevel: 99 },
            { workoutAdherence: 200 },
            { dietAdherence: 50.5 },
            { waist: 5000 },
            { weight: undefined },
        ]) {
            const response = await send({ ...valid, ...bad });
            expect(response.status, JSON.stringify(bad)).toBe(400);
        }
        expect(await prisma.checkin.count()).toBe(0);

        const zeroSleep = await send({ ...valid, sleepHours: 0 });
        expect(zeroSleep.status).toBe(200);
        expect(zeroSleep.body.data).toMatchObject({ weight: 72.5, sleepHours: 0 });
    });

    it('a repeated check-in is saved once, and a failing notification does not fail it', async () => {
        const { student } = await setUp();
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failing = vi.spyOn(prisma.notification, 'create').mockRejectedValueOnce(new Error('notification down'));

        const first = await send(valid);
        expect(first.status).toBe(200);
        expect(failing).toHaveBeenCalled();
        const again = await send(valid);
        expect(again.status).toBe(200);
        expect(again.body.data.id).toBe(first.body.data.id);
        expect(await prisma.checkin.count({ where: { studentId: student.student.id } })).toBe(1);
        expect((await prisma.student.findUniqueOrThrow({ where: { id: student.student.id } })).weight).toBe(72.5);

        failing.mockRestore();
        quiet.mockRestore();
        expect((await send({ ...valid, weight: 72 })).body.data.id).not.toBe(first.body.data.id);
    });
});

describe('student dashboard (A21)', () => {
    it("shows the student's real week, streak, done exercises and next check-in", async () => {
        const { dayId, exerciseId } = await setUp();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-09-26T15:00:00Z'));
        const today = { localDate: '2026-09-26', timezoneOffsetMinutes: MANAUS };
        const read = async () => (await json(await dashboard(request('GET', `/api/student/dashboard?localDate=2026-09-26&tz=${MANAUS}`)))).body.data;

        const before = await read();
        expect(before.stats).toEqual({ streak: 0, weeklyWorkouts: 0, weeklyGoal: 1, nextCheckin: 'Hoje' });
        expect(before.workout.exercises[0].completed).toBe(false);

        for (const setIndex of [0, 1, 2]) await post({ dayId, exerciseId, setIndex, weight: 40, reps: 10, ...today });
        await completeWorkout(request('POST', '/api/student/workout/complete', { dayId, completedSets: 3, totalSets: 3, ...today }));
        await createCheckin(request('POST', '/api/checkins', { weight: 70, sleepHours: 8 }));

        const after = await read();
        expect(after.stats).toEqual({ streak: 1, weeklyWorkouts: 1, weeklyGoal: 1, nextCheckin: 'Sábado' });
        expect(after.workout.exercises[0].completed).toBe(true);
    });
});
