import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { POST as markDietSent } from '@/app/api/diets/[id]/sent/route';
import { POST as createAssessment } from '@/app/api/students/[id]/assessments/route';
import { DELETE as deleteStudent } from '@/app/api/students/[id]/route';
import { POST as markWorkoutSent } from '@/app/api/workout-plans/[id]/sent/route';
import { createDietPlanForStudent, prepareMeals, updateDietPlan } from '@/lib/diet-plans';
import { savePhoto } from '@/lib/photo-storage';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

beforeEach(resetDatabase);
afterAll(() => rmSync(path.join(process.cwd(), '.data'), { recursive: true, force: true }));

const jpeg = () => new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
const photoFile = (url: string) => path.join(process.cwd(), '.data', 'photos', url.slice('/api/photos/'.length));

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
