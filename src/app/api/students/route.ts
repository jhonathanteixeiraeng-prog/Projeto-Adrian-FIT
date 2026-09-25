import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const PLAN_TYPES = ['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO'];
const PAYMENT_STATUSES = ['PAID', 'PENDENTE', 'PENDING', 'OVERDUE'];
const ACTIVITY_LEVELS = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'];

const badRequest = (error: string) => NextResponse.json({ success: false, error }, { status: 400 });

const cleanText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};

/** Date-only strings ("2026-10-01") are stored at 12:00 UTC so they show the same day in every Brazilian time zone. */
function parseDate(value: unknown): Date | null | 'invalid' {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return 'invalid';
    const trimmed = value.trim();
    const dateOnly = DATE_ONLY_RE.exec(trimmed);
    const date = dateOnly ? new Date(`${trimmed}T12:00:00.000Z`) : new Date(trimmed);
    return Number.isNaN(date.getTime()) ? 'invalid' : date;
}

function parsePositiveNumber(value: unknown): number | null | 'invalid' {
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(number) || number < 0) return 'invalid';
    // Legacy clients send 0 for "not informed".
    return number === 0 ? null : number;
}

// GET /api/students - List students for personal
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const students = await prisma.student.findMany({
            where: {
                personalId: session.user.personalId,
                ...(status && status !== 'all' && { status: status as any }),
                ...(search && {
                    user: {
                        OR: [
                            { name: { contains: search } },
                            { email: { contains: search } },
                        ],
                    },
                }),
            },
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
                // Several plans can be active at once (older endpoints never deactivated them): show the newest.
                workoutPlans: {
                    where: { active: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        workoutDays: {
                            select: { id: true, name: true }
                        }
                    }
                },
                dietPlans: {
                    where: { active: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
                workoutSessions: {
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                    select: { completedAt: true, dayName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ success: true, data: students });
    } catch (error) {
        console.error('Error fetching students:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao buscar alunos' },
            { status: 500 }
        );
    }
}

// POST /api/students - Create new student (optionally with contract and anamnesis)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }
        const personalId = session.user.personalId;

        let body: any;
        try {
            body = await request.json();
        } catch {
            return badRequest('Dados do cadastro inválidos');
        }
        if (!body || typeof body !== 'object') return badRequest('Dados do cadastro inválidos');

        const name = cleanText(body.name);
        const email = cleanText(body.email);
        const password = typeof body.password === 'string' ? body.password : '';

        if (!name || name.length < 2) return badRequest('Informe o nome do aluno');
        if (!email || !EMAIL_RE.test(email)) return badRequest('Informe um e-mail válido');
        if (password.length < 6) return badRequest('Senha deve ter no mínimo 6 caracteres');

        const phone = cleanText(body.phone);
        const goal = cleanText(body.goal);
        const gender = typeof body.gender === 'string' && GENDERS.includes(body.gender) ? body.gender : null;

        const birthDate = parseDate(body.birthDate);
        if (birthDate === 'invalid') return badRequest('Data de nascimento inválida');
        const height = parsePositiveNumber(body.height);
        if (height === 'invalid') return badRequest('Altura inválida');
        const weight = parsePositiveNumber(body.weight);
        if (weight === 'invalid') return badRequest('Peso inválido');

        // Contract: nothing is invented when it isn't informed (no default R$150 / "pago").
        if (body.planType != null && body.planType !== '' && !PLAN_TYPES.includes(body.planType)) {
            return badRequest('Tipo de plano inválido');
        }
        const planType: string | undefined = PLAN_TYPES.includes(body.planType) ? body.planType : undefined;
        let planValue: number | null = null;
        if (body.planValue !== undefined && body.planValue !== null && body.planValue !== '') {
            const parsedValue = typeof body.planValue === 'number' ? body.planValue : Number(String(body.planValue).replace(',', '.'));
            if (!Number.isFinite(parsedValue) || parsedValue < 0) return badRequest('Valor do plano inválido');
            planValue = parsedValue;
        }
        const planExpiresAt = parseDate(body.planExpiresAt);
        if (planExpiresAt === 'invalid') return badRequest('Data de vencimento inválida');
        if (body.paymentStatus != null && body.paymentStatus !== '' && !PAYMENT_STATUSES.includes(body.paymentStatus)) {
            return badRequest('Status de pagamento inválido');
        }
        const hasContract = planValue !== null || planExpiresAt !== null;
        const paymentStatus: string | null = PAYMENT_STATUSES.includes(body.paymentStatus)
            ? body.paymentStatus
            : hasContract
                ? 'PAID'
                : null;

        let anamnesis: Prisma.AnamnesisCreateWithoutStudentInput | null = null;
        if (body.anamnesis && typeof body.anamnesis === 'object') {
            const restrictions = cleanText(body.anamnesis.restrictions);
            const injuries = cleanText(body.anamnesis.injuries);
            const medications = cleanText(body.anamnesis.medications);
            const notes = cleanText(body.anamnesis.notes);
            const activityLevel = ACTIVITY_LEVELS.includes(body.anamnesis.activityLevel) ? body.anamnesis.activityLevel : null;
            if (restrictions || injuries || medications || notes || activityLevel) {
                anamnesis = {
                    restrictions,
                    injuries,
                    medications,
                    notes,
                    activityLevel: activityLevel || 'MODERATE',
                };
            }
        }

        // Case-insensitive on SQLite and Postgres alike (older accounts may have been saved with capitals).
        const normalizedEmail = email.toLowerCase();
        const candidates = await prisma.$queryRaw<Array<{ id: string; email: string }>>`
            SELECT id, email FROM "User" WHERE LOWER(email) = ${normalizedEmail}
        `;
        const match = candidates.find((candidate) => candidate.email === email) ?? candidates[0];
        const existingUser = match
            ? await prisma.user.findUnique({
                  where: { id: match.id },
                  include: {
                      student: { select: { id: true, personalId: true } },
                      personal: { select: { id: true } },
                  },
              })
            : null;

        if (existingUser?.student) {
            if (existingUser.student.personalId === personalId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Este e-mail já está cadastrado como seu aluno.',
                        code: 'STUDENT_EXISTS',
                        studentId: existingUser.student.id,
                    },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                {
                    success: false,
                    error: 'Este e-mail já está em uso. Use outro e-mail.',
                    code: 'EMAIL_IN_USE',
                },
                { status: 409 }
            );
        }
        if (existingUser && (existingUser.personal || existingUser.role === 'PERSONAL')) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Este e-mail já está em uso. Use outro e-mail.',
                    code: 'EMAIL_IN_USE',
                },
                { status: 409 }
            );
        }

        const { hash } = await import('bcryptjs');
        const hashedPassword = await hash(password, 12);

        // A student account without a student profile is left behind when a student is removed.
        // Registering the same e-mail again reuses that login with the new name and password.
        const reusedAccount = Boolean(existingUser);

        const student = await prisma.$transaction(async (tx) => {
            const user = existingUser
                ? await tx.user.update({
                      where: { id: existingUser.id },
                      data: { name, email: normalizedEmail, password: hashedPassword, role: 'STUDENT', ...(phone ? { phone } : {}) },
                  })
                : await tx.user.create({
                      data: { name, email: normalizedEmail, password: hashedPassword, role: 'STUDENT', phone },
                  });

            return tx.student.create({
                data: {
                    userId: user.id,
                    personalId,
                    birthDate,
                    gender,
                    height,
                    weight,
                    goal,
                    ...(planType ? { planType } : {}),
                    planValue,
                    planExpiresAt,
                    paymentStatus,
                    ...(anamnesis ? { anamnesis: { create: anamnesis } } : {}),
                },
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
                    anamnesis: true,
                },
            });
        });

        return NextResponse.json({
            success: true,
            data: student,
            passwordSet: true,
            reusedAccount,
            message: reusedAccount
                ? 'Aluno cadastrado! A conta de acesso que já existia com este e-mail foi reaproveitada com a nova senha.'
                : 'Aluno cadastrado com sucesso!',
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                { success: false, error: 'Este e-mail já está em uso. Use outro e-mail.', code: 'EMAIL_IN_USE' },
                { status: 409 }
            );
        }
        console.error('Error creating student:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao cadastrar aluno' },
            { status: 500 }
        );
    }
}
