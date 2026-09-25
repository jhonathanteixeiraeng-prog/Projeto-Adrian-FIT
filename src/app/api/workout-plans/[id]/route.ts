import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import {
    TRANSACTION_OPTIONS,
    canAccessPlan,
    deactivateOtherActivePlans,
    parsePlanDate,
    planDetailInclude,
    planUpdateSchema,
    prismaErrorResponse,
    syncPlanDays,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const NOT_FOUND = { success: false, error: 'Ficha de treino não encontrada' };

class VersionConflictError extends Error {}

function versionConflict(currentVersion: number) {
    return NextResponse.json(
        {
            success: false,
            code: 'VERSION_CONFLICT',
            currentVersion,
            error: `Esta ficha foi alterada em outro lugar (agora está na versão ${currentVersion}). Recarregue para ver as mudanças ou salve novamente para sobrescrever.`,
        },
        { status: 409 }
    );
}

// GET - Get single workout plan (raw plan object, used by the web editor and the iOS app)
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { id: params.id },
            include: planDetailInclude,
        });

        if (!workoutPlan || !canAccessPlan(session.user, workoutPlan)) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        return NextResponse.json(workoutPlan);
    } catch (error) {
        console.error('Error fetching workout plan:', error);
        return NextResponse.json({ error: 'Erro ao buscar plano' }, { status: 500 });
    }
}

// PUT - Update workout plan. Days are synced in place so their ids (and the students' history) survive edits.
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = planUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const plan = await prisma.workoutPlan.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                title: true,
                active: true,
                personalId: true,
                studentId: true,
                version: true,
                student: { select: { personalId: true } },
            },
        });

        if (!plan || !canAccessPlan(session.user, plan)) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        if (data.version !== undefined && data.version !== plan.version) {
            return versionConflict(plan.version);
        }

        const startDate = data.startDate ? parsePlanDate(data.startDate) : null;
        const endDate = data.endDate ? parsePlanDate(data.endDate) : null;
        const contentChanged =
            data.workoutDays !== undefined || data.title !== undefined || startDate !== null || endDate !== null;

        if (!contentChanged && data.active === undefined) {
            const unchanged = await prisma.workoutPlan.findUnique({ where: { id: plan.id }, include: planDetailInclude });
            return NextResponse.json({ success: true, data: unchanged });
        }

        try {
            await prisma.$transaction(async (tx) => {
                if (data.active === true) {
                    await deactivateOtherActivePlans(tx, plan.studentId, plan.id);
                }

                // Conditional on the loaded version (when sent) so two concurrent saves can't both win.
                const updated = await tx.workoutPlan.updateMany({
                    where: { id: plan.id, ...(data.version !== undefined ? { version: data.version } : {}) },
                    data: {
                        title: data.title,
                        startDate: startDate ?? undefined,
                        endDate: endDate ?? undefined,
                        active: data.active,
                        version: contentChanged ? { increment: 1 } : undefined,
                    },
                });
                if (updated.count === 0) throw new VersionConflictError();

                if (data.workoutDays) {
                    await syncPlanDays(tx, plan.id, data.workoutDays);
                }
            }, TRANSACTION_OPTIONS);
        } catch (error) {
            if (error instanceof VersionConflictError) {
                const current = await prisma.workoutPlan.findUnique({ where: { id: plan.id }, select: { version: true } });
                return versionConflict(current?.version ?? plan.version);
            }
            throw error;
        }

        const transitionedToActive = !plan.active && data.active === true;

        const result = await prisma.workoutPlan.findUnique({
            where: { id: plan.id },
            include: planDetailInclude,
        });

        if (transitionedToActive && data.notifyStudent) {
            await notifyStudentAboutPlan({
                studentId: plan.studentId,
                kind: 'workout',
                title: data.title ?? plan.title,
            });
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error updating workout plan:', error);
        return NextResponse.json({ success: false, error: 'Erro ao atualizar plano' }, { status: 500 });
    }
}

// DELETE - Delete workout plan (days, items and completions cascade)
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const plan = await prisma.workoutPlan.findUnique({
            where: { id: params.id },
            select: { id: true, personalId: true, studentId: true, student: { select: { personalId: true } } },
        });

        if (!plan || !canAccessPlan(session.user, plan)) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        await prisma.workoutPlan.delete({ where: { id: plan.id } });

        return NextResponse.json({ success: true, message: 'Plano excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting workout plan:', error);
        return NextResponse.json({ error: 'Erro ao excluir plano' }, { status: 500 });
    }
}
