import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { PUT as updateDiet } from '@/app/api/diets/[id]/route';
import { POST as markDietSent } from '@/app/api/diets/[id]/sent/route';
import { POST as substitute } from '@/app/api/student/diet/substitute/route';
import { POST as createAssessment } from '@/app/api/students/[id]/assessments/route';
import { DELETE as deleteStudent } from '@/app/api/students/[id]/route';
import { POST as markWorkoutSent } from '@/app/api/workout-plans/[id]/sent/route';
import { createDietPlanForStudent, prepareMeals, updateDietPlan } from '@/lib/diet-plans';
import { savePhoto } from '@/lib/photo-storage';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';
import { TEST_PHOTO_DIR, removeTestPhotos } from '../helpers/photos';

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

beforeEach(resetDatabase);
afterAll(removeTestPhotos);

const jpeg = () => new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
const photoFile = (url: string) => path.join(TEST_PHOTO_DIR, url.slice('/api/photos/'.length));

describe('PDF send record', () => {
    it("records the version sent, never newer than the plan, and only for the trainer's own students", async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const plan = await createWorkoutPlan(student.student.id, trainer.personal.id);
        const send = async (body: unknown) => json(await markWorkoutSent(request('POST', `/api/workout-plans/${plan.id}/sent`, body), { params: { id: plan.id } }));

        signIn((await createPersonal()).session);
        expect((await send({ version: 1 })).status).toBe(404);

        signIn(trainer.session);
        const sent = await send({ version: 99 });
        expect(sent.status).toBe(200);
        expect(sent.body.data).toMatchObject({ version: 1, sentVersion: 1 });
        expect(sent.body.data.sentAt).toBeTruthy();

        signIn(null);
        expect((await send({})).status).toBe(401);
    });

    it('diets get a new version only when what the student reads changes', async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const meals = [{ name: 'Almoço', time: '12:00', items: [{ name: 'Arroz', quantity: 100, unit: 'g', calories: 130, protein: 2.5, carbs: 28, fat: 0.3 }] }];
        const plan = await createDietPlanForStudent({
            personalId: trainer.personal.id,
            studentId: student.student.id,
            title: 'Plano',
            startDate: null,
            endDate: null,
            active: false,
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
            meals: prepareMeals(meals as never).meals,
        });
        expect(plan.version).toBe(1);
        expect((await updateDietPlan(plan.id, student.student.id, { active: true })).version).toBe(1);
        const stored = await prisma.dietMeal.findMany({ where: { dietPlanId: plan.id } });
        const same = prepareMeals(meals.map((meal, index) => ({ ...meal, id: stored[index].id })) as never).meals;
        expect((await updateDietPlan(plan.id, student.student.id, { title: 'Plano', meals: same })).version).toBe(1);
        expect((await updateDietPlan(plan.id, student.student.id, { title: 'Plano 2' })).version).toBe(2);

        signIn(trainer.session);
        const sent = await json(await markDietSent(request('POST', `/api/diets/${plan.id}/sent`, {}), { params: { id: plan.id } }));
        expect(sent.body.data).toMatchObject({ version: 2, sentVersion: 2 });
    });
});

describe('deleting a student', () => {
    it('removes the login, the personal data and the photo files too', async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id, { phone: '92999999999' });
        const url = await savePhoto(jpeg(), trainer.user.id, 'image/jpeg');
        await prisma.progressPhoto.create({ data: { studentId: student.student.id, url, angle: 'FRONT' } });
        expect(existsSync(photoFile(url))).toBe(true);

        signIn((await createPersonal()).session);
        expect((await deleteStudent(request('DELETE', `/api/students/${student.student.id}`), { params: { id: student.student.id } })).status).toBe(404);

        signIn(trainer.session);
        const response = await deleteStudent(request('DELETE', `/api/students/${student.student.id}`), { params: { id: student.student.id } });
        expect(response.status).toBe(200);
        expect(await prisma.student.findUnique({ where: { id: student.student.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: student.user.id } })).toBeNull();
        expect(await prisma.progressPhoto.count()).toBe(0);
        expect(existsSync(photoFile(url))).toBe(false);
    });

    it("keeps an account that is also a trainer's", async () => {
        const trainer = await createPersonal();
        const coach = await createPersonal();
        const student = await prisma.student.create({ data: { userId: coach.user.id, personalId: trainer.personal.id } });
        signIn(trainer.session);
        const response = await deleteStudent(request('DELETE', `/api/students/${student.id}`), { params: { id: student.id } });
        expect(response.status).toBe(200);
        expect(await prisma.student.findUnique({ where: { id: student.id } })).toBeNull();
        expect(await prisma.user.findUnique({ where: { id: coach.user.id } })).not.toBeNull();
    });
});

