import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const cloneSchema = z.object({
    templateId: z.string().min(1, 'Template ID is required'),
    studentId: z.string().min(1, 'Student ID is required'),
    title: z.string().min(1, 'Title is required'),
    startDate: z.string(),
    endDate: z.string(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = cloneSchema.parse(body);

        // Fetch the template with days and items
        const template = await prisma.workoutTemplate.findUnique({
            where: {
                id: validatedData.templateId,
                personalId: session.user.personalId!,
            },
            include: {
                templateDays: {
                    include: {
                        items: true,
                    },
                },
            },
        });

        if (!template) {
            return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 });
        }

        // Create the new WorkoutPlan based on the template
        const workoutPlan = await prisma.workoutPlan.create({
            data: {
                title: validatedData.title,
                studentId: validatedData.studentId,
                personalId: session.user.personalId!,
                startDate: new Date(validatedData.startDate),
                endDate: new Date(validatedData.endDate),
                active: true,
                version: 1,
                workoutDays: {
                    create: template.templateDays.map((day) => ({
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        order: day.order,
                        items: {
                            create: day.items.map((item) => ({
                                exerciseId: item.exerciseId,
                                sets: item.sets,
                                reps: item.reps,
                                rest: item.rest,
                                notes: item.notes || '',
                                order: item.order,
                            })),
                        },
                    })),
                },
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
            },
        });

        return NextResponse.json({ success: true, data: workoutPlan }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ success: false, error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error cloning workout template:', error);
        return NextResponse.json({ success: false, error: 'Erro ao clonar modelo' }, { status: 500 });
    }
}
