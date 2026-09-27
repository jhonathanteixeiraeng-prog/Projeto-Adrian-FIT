import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { GET as listStudents } from '@/app/api/students/route';
import { envelopeData, expectShape, type Shape } from '../../helpers/contract';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../../helpers/db';
import { json, request, signIn } from '../../helpers/http';

beforeEach(resetDatabase);

// Shapes copied from ios/AdrianFit/AdrianFit/Core/Models.swift.
const planSummary: Shape = { id: 'string', title: 'string' }; // PlanSummary
const studentListItem: Shape = {
    // StudentListItem
    id: 'string',
    user: { id: 'string', name: 'string', email: 'string', phone: 'string?', avatar: 'string?' }, // StudentUser
    status: 'string',
    goal: 'string?',
    weight: 'number?',
    workoutPlans: [planSummary],
    dietPlans: [planSummary],
    checkins: [{ id: 'string', date: 'string', weight: 'number', workoutAdherence: 'number', dietAdherence: 'number' }], // CheckinSummary
};

describe('iOS contract: students (personal)', () => {
    // StudentsView, PlansHubView and both plan editors: api.get("/api/students") as [StudentListItem].
    it('GET /api/students decodes as [StudentListItem]', async () => {
        const trainer = await createPersonal();
        const full = await createStudent(trainer.personal.id, { phone: '11999998888' });
        await createWorkoutPlan(full.student.id, trainer.personal.id);
        await prisma.dietPlan.create({ data: { studentId: full.student.id, personalId: trainer.personal.id, title: 'Dieta teste' } });
        await prisma.checkin.create({
            data: { studentId: full.student.id, weight: 80, sleepHours: 7, energyLevel: 3, hungerLevel: 3, stressLevel: 3, workoutAdherence: 80, dietAdherence: 80 },
        });
        // Registered without an e-mail: the placeholder address still has to reach the app as a string.
        await createStudent(trainer.personal.id, { email: null });

        signIn(trainer.session);
        const { status, body } = await json(await listStudents(request('GET', '/api/students')));
        expect(status).toBe(200);
        const students = envelopeData(body) as Array<{ id: string; workoutPlans: unknown[]; dietPlans: unknown[]; checkins: unknown[] }>;
        expect(students).toHaveLength(2);

        // Empty arrays would pass any shape: make sure the nested items were really checked.
        const withData = students.find((student) => student.id === full.student.id)!;
        expect([withData.workoutPlans.length, withData.dietPlans.length, withData.checkins.length]).toEqual([1, 1, 1]);

        expectShape(students, [studentListItem]);
    });
});