describe('assessments', () => {
    it("take the trainer's own uploads only", async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const studentUpload = await savePhoto(jpeg(), student.user.id, 'image/jpeg');
        const trainerUpload = await savePhoto(jpeg(), trainer.user.id, 'image/jpeg');
        const create = async (url: string) =>
            json(
                await createAssessment(request('POST', `/api/students/${student.student.id}/assessments`, { date: '2026-09-20', weight: 80, photos: [{ url, angle: 'FRONT' }] }), {
                    params: { id: student.student.id },
                })
            );

        signIn(trainer.session);
        expect((await create(studentUpload)).status).toBe(400);
        const saved = await create(trainerUpload);
        expect(saved.status).toBe(201);
        expect(saved.body.data.photos).toHaveLength(1);
        expect((await prisma.student.findUniqueOrThrow({ where: { id: student.student.id } })).weight).toBe(80);
    });
});

describe('diet edits (A14)', () => {
    const MEALS = [{ name: 'Almoço', time: '12:00', items: [{ name: 'Arroz', quantity: 100, unit: 'g', calories: 130, protein: 2.5, carbs: 28, fat: 0.3 }] }];
    const setUp = async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
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
            meals: prepareMeals(MEALS as never).meals,
        });
        const put = async (body: unknown) => json(await updateDiet(request('PUT', `/api/diets/${plan.id}`, body), { params: { id: plan.id } }));
        return { trainer, student, plan, put };
    };
    const swapRice = (mealId: string) =>
        substitute(
            request('POST', '/api/student/diet/substitute', {
                mealId,
                originalFoodIndex: 0,
                originalFood: { name: 'Arroz', calories: 130, protein: 2.5, carbs: 28, fat: 0.3, quantity: '100g', portion: '100g' },
                newFood: { name: 'Batata doce', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, portion: '100g', source: 'database' },
            })
        );

    it('a save made from an older version gets a conflict instead of overwriting', async () => {
        const { trainer, plan, put } = await setUp();
        signIn(trainer.session);

        expect(await put({ title: 'Plano da tarde', version: 1 })).toMatchObject({ status: 200, body: { data: { version: 2 } } });
        expect(await put({ title: 'Plano antigo', version: 1 })).toMatchObject({ status: 409, body: { code: 'VERSION_CONFLICT', currentVersion: 2 } });
        expect((await prisma.dietPlan.findUniqueOrThrow({ where: { id: plan.id } })).title).toBe('Plano da tarde');

        // Without a version (the iOS app, the list's active switch, "sobrescrever") nothing is compared.
        expect((await put({ active: false })).status).toBe(200);
        expect(await put({ title: 'Plano sobrescrito' })).toMatchObject({ status: 200, body: { data: { version: 3, active: false } } });
    });

    it("a student's substitution bumps the version, so an editor opened before can't undo it", async () => {
        const { trainer, student, plan, put } = await setUp();
        const [meal] = await prisma.dietMeal.findMany({ where: { dietPlanId: plan.id } });

        signIn(student.session);
        expect((await swapRice(meal.id)).status).toBe(200);
        expect((await prisma.dietPlan.findUniqueOrThrow({ where: { id: plan.id } })).version).toBe(2);

        signIn(trainer.session);
        const stale = await put({ title: 'Plano', meals: MEALS.map((item) => ({ ...item, id: meal.id })), version: 1 });
        expect(stale.status).toBe(409);
        expect((await prisma.dietMeal.findUniqueOrThrow({ where: { id: meal.id } })).foods).toContain('Batata doce');
    });

    it('substitution errors keep internal details out of the answer (A23)', async () => {
        const { student, plan } = await setUp();
        const [meal] = await prisma.dietMeal.findMany({ where: { dietPlanId: plan.id } });
        signIn(student.session);

        const malformed = await substitute(
            new NextRequest('http://localhost:3000/api/student/diet/substitute', { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } })
        );
        expect(malformed.status).toBe(400);
        const badIndex = await substitute(request('POST', '/api/student/diet/substitute', { mealId: meal.id, originalFoodIndex: 0.5, originalFood: {}, newFood: {} }));
        expect(badIndex.status).toBe(400);

        const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const failure = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('detalhe interno do banco'));
        const failed = await json(await swapRice(meal.id));
        failure.mockRestore();
        quiet.mockRestore();
        expect(failed.status).toBe(500);
        expect(JSON.stringify(failed.body)).not.toContain('detalhe interno');
        expect(failed.body).not.toHaveProperty('stack');
    });
});
