import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const templateItemSchema = z.object({
    exerciseId: z.string(),
    sets: z.number().min(1),
    reps: z.string(),
    rest: z.number().min(0),
    notes: z.string().optional(),
    order: z.number(),
});

const templateDaySchema = z.object({
    name: z.string().min(1),
    dayOfWeek: z.number().min(0).max(6),
    items: z.array(templateItemSchema),
});

const workoutTemplateSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().optional(),
    templateDays: z.array(templateDaySchema),
});

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
                    include: {
                        items: {
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
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = workoutTemplateSchema.parse(body);

        const template = await prisma.workoutTemplate.create({
            data: {
                title: validatedData.title,
                description: validatedData.description,
                personalId: session.user.personalId!,
                templateDays: {
                    create: validatedData.templateDays.map((day, dayIndex) => ({
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        order: dayIndex,
                        items: {
                            create: day.items.map((item, itemIndex) => ({
                                exerciseId: item.exerciseId,
                                sets: item.sets,
                                reps: item.reps,
                                rest: item.rest,
                                notes: item.notes || '',
                                order: itemIndex,
                            })),
                        },
                    })),
                },
            },
            include: {
                templateDays: {
                    include: {
                        items: true,
                    },
                },
            },
        });

        return NextResponse.json({ success: true, data: template }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar modelo' }, { status: 500 });
    }
}
