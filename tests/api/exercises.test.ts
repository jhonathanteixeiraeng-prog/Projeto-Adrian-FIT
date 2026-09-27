import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('next-auth')>()), getServerSession: vi.fn() }));

import { PUT as updateExercise } from '@/app/api/exercises/[id]/route';
import { POST as createExercise } from '@/app/api/exercises/route';
import { createPersonal, prisma, resetDatabase } from '../helpers/db';
import { json, request, signIn } from '../helpers/http';

beforeEach(resetDatabase);

const create = async (name: string) => json(await createExercise(request('POST', '/api/exercises', { name, muscleGroup: 'Costas' })));

describe('exercise names (A16)', () => {
    it("are unique within each trainer's library, not across trainers", async () => {
        const ana = await createPersonal();
        const bruno = await createPersonal();

        signIn(ana.session);
        expect((await create('Remada Cavalinho')).status).toBe(201);
        expect((await create('remada cavalinho')).status).toBe(409);

        signIn(bruno.session);
        expect((await create('Remada Cavalinho')).status).toBe(201);
        const other = await create('Remada Baixa');
        expect(other.status).toBe(201);
        // Renaming to a name only another trainer uses is fine too.
        const renamed = await json(
            await updateExercise(request('PUT', `/api/exercises/${other.body.id}`, { name: 'remada cavalinho unilateral' }), { params: { id: other.body.id } })
        );
        expect(renamed.status).toBe(200);
        expect(await prisma.exercise.count({ where: { name: 'Remada Cavalinho' } })).toBe(2);
    });

    it('still clash with the global library, ignoring case and accents', async () => {
        await prisma.exercise.create({ data: { name: 'Supino Reto', muscleGroup: 'Peito' } });
        signIn((await createPersonal()).session);
        expect((await create('supino reto')).status).toBe(409);
        expect((await create('Súpino Reto')).status).toBe(409);
    });
});
