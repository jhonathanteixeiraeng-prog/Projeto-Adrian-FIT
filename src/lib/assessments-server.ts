import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

/** Server only. Shared by /api/students/[id]/assessments and its [assessmentId] route. */

export const assessmentInclude = {
    photos: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, url: true, angle: true },
    },
} satisfies Prisma.AssessmentInclude;

/** The student when it belongs to this trainer; never query with a missing personalId. */
export async function findOwnedStudent(studentId: string, personalId: string | undefined) {
    if (!personalId) return null;
    return prisma.student.findFirst({ where: { id: studentId, personalId }, select: { id: true } });
}

/**
 * Keeps Student.weight (the "current weight" the diet calculators use) equal to the weight of the
 * latest assessment that has one. Nothing changes when no assessment has a weight.
 */
export async function syncStudentWeight(tx: Prisma.TransactionClient, studentId: string) {
    const latest = await tx.assessment.findFirst({
        where: { studentId, weight: { not: null } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        select: { weight: true },
    });
    if (latest?.weight != null) {
        await tx.student.update({ where: { id: studentId }, data: { weight: latest.weight } });
    }
}
