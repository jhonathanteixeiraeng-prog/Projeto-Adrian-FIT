import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { GET as dashboard } from '@/app/api/dashboard/route';
import { GET as listConversations } from '@/app/api/personal/conversations/route';
import { GET as trainerNotifications } from '@/app/api/personal/notifications/route';
import { POST as sendReminders } from '@/app/api/personal/reminders/route';
import { GET as studentNotifications } from '@/app/api/student/notifications/route';
import { PUT as updateStudent } from '@/app/api/students/[id]/route';
import { POST as clonePlan } from '@/app/api/workout-plans/clone/route';
import { STUDENTS_USE_APP } from '@/lib/features';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import { createPersonal, createStudent, createWorkoutPlan, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';

beforeEach(resetDatabase);

const DAY_MS = 24 * 60 * 60 * 1000;

// Phase 2 pilot (src/lib/student-app.ts): only students marked "Usa a área do aluno" get the app features.
describe.skipIf(STUDENTS_USE_APP)('student area pilot (Student.usesApp)', () => {
    const setUsesApp = async (id: string, body: unknown) =>
        json(await updateStudent(request('PUT', `/api/students/${id}`, body), { params: Promise.resolve({ id }) }));

    it('the trainer turns it on only for a student who can log in', async () => {
        const trainer = await createPersonal();
        const withLogin = await createStudent(trainer.personal.id);
        const withoutLogin = await createStudent(trainer.personal.id, { email: null });
        signIn(trainer.session);

        const refused = await setUsesApp(withoutLogin.student.id, { usesApp: true });
        expect(refused.status).toBe(400);
        expect(refused.body.error).toMatch(/Crie o acesso ao app/);
        expect((await prisma.student.findUniqueOrThrow({ where: { id: withoutLogin.student.id } })).usesApp).toBe(false);
        // Turning it off never needs a login.
        expect((await setUsesApp(withoutLogin.student.id, { usesApp: false })).status).toBe(200);

        const stored = () => prisma.student.findUniqueOrThrow({ where: { id: withLogin.student.id }, select: { usesApp: true, usesAppSince: true } });
        expect((await setUsesApp(withLogin.student.id, { usesApp: 'sim' })).status).toBe(400);
        expect((await setUsesApp(withLogin.student.id, { usesApp: true })).status).toBe(200);
        const joined = await stored();
        expect(joined.usesApp).toBe(true);
        // Joining starts the clock for app activity; saving it again keeps the date.
        expect(Math.abs(joined.usesAppSince!.getTime() - Date.now())).toBeLessThan(60_000);
        expect((await setUsesApp(withLogin.student.id, { usesApp: true })).status).toBe(200);
        expect((await stored()).usesAppSince).toEqual(joined.usesAppSince);
        expect((await setUsesApp(withLogin.student.id, { usesApp: false })).status).toBe(200);
        expect(await stored()).toEqual({ usesApp: false, usesAppSince: null });

        signIn((await createPersonal()).session);
        expect((await setUsesApp(withLogin.student.id, { usesApp: true })).status).toBe(404);
        expect((await prisma.student.findUniqueOrThrow({ where: { id: withLogin.student.id } })).usesApp).toBe(false);
    });

    it('only students in the pilot are told about new plans', async () => {
        const trainer = await createPersonal();
        const pdfOnly = await createStudent(trainer.personal.id);
        const inApp = await createStudent(trainer.personal.id);
        await prisma.student.update({ where: { id: inApp.student.id }, data: { usesApp: true } });

        await notifyStudentAboutPlan({ studentId: pdfOnly.student.id, kind: 'workout', title: 'Treino A' });
        await notifyStudentAboutPlan({ studentId: inApp.student.id, kind: 'diet', title: 'Dieta' });
        expect(await prisma.notification.count({ where: { userId: pdfOnly.user.id } })).toBe(0);
        expect(await prisma.notification.findMany({ where: { userId: inApp.user.id }, select: { type: true, link: true } })).toEqual([
            { type: 'PLAN_UPDATED', link: '/student/diet' },
        ]);

        // Copying a plan to a student: the same rule.
        const source = await createStudent(trainer.personal.id);
        await createWorkoutPlan(source.student.id, trainer.personal.id);
        signIn(trainer.session);
        const clone = (targetStudentId: string) =>
            clonePlan(request('POST', '/api/workout-plans/clone', { sourceStudentId: source.student.id, targetStudentId }));
        expect((await clone(pdfOnly.student.id)).status).toBe(200);
        expect((await clone(inApp.student.id)).status).toBe(200);
        expect(await prisma.notification.count({ where: { userId: pdfOnly.user.id } })).toBe(0);
        expect(await prisma.notification.count({ where: { userId: inApp.user.id } })).toBe(2);
    });

    it("the trainer's notifications say how many of their students are in the pilot", async () => {
        const trainer = await createPersonal();
        const other = await createPersonal();
        const inApp = await createStudent(trainer.personal.id);
        await createStudent(trainer.personal.id);
        const otherInApp = await createStudent(other.personal.id);
        await prisma.student.updateMany({ where: { id: { in: [inApp.student.id, otherInApp.student.id] } }, data: { usesApp: true } });

        signIn(trainer.session);
        const response = await json(await trainerNotifications(request('GET', '/api/personal/notifications')));
        expect(response.status).toBe(200);
        expect(response.body.data.appStudents).toBe(1);

        await prisma.student.update({ where: { id: inApp.student.id }, data: { usesApp: false } });
        expect((await json(await trainerNotifications(request('GET', '/api/personal/notifications')))).body.data.appStudents).toBe(0);
    });

    it('the dashboard judges activity, check-ins and messages only for students in the pilot', async () => {
        const trainer = await createPersonal();
        const longAgo = new Date(Date.now() - 20 * DAY_MS);
        const register = async (name: string, usesApp: boolean, status = 'ACTIVE', usesAppSince: Date | null = null) => {
            const { student, user } = await createStudent(trainer.personal.id, { name });
            await prisma.student.update({ where: { id: student.id }, data: { usesApp, usesAppSince, status, createdAt: longAgo } });
            const plan = await createWorkoutPlan(student.id, trainer.personal.id);
            await prisma.workoutPlan.update({ where: { id: plan.id }, data: { startDate: longAgo, endDate: new Date(Date.now() + 40 * DAY_MS) } });
            // None has trained or sent a check-in; all wrote to the trainer.
            await prisma.message.create({ data: { fromUserId: user.id, toUserId: trainer.user.id, text: `Oi, aqui é ${name}` } });
            return student;
        };
        const inApp = await register('Aluno no app', true);
        const pdfOnly = await register('Aluno no PDF', false);
        const pausedInApp = await register('Pausado no app', true, 'PAUSED');
        const pausedPdfOnly = await register('Pausado no PDF', false, 'PAUSED');
        // Registered 20 days ago like the others, but joined the student area just now.
        const justJoined = await register('Entrou hoje no app', true, 'ACTIVE', new Date());

        signIn(trainer.session);
        const { status, body } = await json(await dashboard(request('GET', '/api/dashboard?tz=0')));
        expect(status).toBe(200);
        const data = body.data;
        expect(data.appStudents).toBe(3);

        // Legacy lists (the iOS app reads them): only pilot students, same shapes. The 72 h and check-in
        // counts list everyone without them, as they always did for new students; the radar waits.
        const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id).sort();
        expect(ids(data.studentsWithoutWorkout72hList)).toEqual([inApp.id, justJoined.id].sort());
        expect(data.studentsWithoutWorkout72h).toBe(2);
        expect(ids(data.retentionRadar.students)).toEqual([inApp.id]);
        expect(data.pendingCheckins).toBe(2);
        expect(typeof data.averageWorkoutAdherence).toBe('number');
        expect(data.kpis.workoutAdherenceStudents).toBe(1);
        expect(data.kpis.unansweredMessages).toBe(3);

        const queue = new Map<string, { usesApp: boolean; unansweredMessage: unknown; reasons: Array<{ key: string; category: string }> }>(
            data.attentionQueue.map((item: { studentId: string }) => [item.studentId, item])
        );
        expect([...queue.keys()].sort()).toEqual([inApp.id, pdfOnly.id, pausedInApp.id, justJoined.id].sort());

        const app = queue.get(inApp.id)!;
        expect(app.usesApp).toBe(true);
        expect(app.unansweredMessage).toBeTruthy();
        expect(app.reasons.map((reason) => reason.key)).toEqual(expect.arrayContaining(['UNANSWERED_MESSAGE', 'NEVER_TRAINED', 'NO_CHECKIN']));
        // The plan is in the app: no "send the PDF" reminder.
        expect(app.reasons.map((reason) => reason.key)).not.toContain('WORKOUT_NOT_SENT');

        const pdf = queue.get(pdfOnly.id)!;
        expect(pdf.usesApp).toBe(false);
        expect(pdf.unansweredMessage).toBeNull();
        expect(pdf.reasons.map((reason) => reason.key)).toEqual(['WORKOUT_NOT_SENT']);
        expect(pdf.reasons.every((reason) => ['PLANS', 'BILLING'].includes(reason.category))).toBe(true);

        expect(queue.get(pausedInApp.id)!.usesApp).toBe(true);
        expect(queue.has(pausedPdfOnly.id)).toBe(false);

        // The time before joining doesn't count: only the message.
        expect(queue.get(justJoined.id)!.reasons.map((reason) => reason.key)).toEqual(['UNANSWERED_MESSAGE']);
    });

    it('"remind everyone at risk" only reaches students in the pilot, counted from when they joined', async () => {
        const trainer = await createPersonal();
        const longAgo = new Date(Date.now() - 20 * DAY_MS);
        const register = async (usesApp: boolean, usesAppSince: Date | null) => {
            const { student, user } = await createStudent(trainer.personal.id);
            await prisma.student.update({ where: { id: student.id }, data: { usesApp, usesAppSince, createdAt: longAgo } });
            const plan = await createWorkoutPlan(student.id, trainer.personal.id);
            await prisma.workoutPlan.update({ where: { id: plan.id }, data: { startDate: longAgo } });
            return user;
        };
        const atRisk = await register(true, new Date(Date.now() - 10 * DAY_MS));
        const justJoined = await register(true, new Date());
        const pdfOnly = await register(false, null);

        signIn(trainer.session);
        const response = await json(await sendReminders(request('POST', '/api/personal/reminders', { studentId: 'ALL_AT_RISK' })));
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(1);
        const notified = await prisma.notification.findMany({ select: { userId: true } });
        expect(notified).toEqual([{ userId: atRisk.id }]);
        expect(notified.some((row) => row.userId === justJoined.id || row.userId === pdfOnly.id)).toBe(false);
    });

    it('the chat inbox lists students in the pilot, and the others only with an earlier conversation', async () => {
        const trainer = await createPersonal();
        const pilot = await createStudent(trainer.personal.id, { name: 'Aluno Piloto' });
        const withHistory = await createStudent(trainer.personal.id, { name: 'Aluno Com Conversa' });
        const pdfOnly = await createStudent(trainer.personal.id, { name: 'Aluno Só PDF' });
        signIn(trainer.session);
        expect((await setUsesApp(pilot.student.id, { usesApp: true })).status).toBe(200);
        await prisma.message.create({ data: { fromUserId: trainer.user.id, toUserId: withHistory.user.id, text: 'Oi!' } });

        const inbox = await json(await listConversations());
        expect(inbox.status).toBe(200);
        expect(inbox.body.data.map((row: { name: string }) => row.name).sort()).toEqual(['Aluno Com Conversa', 'Aluno Piloto']);
        expect(JSON.stringify(inbox.body)).not.toContain(pdfOnly.student.id);
    });

    it("the first check-in reminder welcomes the student instead of calling the check-in overdue", async () => {
        const trainer = await createPersonal();
        const newcomer = await createStudent(trainer.personal.id);
        const rejoined = await createStudent(trainer.personal.id);
        const regular = await createStudent(trainer.personal.id);
        const checkin = (studentId: string, daysAgo: number) =>
            prisma.checkin.create({
                data: { studentId, date: new Date(Date.now() - daysAgo * DAY_MS), weight: 80, sleepHours: 7, energyLevel: 3, hungerLevel: 3, stressLevel: 3, workoutAdherence: 80, dietAdherence: 80 },
            });
        // Registered long ago with an old check-in, joined the student area today: that check-in doesn't count.
        await prisma.student.update({ where: { id: rejoined.student.id }, data: { createdAt: new Date(Date.now() - 60 * DAY_MS), usesApp: true, usesAppSince: new Date() } });
        await checkin(rejoined.student.id, 20);
        // In the student area for a month, last check-in 10 days ago: overdue.
        const joined = new Date(Date.now() - 30 * DAY_MS);
        await prisma.student.update({ where: { id: regular.student.id }, data: { createdAt: joined, usesApp: true, usesAppSince: joined } });
        await checkin(regular.student.id, 10);

        const checkinReminder = async (student: { session: Parameters<typeof signIn>[0] & object; user: { id: string } }) => {
            signIn(student.session);
            expect((await studentNotifications(request('GET', '/api/student/notifications?tz=180'))).status).toBe(200);
            const reminder = await prisma.notification.findFirst({ where: { userId: student.user.id, type: 'CHECKIN_REMINDER' } });
            return reminder?.title;
        };
        expect(await checkinReminder(newcomer)).toBe('Faça seu primeiro check-in 📋');
        expect(await checkinReminder(rejoined)).toBe('Faça seu primeiro check-in 📋');
        expect(await checkinReminder(regular)).toBe('Check-in Semanal Pendente 📋');
    });
});
