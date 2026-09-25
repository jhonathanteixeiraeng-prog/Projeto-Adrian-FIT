import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const STATUSES = ['ACTIVE', 'PAUSED', 'INACTIVE'];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const PLAN_TYPES = ['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO'];
const PAYMENT_STATUSES = ['PAID', 'PENDENTE', 'PENDING', 'OVERDUE'];
const ACTIVITY_LEVELS = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];

const PROFILE_CHECKINS = 60;
const PROFILE_PHOTOS = 60;
const REPORT_LIMIT = 500;

const userSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatar: true,
} as const;

class InvalidField extends Error {}

/** Date-only strings ("2026-10-01") are stored at 12:00 UTC so they show the same day in every Brazilian time zone. */
function toDate(value: unknown, label: string): Date {
    if (typeof value !== 'string') throw new InvalidField(`${label} inválida`);
    const trimmed = value.trim();
    const date = DATE_ONLY_RE.test(trimmed) ? new Date(`${trimmed}T12:00:00.000Z`) : new Date(trimmed);
    if (Number.isNaN(date.getTime())) throw new InvalidField(`${label} inválida`);
    return date;
}

function toNumber(value: unknown, label: string): number {
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(number) || number < 0) throw new InvalidField(`${label} inválido`);
    return number;
}

const cleanText = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Field semantics (backward compatible with the iOS app and older web screens):
 * - absent / "" → keep the current value (legacy clients send "" or 0 for "not informed");
 * - null        → clear the field;
 * - value       → validate and save.
 */
function buildUpdate(body: any) {
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined && body[key] !== '';
    const student: Prisma.StudentUpdateInput = {};
    const user: Prisma.UserUpdateWithoutStudentInput = {};

    if (has('name')) {
        const name = cleanText(body.name);
        if (!name) throw new InvalidField('Nome inválido');
        user.name = name;
    }
    if (has('phone')) user.phone = body.phone === null ? null : cleanText(body.phone);
    if (has('goal')) student.goal = body.goal === null ? null : cleanText(body.goal);
    if (has('birthDate')) student.birthDate = body.birthDate === null ? null : toDate(body.birthDate, 'Data de nascimento');
    if (has('gender')) {
        if (body.gender !== null && !GENDERS.includes(body.gender)) throw new InvalidField('Sexo inválido');
        student.gender = body.gender;
    }
    if (has('height') && body.height !== 0) student.height = body.height === null ? null : toNumber(body.height, 'Altura') || null;
    if (has('weight') && body.weight !== 0) student.weight = body.weight === null ? null : toNumber(body.weight, 'Peso') || null;
    if (has('status')) {
        if (!STATUSES.includes(body.status)) throw new InvalidField('Status do aluno inválido');
        student.status = body.status;
    }
    if (has('planType')) {
        if (body.planType !== null && !PLAN_TYPES.includes(body.planType)) throw new InvalidField('Tipo de plano inválido');
        student.planType = body.planType;
    }
    // planValue was always "set when present": null now clears it instead of becoming 0.
    if (body.planValue !== undefined) {
        student.planValue = body.planValue === null || body.planValue === '' ? null : toNumber(body.planValue, 'Valor do plano');
    }
    if (body.planExpiresAt === null) student.planExpiresAt = null;
    else if (has('planExpiresAt')) student.planExpiresAt = toDate(body.planExpiresAt, 'Data de vencimento');
    if (has('paymentStatus')) {
        if (body.paymentStatus !== null && !PAYMENT_STATUSES.includes(body.paymentStatus)) {
            throw new InvalidField('Status de pagamento inválido');
        }
        student.paymentStatus = body.paymentStatus;
    }

    return { student, user };
}

async function loadAccess(id: string) {
    return prisma.student.findUnique({ where: { id }, select: { id: true, personalId: true } });
}

