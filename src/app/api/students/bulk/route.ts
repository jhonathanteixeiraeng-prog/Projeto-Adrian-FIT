import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { renewedExpiry } from '@/lib/student-status';

export const dynamic = 'force-dynamic';

const MAX_IDS = 500;
const STATUSES = ['ACTIVE', 'PAUSED', 'INACTIVE'];
const ACTIONS = ['MARK_PAID', 'RENEW', 'SET_STATUS'] as const;
type BulkAction = (typeof ACTIONS)[number];

const updatedSelect = {
    id: true,
    status: true,
    planType: true,
    planValue: true,
    planExpiresAt: true,
    paymentStatus: true,
} as const;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Expiry dates are calendar days: stored at 12:00 UTC like the date-only values sent by the web screens. */
const atNoonUtc = (date: Date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));

/**
 * POST /api/students/bulk - Apply one action to several students of the logged personal.
 * Body: { ids: string[], action: 'MARK_PAID' | 'RENEW' | 'SET_STATUS', status?: 'ACTIVE' | 'PAUSED' | 'INACTIVE' }
 * - MARK_PAID: paymentStatus = PAID
 * - RENEW: planExpiresAt advances one plan period (from the current expiry, or today when already expired) and paymentStatus = PAID
 * - SET_STATUS: status = body.status
 * Ids that don't belong to the personal are ignored (reported in `skipped`).
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.personalId || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }
        const personalId = session.user.personalId;

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }

        const ids: string[] = Array.isArray(body?.ids)
            ? Array.from(new Set(body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)))
            : [];
        const action = body?.action as BulkAction;

        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'Selecione pelo menos um aluno' }, { status: 400 });
        }
        if (ids.length > MAX_IDS) {
            return NextResponse.json({ success: false, error: `Selecione no máximo ${MAX_IDS} alunos por vez` }, { status: 400 });
        }
        if (!ACTIONS.includes(action)) {
            return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 });
        }
        if (action === 'SET_STATUS' && !STATUSES.includes(body.status)) {
            return NextResponse.json({ success: false, error: 'Status do aluno inválido' }, { status: 400 });
        }

        const students = await prisma.student.findMany({
            where: { id: { in: ids }, personalId },
            select: { id: true, planType: true, planExpiresAt: true },
        });
        if (students.length === 0) {
            return NextResponse.json({ success: false, error: 'Nenhum aluno encontrado' }, { status: 404 });
        }
        const ownedIds = students.map((student) => student.id);

        if (action === 'MARK_PAID') {
            await prisma.student.updateMany({ where: { id: { in: ownedIds }, personalId }, data: { paymentStatus: 'PAID' } });
        } else if (action === 'SET_STATUS') {
            await prisma.student.updateMany({ where: { id: { in: ownedIds }, personalId }, data: { status: body.status } });
        } else {
            let now = new Date();
            const clientDateRaw = typeof body?.clientDate === 'string' ? body.clientDate : typeof body?.today === 'string' ? body.today : null;
            if (clientDateRaw) {
                const trimmed = clientDateRaw.trim();
                if (DATE_ONLY_RE.test(trimmed)) {
                    const [y, m, d] = trimmed.split('-').map(Number);
                    const parsed = new Date(y, m - 1, d);
                    if (!Number.isNaN(parsed.getTime())) {
                        now = parsed;
                    }
                } else {
                    const parsed = new Date(trimmed);
                    if (!Number.isNaN(parsed.getTime())) {
                        now = parsed;
                    }
                }
            }
            await prisma.$transaction(
                students.map((student) =>
                    prisma.student.update({
                        where: { id: student.id },
                        data: {
                            planExpiresAt: atNoonUtc(renewedExpiry(student.planType, student.planExpiresAt, now)),
                            paymentStatus: 'PAID',
                        },
                    })
                )
            );
        }

        const updated = await prisma.student.findMany({
            where: { id: { in: ownedIds }, personalId },
            select: updatedSelect,
        });

        const count = updated.length;
        const noun = count === 1 ? 'aluno atualizado' : 'alunos atualizados';
        return NextResponse.json({
            success: true,
            data: { updated, count, skipped: ids.length - count },
            message: `${count} ${noun}`,
        });
    } catch (error) {
        console.error('Error in students bulk action:', error);
        return NextResponse.json({ success: false, error: 'Erro ao atualizar alunos' }, { status: 500 });
    }
}
