import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export { prisma };

/** Empties every table of prisma/test.db. Refuses any other database. */
export async function resetDatabase() {
    if (process.env.DATABASE_URL !== 'file:./test.db') {
        throw new Error(`Tests only run against prisma/test.db (DATABASE_URL is ${process.env.DATABASE_URL})`);
    }
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`
    );
    // Foreign keys stay on: tables whose rows are still referenced are retried after the others.
    let pending = tables.map((table) => table.name);
    for (let pass = 0; pending.length > 0 && pass < 10; pass++) {
        const failed: string[] = [];
        for (const name of pending) {
            try {
                await prisma.$executeRawUnsafe(`DELETE FROM "${name}"`);
            } catch {
                failed.push(name);
            }
        }
        pending = failed;
    }
    if (pending.length > 0) throw new Error(`Could not empty: ${pending.join(', ')}`);
}

const unique = () => randomUUID().slice(0, 8);

/** A trainer account. `password` defaults to "senha-teste". */
export async function createPersonal(options: { name?: string; password?: string } = {}) {
    const user = await prisma.user.create({
        data: {
            name: options.name ?? 'Personal Teste',
            email: `personal-${unique()}@example.test`,
            password: await bcrypt.hash(options.password ?? 'senha-teste', 4),
            role: 'PERSONAL',
        },
    });
    const personal = await prisma.personal.create({ data: { userId: user.id } });
    return { user, personal, session: { id: user.id, role: 'PERSONAL' as const, personalId: personal.id, name: user.name, email: user.email } };
}

/** A student of `personalId`; `email: null` registers them without app access (placeholder address). */
export async function createStudent(personalId: string, options: { name?: string; email?: string | null; password?: string; phone?: string } = {}) {
    const email = options.email === null ? `aluno-${randomUUID()}@sem-acesso.invalid` : options.email ?? `aluno-${unique()}@example.test`;
    const user = await prisma.user.create({
        data: {
            name: options.name ?? 'Aluno Teste',
            email,
            password: await bcrypt.hash(options.password ?? 'senha-teste', 4),
            role: 'STUDENT',
            phone: options.phone,
        },
    });
    const student = await prisma.student.create({ data: { userId: user.id, personalId } });
    return {
        user,
        student,
        session: { id: user.id, role: 'STUDENT' as const, studentId: student.id, name: user.name, email: user.email },
    };
}

/** An active workout plan with one day and one exercise. */
export async function createWorkoutPlan(studentId: string, personalId: string, title = 'Treino teste') {
    const exercise = await prisma.exercise.create({ data: { name: `Supino ${unique()}`, muscleGroup: 'Peito' } });
    return prisma.workoutPlan.create({
        data: {
            studentId,
            personalId,
            title,
            active: true,
            startDate: new Date('2026-09-26T12:00:00Z'),
            endDate: new Date('2026-11-26T12:00:00Z'),
            workoutDays: {
                create: [{ dayOfWeek: 1, name: 'Treino A', order: 0, items: { create: [{ exerciseId: exercise.id, sets: 3, reps: '10-12', rest: 60, order: 0 }] } }],
            },
        },
    });
}
