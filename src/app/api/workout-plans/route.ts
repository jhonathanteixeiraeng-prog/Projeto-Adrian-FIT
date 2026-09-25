import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import {
    TRANSACTION_OPTIONS,
    buildDaysCreateInput,
    buildTemplateDaysCreateInput,
    deactivateOtherActivePlans,
    parsePlanDate,
    planCreateSchema,
    planDetailInclude,
    prismaErrorResponse,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

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

        const where: Prisma.WorkoutPlanWhereInput = {};

        if (session.user.role === 'PERSONAL') {
            if (!session.user.personalId) {
                return NextResponse.json({ success: true, data: [] });
            }
            // Only their students' plans
            where.student = { personalId: session.user.personalId };
            if (studentId) where.studentId = studentId;
        } else if (session.user.role === 'STUDENT') {
            // Students only ever see their own plans (the studentId filter can't widen that)
            if (!session.user.studentId) {
                return NextResponse.json({ success: true, data: [] });
            }
            where.studentId = session.user.studentId;
        } else {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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
                            select: { name: true, avatar: true },
                        },
                    },
                },
                workoutDays: {
                    orderBy: { order: 'asc' },
                    select: {
                        id: true,
                        name: true,
                        dayOfWeek: true,
                        order: true,
                        _count: { select: { items: true } },
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

// POST - Create workout plan (active by default; the student's previous active plan is deactivated)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL' || !session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const personalId = session.user.personalId;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = planCreateSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const data = parsed.data;

        const student = await prisma.student.findFirst({
            where: { id: data.studentId, personalId },
            select: { id: true },
        });
        if (!student) {
            return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
        }

        const startDate = parsePlanDate(data.startDate)!;
        const endDate = parsePlanDate(data.endDate)!;
        const active = data.active ?? true;
        const days = data.workoutDays ?? [];

        const workoutPlan = await prisma.$transaction(async (tx) => {
            if (active) {
                await deactivateOtherActivePlans(tx, student.id);
            }

            const created = await tx.workoutPlan.create({
                data: {
                    title: data.title,
                    studentId: student.id,
                    startDate,
                    endDate,
                    active,
                    personalId,
                    version: 1,
                    workoutDays: days.length ? { create: buildDaysCreateInput(days) } : undefined,
                },
                include: planDetailInclude,
            });

            if (data.saveAsTemplate) {
                await tx.workoutTemplate.create({
                    data: {
                        title: data.title,
                        personalId,
                        templateDays: { create: buildTemplateDaysCreateInput(days) },
                    },
                });
            }

            return created;
        }, TRANSACTION_OPTIONS);

        if (active && data.notifyStudent) {
            await notifyStudentAboutPlan({ studentId: student.id, kind: 'workout', title: data.title });
        }

        return NextResponse.json({ success: true, data: workoutPlan }, { status: 201 });
    } catch (error) {
        const known = prismaErrorResponse(error);
        if (known) return known;
        console.error('Error creating workout plan:', error);
        return NextResponse.json({ success: false, error: 'Erro ao criar plano' }, { status: 500 });
    }
}
