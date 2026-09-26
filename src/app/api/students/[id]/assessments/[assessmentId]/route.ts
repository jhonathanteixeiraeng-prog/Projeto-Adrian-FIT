import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { parseAssessmentBody } from '@/lib/assessments';
import { assessmentInclude, findOwnedStudent, syncStudentWeight } from '@/lib/assessments-server';
import { deleteUnusedPhotoFiles } from '@/lib/photo-storage';

export const dynamic = 'force-dynamic';

const NOT_FOUND = { success: false, error: 'Avaliação não encontrada' };

type Params = { params: { id: string; assessmentId: string } };

async function findAssessment(ids: Params['params'], personalId: string | undefined) {
    const student = await findOwnedStudent(ids.id, personalId);
    if (!student) return null;
    return prisma.assessment.findFirst({ where: { id: ids.assessmentId, studentId: student.id } });
}

// PUT /api/students/[id]/assessments/[assessmentId] - Edits measures, date, notes and photos.
// A missing key keeps the stored value; null clears it.
export async function PUT(request: NextRequest, { params }: Params) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const assessment = await findAssessment(params, session.user.personalId);
        if (!assessment) return NextResponse.json(NOT_FOUND, { status: 404 });

        const parsed = parseAssessmentBody(await request.json().catch(() => null), { partial: true, uploaderId: session.user.id });
        if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        const { date, measures, notes, addPhotos, removePhotoIds } = parsed.data;

        let removedUrls: string[] = [];
        const updated = await prisma.$transaction(async (tx) => {
            const saved = await tx.assessment.update({
                where: { id: assessment.id },
                data: { ...(date ? { date } : {}), ...measures, ...(notes !== undefined ? { notes } : {}) },
            });
            if (removePhotoIds.length > 0) {
                const removed = { id: { in: removePhotoIds }, assessmentId: saved.id };
                removedUrls = (await tx.progressPhoto.findMany({ where: removed, select: { url: true } })).map((photo) => photo.url);
                await tx.progressPhoto.deleteMany({ where: removed });
            }
            // The assessment's photos follow its date and weight.
            await tx.progressPhoto.updateMany({
                where: { assessmentId: saved.id },
                data: { createdAt: saved.date, weight: saved.weight },
            });
            if (addPhotos.length > 0) {
                await tx.progressPhoto.createMany({
                    data: addPhotos.map((photo) => ({
                        studentId: saved.studentId,
                        assessmentId: saved.id,
                        url: photo.url,
                        angle: photo.angle,
                        weight: saved.weight,
                        createdAt: saved.date,
                    })),
                });
            }
            await syncStudentWeight(tx, saved.studentId);
            return tx.assessment.findUniqueOrThrow({ where: { id: saved.id }, include: assessmentInclude });
        });
        await deleteUnusedPhotoFiles(removedUrls);

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating assessment:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar a avaliação' }, { status: 500 });
    }
}

// DELETE /api/students/[id]/assessments/[assessmentId] - Removes the assessment and its photos.
export async function DELETE(_request: NextRequest, { params }: Params) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const assessment = await findAssessment(params, session.user.personalId);
        if (!assessment) return NextResponse.json(NOT_FOUND, { status: 404 });

        const removedUrls = await prisma.$transaction(async (tx) => {
            const photos = await tx.progressPhoto.findMany({ where: { assessmentId: assessment.id }, select: { url: true } });
            await tx.progressPhoto.deleteMany({ where: { assessmentId: assessment.id } });
            await tx.assessment.delete({ where: { id: assessment.id } });
            await syncStudentWeight(tx, assessment.studentId);
            return photos.map((photo) => photo.url);
        });
        await deleteUnusedPhotoFiles(removedUrls);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting assessment:', error);
        return NextResponse.json({ success: false, error: 'Erro ao excluir a avaliação' }, { status: 500 });
    }
}
