import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const workoutItemSchema = z.object({
    exerciseId: z.string(),
    sets: z.number().min(1),
    reps: z.string(),
    rest: z.number().min(0),
    notes: z.string().optional(),
    order: z.number(),
});

const workoutDaySchema = z.object({
    name: z.string().min(1),
    dayOfWeek: z.number().min(0).max(6),
    items: z.array(workoutItemSchema),
});

const workoutPlanSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    startDate: z.string(),
    endDate: z.string(),
    active: z.boolean().optional(),
    saveAsTemplate: z.boolean().optional(),
    workoutDays: z.array(workoutDaySchema).optional(),
});

// GET - List workout plans
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get('studentId');
        const active = searchParams.get('active');

        const where: any = {};

        // If personal, show only their students' plans
        if (session.user.role === 'PERSONAL' && session.user.personalId) {
            where.student = {
                personalId: session.user.personalId,
            };
        }

        // If student, show only their plans
        if (session.user.role === 'STUDENT' && session.user.studentId) {
            where.studentId = session.user.studentId;
        }

        if (studentId) {
            where.studentId = studentId;
        }

        if (active !== null) {
            where.active = active === 'true';
        }

        const workoutPlans = await prisma.workoutPlan.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
                _count: {
                    select: { workoutDays: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: workoutPlans });
    } catch (error) {
        console.error('Error fetching workout plans:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar planos' }, { status: 500 });
    }
}

// POST - Create workout plan
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = workoutPlanSchema.parse(body);

        // Create workout plan with nested days and items
        const workoutPlan = await prisma.workoutPlan.create({
            data: {
                title: validatedData.title,
                studentId: validatedData.studentId,
                startDate: new Date(validatedData.startDate),
                endDate: new Date(validatedData.endDate),
                active: validatedData.active ?? true,
                personalId: session.user.personalId!,
                version: 1,
                workoutDays: validatedData.workoutDays ? {
                    create: validatedData.workoutDays.map((day, dayIndex) => ({
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
                } : undefined,
            },
            include: {
                workoutDays: {
                    include: {
                        items: {
                            include: {
                                exercise: true,
                            },
                        },
                    },
                },
                student: {
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        // If saveAsTemplate is true, create a template too
        if (validatedData.saveAsTemplate) {
            // @ts-ignore - Check if model exists in runtime even if types are stale
            if (!prisma.workoutTemplate) {
                console.error('CRITICAL: prisma.workoutTemplate is undefined. Prisma Client needs regeneration.');
                throw new Error('Erro interno: Modelo de template não encontrado. Por favor reinicie o servidor.');
            }

            // @ts-ignore
            await prisma.workoutTemplate.create({
                data: {
                    title: validatedData.title,
                    personalId: session.user.personalId!,
                    templateDays: {
                        create: validatedData.workoutDays?.map((day, dayIndex) => ({
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
                        })) || [],
                    },
                },
            });
        }

        return NextResponse.json({ success: true, data: workoutPlan }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating workout plan:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao criar plano'
        }, { status: 500 });
    }
}
