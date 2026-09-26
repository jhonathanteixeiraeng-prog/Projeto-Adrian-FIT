import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ASSESSMENT_MEASURES, parseAssessmentBody } from '@/lib/assessments';
import { assessmentInclude, findOwnedStudent, syncStudentWeight } from '@/lib/assessments-server';

export const dynamic = 'force-dynamic';

const NOT_FOUND = { success: false, error: 'Aluno não encontrado' };

// GET /api/students/[id]/assessments - Assessments the trainer recorded, newest first.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const student = await findOwnedStudent(params.id, session.user.personalId);
        if (!student) return NextResponse.json(NOT_FOUND, { status: 404 });

        const assessments = await prisma.assessment.findMany({
            where: { studentId: student.id },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            include: assessmentInclude,
        });
        return NextResponse.json({ success: true, data: assessments });
    } catch (error) {
        console.error('Error listing assessments:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar avaliações' }, { status: 500 });
    }
}

// POST /api/students/[id]/assessments - Records an assessment (measures, notes and photos).
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const student = await findOwnedStudent(params.id, session.user.personalId);
        if (!student) return NextResponse.json(NOT_FOUND, { status: 404 });

        const parsed = parseAssessmentBody(await request.json().catch(() => null), { partial: false, uploaderId: session.user.id });
        if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        const { date, measures, notes, addPhotos } = parsed.data;

        const created = await prisma.$transaction(async (tx) => {
            const assessment = await tx.assessment.create({
                data: {
                    studentId: student.id,
                    date: date!,
                    ...Object.fromEntries(ASSESSMENT_MEASURES.map((measure) => [measure.key, measures[measure.key] ?? null])),
                    notes: notes ?? null,
                },
            });
            if (addPhotos.length > 0) {
                // Photos are dated like the assessment, so the gallery and the report compare the right days.
                await tx.progressPhoto.createMany({
                    data: addPhotos.map((photo) => ({
                        studentId: student.id,
                        assessmentId: assessment.id,
                        url: photo.url,
                        angle: photo.angle,
                        weight: measures.weight ?? null,
                        createdAt: date!,
                    })),
                });
            }
            await syncStudentWeight(tx, student.id);
            return tx.assessment.findUniqueOrThrow({ where: { id: assessment.id }, include: assessmentInclude });
        });

        return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (error) {
        console.error('Error creating assessment:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar a avaliação' }, { status: 500 });
    }
}