// GET /api/students/[id] - Get student details
// ?view=profile → lean payload for the trainer's student hub (active plans in full, other plans as summaries)
// ?view=report  → everything the evolution report needs (all check-ins and photos, trainer branding)
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const access = await loadAccess(params.id);
        if (!access) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        // Check authorization
        if (session.user.role === 'PERSONAL' && access.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 403 }
            );
        }

        if (session.user.role === 'STUDENT' && access.id !== session.user.studentId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 403 }
            );
        }

        const view = request.nextUrl.searchParams.get('view');
        const firstCheckinQuery = prisma.checkin.findFirst({
            where: { studentId: params.id },
            orderBy: { date: 'asc' },
        });

        if (view === 'profile') {
            const [student, activeWorkoutPlan, activeDietPlan, firstCheckin] = await Promise.all([
                prisma.student.findUnique({
                    where: { id: params.id },
                    include: {
                        user: { select: userSelect },
                        anamnesis: true,
                        workoutPlans: {
                            orderBy: { createdAt: 'desc' },
                            select: {
                                id: true,
                                title: true,
                                startDate: true,
                                endDate: true,
                                active: true,
                                createdAt: true,
                                updatedAt: true,
                                _count: { select: { workoutDays: true } },
                            },
                        },
                        dietPlans: {
                            orderBy: { createdAt: 'desc' },
                            select: {
                                id: true,
                                title: true,
                                startDate: true,
                                endDate: true,
                                active: true,
                                calories: true,
                                protein: true,
                                carbs: true,
                                fat: true,
                                createdAt: true,
                                updatedAt: true,
                            },
                        },
                        checkins: { orderBy: { date: 'desc' }, take: PROFILE_CHECKINS },
                        progressPhotos: { orderBy: { createdAt: 'desc' }, take: PROFILE_PHOTOS },
                        workoutSessions: {
                            orderBy: { completedAt: 'desc' },
                            take: 10,
                            select: {
                                id: true,
                                dayName: true,
                                status: true,
                                completedAt: true,
                                percentage: true,
                                durationSeconds: true,
                                completedSets: true,
                                totalSets: true,
                            },
                        },
                        _count: { select: { checkins: true, progressPhotos: true, workoutSessions: true } },
                    },
                }),
                prisma.workoutPlan.findFirst({
                    where: { studentId: params.id, active: true },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        workoutDays: {
                            orderBy: [{ dayOfWeek: 'asc' }, { order: 'asc' }],
                            include: {
                                items: {
                                    orderBy: { order: 'asc' },
                                    include: {
                                        exercise: {
                                            select: { id: true, name: true, muscleGroup: true, equipment: true, videoUrl: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                }),
                prisma.dietPlan.findFirst({
                    where: { studentId: params.id, active: true },
                    orderBy: { createdAt: 'desc' },
                    include: { meals: { orderBy: { order: 'asc' } } },
                }),
                firstCheckinQuery,
            ]);

            if (!student) {
                return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
            }
            return NextResponse.json({
                success: true,
                data: { ...student, activeWorkoutPlan, activeDietPlan, firstCheckin },
            });
        }

        if (view === 'report') {
            const [student, firstCheckin] = await Promise.all([
                prisma.student.findUnique({
                    where: { id: params.id },
                    include: {
                        user: { select: userSelect },
                        personal: {
                            select: {
                                id: true,
                                brandName: true,
                                user: { select: { name: true, email: true, phone: true } },
                            },
                        },
                        checkins: { orderBy: { date: 'desc' }, take: REPORT_LIMIT },
                        progressPhotos: { orderBy: { createdAt: 'desc' }, take: REPORT_LIMIT },
                    },
                }),
                firstCheckinQuery,
            ]);

            if (!student) {
                return NextResponse.json({ success: false, error: 'Aluno não encontrado' }, { status: 404 });
            }
            return NextResponse.json({ success: true, data: { ...student, firstCheckin } });
        }

        const [student, firstCheckin] = await Promise.all([
            prisma.student.findUnique({
                where: { id: params.id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            avatar: true,
                        },
                    },
                    personal: {
                        include: {
                            user: {
                                select: {
                                    name: true,
                                    email: true,
                                    phone: true,
                                },
                            },
                        },
                    },
                    anamnesis: true,
                    workoutPlans: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            workoutDays: {
                                include: {
                                    items: {
                                        include: {
                                            exercise: true,
                                        },
                                        orderBy: { order: 'asc' },
                                    },
                                },
                                orderBy: { dayOfWeek: 'asc' },
                            },
                        },
                    },
                    dietPlans: {
                        orderBy: { createdAt: 'desc' },
                        include: {
                            meals: {
                                orderBy: { order: 'asc' },
                            },
                        },
                    },
                    checkins: {
                        orderBy: { date: 'desc' },
                        take: 20,
                        include: {
                            photos: true,
                        },
                    },
                    progressPhotos: {
                        orderBy: { createdAt: 'desc' },
                        take: 50,
                    },
                },
            }),
            firstCheckinQuery,
        ]);

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: { ...student, firstCheckin } });
    } catch (error) {
        console.error('Error fetching student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar aluno' },
            { status: 500 }
        );
    }
}

