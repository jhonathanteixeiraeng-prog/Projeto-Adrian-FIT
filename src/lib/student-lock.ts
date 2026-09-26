import type { Prisma } from '@prisma/client';

/**
 * Serializes the activations of one student's workout plans or diets. The no-op update locks the student's
 * row until the transaction ends, so a concurrent activation waits and then deactivates what this one
 * activated (the last one wins) instead of both staying active.
 *
 * Call it first in the transaction, before touching plans, so two activations never wait on each other.
 * A partial unique index ("one active per student") would enforce the same rule, but Prisma can't declare
 * it and `db push` would drop it.
 */
export async function lockStudentForActivation(tx: Prisma.TransactionClient, studentId: string) {
    await tx.$executeRaw`UPDATE "Student" SET "status" = "status" WHERE "id" = ${studentId}`;
}
