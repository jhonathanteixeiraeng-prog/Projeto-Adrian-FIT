import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { findOwnedStudent } from '@/lib/assessments-server';

export const dynamic = 'force-dynamic';

const MAX_OPINION = 4000;

// PUT /api/students/[id]/report-opinion - The trainer's opinion on the evolution report ({ opinion }).
// It goes on the printed report and in the PDF sent to the student; an empty text clears it.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const student = await findOwnedStudent(params.id, session.user.personalId);
        if (!student) return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });

        const body = await request.json().catch(() => null);
        if (typeof body?.opinion !== 'string' && body?.opinion !== null) {
            return NextResponse.json({ success: false, error: 'Parecer inválido' }, { status: 400 });
        }
        const opinion = (body.opinion ?? '').trim();
        if (opinion.length > MAX_OPINION) {
            return NextResponse.json({ success: false, error: `O parecer pode ter no máximo ${MAX_OPINION} caracteres` }, { status: 400 });
        }

        const saved = await prisma.student.update({
            where: { id: student.id },
            data: { reportOpinion: opinion || null },
            select: { reportOpinion: true },
        });
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        console.error('Error saving the report opinion:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar o parecer' }, { status: 500 });
    }
}