// PUT (and PATCH) /api/students/[id] - Update student data, contract, status and anamnesis
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { id: params.id },
        });

        if (!student || student.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }

        let update: ReturnType<typeof buildUpdate>;
        try {
            update = buildUpdate(body);
        } catch (error) {
            if (error instanceof InvalidField) {
                return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            }
            throw error;
        }

        const operations: Prisma.PrismaPromise<unknown>[] = [];

        // Upsert da anamnese quando enviada (restrições alimentares, lesões etc.)
        const { anamnesis } = body;
        if (anamnesis && typeof anamnesis === 'object') {
            const activityLevel = ACTIVITY_LEVELS.includes(anamnesis.activityLevel) ? anamnesis.activityLevel : undefined;
            const text = (key: 'restrictions' | 'injuries' | 'medications' | 'notes') =>
                anamnesis[key] === undefined ? undefined : cleanText(anamnesis[key]);

            operations.push(
                prisma.anamnesis.upsert({
                    where: { studentId: params.id },
                    update: {
                        restrictions: text('restrictions'),
                        injuries: text('injuries'),
                        medications: text('medications'),
                        notes: text('notes'),
                        activityLevel,
                    },
                    create: {
                        studentId: params.id,
                        restrictions: text('restrictions') ?? null,
                        injuries: text('injuries') ?? null,
                        medications: text('medications') ?? null,
                        notes: text('notes') ?? null,
                        activityLevel: activityLevel || 'MODERATE',
                    },
                })
            );
        }

        operations.push(
            prisma.student.update({
                where: { id: params.id },
                data: {
                    ...update.student,
                    ...(Object.keys(update.user).length > 0 ? { user: { update: update.user } } : {}),
                },
                include: {
                    user: { select: userSelect },
                    anamnesis: true,
                },
            })
        );

        const results = await prisma.$transaction(operations);
        const updatedStudent = results[results.length - 1];

        return NextResponse.json({
            success: true,
            data: updatedStudent,
            message: 'Aluno atualizado com sucesso!',
        });
    } catch (error) {
        console.error('Error updating student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao atualizar aluno' },
            { status: 500 }
        );
    }
}

export const PATCH = PUT;

// DELETE /api/students/[id] - Delete student
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Não autorizado' },
                { status: 401 }
            );
        }

        const student = await prisma.student.findUnique({
            where: { id: params.id },
        });

        if (!student || student.personalId !== session.user.personalId) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        await prisma.student.delete({
            where: { id: params.id },
        });

        return NextResponse.json({
            success: true,
            message: 'Aluno removido com sucesso!',
        });
    } catch (error) {
        console.error('Error deleting student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao remover aluno' },
            { status: 500 }
        );
    }
}
