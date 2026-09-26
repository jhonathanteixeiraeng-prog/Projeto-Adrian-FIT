import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * Server only. POST /api/workout-plans/[id]/sent and /api/diets/[id]/sent: the trainer exported
 * the plan's PDF. Records the moment and the version the PDF showed (the client sends the
 * version it rendered; it can't be newer than the stored one).
 */
export async function markPlanSent(request: NextRequest, kind: 'workout' | 'diet', planId: string) {
    try {
        const session = await getServerSession(authOptions);
        const personalId = session?.user?.role === 'PERSONAL' ? session.user.personalId : undefined;
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Acesso não autorizado' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const where = { id: planId, student: { personalId } };
        const plan =
            kind === 'workout'
                ? await prisma.workoutPlan.findFirst({ where, select: { version: true } })
                : await prisma.dietPlan.findFirst({ where, select: { version: true } });
        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 });
        }

        const rendered = Number(body?.version);
        const sentVersion = Number.isInteger(rendered) && rendered >= 1 && rendered <= plan.version ? rendered : plan.version;
        const data = { sentAt: new Date(), sentVersion };
        const saved =
            kind === 'workout'
                ? await prisma.workoutPlan.update({ where: { id: planId }, data, select: { version: true, sentAt: true, sentVersion: true } })
                : await prisma.dietPlan.update({ where: { id: planId }, data, select: { version: true, sentAt: true, sentVersion: true } });

        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        console.error(`Error marking ${kind} plan as sent:`, error);
        return NextResponse.json({ success: false, error: 'Erro ao registrar o envio' }, { status: 500 });
    }
}
