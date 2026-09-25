import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
    buildTemplateDaysCreateInput,
    prismaErrorResponse,
    templateUpsertSchema,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

// GET - List templates for personal trainer
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const templates = await prisma.workoutTemplate.findMany({
            where: {
                personalId: session.user.personalId!,
            },
            include: {
                templateDays: {
                    orderBy: { order: 'asc' },
                    include: {
                        items: {
                            orderBy: { order: 'asc' },
                            include: {
                                exercise: true,
                            },
                        },
                    },
                },
                _count: {
                    select: { templateDays: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: templates });
    } catch (error) {
        console.error('Error fetching workout templates:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar modelos' }, { status: 500 });
    }
}

// POST - Create workout template
export async function POST(request: NextRequest) {
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

        const parsed = templateUpsertSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const template = await prisma.workoutTemplate.create({
            data: {
                title: data.title,
                description: data.description || undefined,
                personalId: session.user.personalId,
                templateDays: {
                    create: buildTemplateDaysCreateInput(data.templateDays),
                },
            },
            include: {
                templateDays: {
                    orderBy: { order: 'asc' },
                    include: {
                        items: { orderBy: { order: 'asc' } },
                    },
                },
                _count: { select: { templateDays: true } },
            },
        });

        return NextResponse.json({ success: true, data: template }, { status: 201 });
    } catch (error) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error creating workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar modelo' }, { status: 500 });
    }
}
