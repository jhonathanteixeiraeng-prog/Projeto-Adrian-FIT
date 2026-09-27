import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { GET as listCheckins } from '@/app/api/checkins/route';
import { POST as dietTemplateFromPlan } from '@/app/api/diet-templates/from-plan/route';
import { GET as listDietTemplates, POST as createDietTemplate } from '@/app/api/diet-templates/route';
import { POST as createFood } from '@/app/api/foods/route';
import { GET as getPhoto } from '@/app/api/photos/[name]/route';
import { POST as addGalleryPhoto } from '@/app/api/student/photos/route';
import { GET as getStudent } from '@/app/api/students/[id]/route';
import { GET as listWorkoutTemplates } from '@/app/api/workout-templates/route';
import { savePhoto } from '@/lib/photo-storage';
import { createPersonal, createStudent, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';
import { removeTestPhotos } from '../helpers/photos';

// Local photo storage (the tests' folder): no Blob token, not on Vercel.
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;

beforeEach(resetDatabase);
afterAll(removeTestPhotos);

const jpeg = () => new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9])], { type: 'image/jpeg' });

describe('each account only sees its own data', () => {
    it('A01: an account without a student profile gets no check-ins', async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        await prisma.checkin.create({
            data: { studentId: student.student.id, weight: 80, sleepHours: 7, energyLevel: 3, hungerLevel: 3, stressLevel: 3, workoutAdherence: 80, dietAdherence: 80 },
        });
        const orphan = await prisma.user.create({ data: { name: 'Sem perfil', email: 'orphan@example.test', password: 'x', role: 'STUDENT' } });

        signIn({ id: orphan.id, role: 'STUDENT' });
        const { status, body } = await json(await listCheckins(request('GET', '/api/checkins')));
        expect(status).toBe(403);
        expect(JSON.stringify(body)).not.toContain(student.student.id);

        signIn(student.session);
        const own = await json(await listCheckins(request('GET', '/api/checkins')));
        expect(own.status).toBe(200);
        expect(own.body.data).toHaveLength(1);
    });

    it("a trainer can't open another trainer's student", async () => {
        const mine = await createPersonal();
        const other = await createPersonal();
        const theirs = await createStudent(other.personal.id);
        signIn(mine.session);
        const response = await getStudent(request('GET', `/api/students/${theirs.student.id}?view=profile`), { params: Promise.resolve({ id: theirs.student.id }) });
        expect(response.status).toBe(403);
    });

    it('A02: the gallery only takes your own uploads and your own students', async () => {
        const trainer = await createPersonal();
        const ana = await createStudent(trainer.personal.id);
        const bia = await createStudent(trainer.personal.id);
        const otherTrainer = await createPersonal();
        const stranger = await createStudent(otherTrainer.personal.id);

        const biaUpload = await savePhoto(jpeg(), bia.user.id, 'image/jpeg');
        signIn(ana.session);
        const stolen = await addGalleryPhoto(request('POST', '/api/student/photos', { url: biaUpload, angle: 'FRONT' }));
        expect(stolen.status).toBe(400);

        const anaUpload = await savePhoto(jpeg(), ana.user.id, 'image/jpeg');
        const own = await addGalleryPhoto(request('POST', '/api/student/photos', { url: anaUpload, angle: 'FRONT' }));
        expect(own.status).toBe(201);

        const trainerUpload = await savePhoto(jpeg(), trainer.user.id, 'image/jpeg');
        signIn(trainer.session);
        const notMine = await addGalleryPhoto(request('POST', '/api/student/photos', { url: trainerUpload, angle: 'FRONT', studentId: stranger.student.id }));
        expect(notMine.status).toBe(404);
    });

    it('A03: a photo opens only for its uploader, the student in it and their trainer', async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const classmate = await createStudent(trainer.personal.id);
        const otherTrainer = await createPersonal();

        const url = await savePhoto(jpeg(), trainer.user.id, 'image/jpeg');
        const name = url.slice('/api/photos/'.length);
        await prisma.progressPhoto.create({ data: { studentId: student.student.id, url, angle: 'FRONT' } });
        const open = async () => (await getPhoto(request('GET', url), { params: Promise.resolve({ name }) })).status;

        signIn(null);
        expect(await open()).toBe(401);
        signIn(trainer.session);
        expect(await open()).toBe(200);
        signIn(student.session);
        expect(await open()).toBe(200);
        signIn(classmate.session);
        expect(await open()).toBe(404);
        signIn(otherTrainer.session);
        expect(await open()).toBe(404);
    });

    // Same root cause as A01: `personalId: session.user.personalId!` in a where. An account with role PERSONAL
    // but no trainer profile had no personalId, so Prisma dropped the filter and listed every trainer's templates.
    it('an account without a trainer profile gets no templates', async () => {
        const trainer = await createPersonal();
        const workoutTemplate = await prisma.workoutTemplate.create({ data: { personalId: trainer.personal.id, title: 'Modelo de treino' } });
        const dietTemplate = await prisma.dietTemplate.create({ data: { personalId: trainer.personal.id, title: 'Modelo de dieta' } });
        const orphan = await prisma.user.create({ data: { name: 'Sem perfil', email: 'orphan-personal@example.test', password: 'x', role: 'PERSONAL' } });

        signIn({ id: orphan.id, role: 'PERSONAL' });
        const workouts = await json(await listWorkoutTemplates());
        expect(workouts.status).toBe(401);
        expect(JSON.stringify(workouts.body)).not.toContain(workoutTemplate.id);
        const diets = await json(await listDietTemplates(request('GET', '/api/diet-templates')));
        expect(diets.status).toBe(401);
        expect(JSON.stringify(diets.body)).not.toContain(dietTemplate.id);
        expect((await createDietTemplate(request('POST', '/api/diet-templates', { title: 'Novo' }))).status).toBe(401);
        expect((await dietTemplateFromPlan(request('POST', '/api/diet-templates/from-plan', { planId: 'x' }))).status).toBe(401);

        signIn(trainer.session);
        const own = await json(await listWorkoutTemplates());
        expect(own.status).toBe(200);
        expect(JSON.stringify(own.body)).toContain(workoutTemplate.id);
    });

    it("a student can't add foods to the shared food table", async () => {
        const trainer = await createPersonal();
        const student = await createStudent(trainer.personal.id);
        const food = { name: 'Tapioca de teste', portion: '100g', calories: 240, protein: 0, carbs: 60, fat: 0 };

        signIn(student.session);
        expect((await createFood(request('POST', '/api/foods', food))).status).toBe(401);
        expect(await prisma.food.count({ where: { name: food.name } })).toBe(0);

        signIn(trainer.session);
        expect((await createFood(request('POST', '/api/foods', food))).status).toBe(200);
    });
});
