import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    TRANSACTION_OPTIONS,
    buildTemplateDaysCreateInput,
    prismaErrorResponse,
    templateUpsertSchema,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

const NOT_FOUND = { success: false, error: 'Modelo não encontrado' };

const templateDetailInclude = {
    templateDays: {
        orderBy: { order: 'asc' as const },
        include: {
            items: {
                orderBy: { order: 'asc' as const },
                include: { exercise: true },
            },
        },
    },
    _count: { select: { templateDays: true } },
};

async function getPersonalId() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.personalId || session.user.role !== 'PERSONAL') return null;
    return session.user.personalId;
}

// GET /api/workout-templates/[id] - Template with its days, items and exercises
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const template = await prisma.workoutTemplate.findFirst({
            where: { id: params.id, personalId },
            include: templateDetailInclude,
        });

        if (!template) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        return NextResponse.json({ success: true, data: template });
    } catch (error) {
        console.error('Error fetching workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar modelo de treino' }, { status: 500 });
    }
}

// PUT /api/workout-templates/[id] - Replace title, description and days (templates have no history to preserve)
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = templateUpsertSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const existing = await prisma.workoutTemplate.findFirst({
            where: { id: params.id, personalId },
            select: { id: true },
        });
        if (!existing) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        const template = await prisma.$transaction(async (tx) => {
            await tx.workoutTemplateDay.deleteMany({ where: { templateId: existing.id } });
            return tx.workoutTemplate.update({
                where: { id: existing.id },
                data: {
                    title: data.title,
                    description: data.description ?? null,
                    templateDays: { create: buildTemplateDaysCreateInput(data.templateDays) },
                },
                include: templateDetailInclude,
            });
        }, TRANSACTION_OPTIONS);

        return NextResponse.json({ success: true, data: template });
    } catch (error) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error updating workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao atualizar modelo de treino' }, { status: 500 });
    }
}

// DELETE /api/workout-templates/[id] - Remove a model owned by the signed-in personal.
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const personalId = await getPersonalId();
        if (!personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const template = await prisma.workoutTemplate.findFirst({
            where: { id: params.id, personalId },
            select: { id: true },
        });

        if (!template) {
            return NextResponse.json(NOT_FOUND, { status: 404 });
        }

        await prisma.workoutTemplate.delete({ where: { id: template.id } });
        return NextResponse.json({ success: true, message: 'Modelo de treino excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao excluir modelo de treino' }, { status: 500 });
    }
}
