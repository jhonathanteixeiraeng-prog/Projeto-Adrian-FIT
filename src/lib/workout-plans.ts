import type { Prisma } from '@prisma/client';
import { normalizeLoadInput, normalizeRpeInput } from '@/lib/workout-load';
import { findGroupIssues, normalizedGroupIds } from '@/lib/workout-groups';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeText } from '@/lib/utils';

/**
 * Server-side rules shared by every route that creates or edits workout plans
 * (web editor, iOS app, clone, templates): validation with pt-BR messages,
 * date parsing, the "one active plan per student" rule and the day/item sync
 * that preserves WorkoutDay ids (completions, set logs and sessions reference them).
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date-only strings ("2026-09-25") are stored at 12:00 UTC so they show the same
 * calendar day in any Brazilian time zone; full ISO timestamps (iOS) are kept as sent.
 */
export function parsePlanDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = DATE_ONLY.exec(trimmed);
    if (match) {
        const date = new Date(`${trimmed}T12:00:00.000Z`);
        if (Number.isNaN(date.getTime())) return null;
        // Reject overflowing dates such as 2026-02-31.
        if (date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3])) return null;
        return date;
    }
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const restBySetSchema = z
    .union([z.string(), z.array(z.number())])
    .nullish()
    .transform((value, ctx) => {
        if (value === null || value === undefined || value === '') return null;
        let parsed: unknown = value;
        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            } catch {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descanso por série inválido' });
                return z.NEVER;
            }
        }
        if (
            !Array.isArray(parsed) ||
            parsed.some((rest) => typeof rest !== 'number' || !Number.isFinite(rest) || rest < 0 || rest > 600)
        ) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Descanso: use até 600 s (10 min)' });
            return z.NEVER;
        }
        return parsed.length ? JSON.stringify(parsed.map((rest) => Math.round(rest))) : null;
    });

const planItemFieldsSchema = z.object({
    id: z.string().nullish(),
    exerciseId: z
        .string({ required_error: 'Selecione o exercício', invalid_type_error: 'Selecione o exercício' })
        .trim()
        .min(1, 'Selecione o exercício'),
    sets: z.coerce
        .number({ invalid_type_error: 'Informe o número de séries' })
        .int('Séries deve ser um número inteiro')
        .min(1, 'Séries: use de 1 a 12 (limite do app do aluno)')
        .max(12, 'Séries: use de 1 a 12 (limite do app do aluno)'),
    reps: z
        .string({ required_error: 'Informe as repetições', invalid_type_error: 'Repetições inválidas' })
        .trim()
        .min(1, 'Informe as repetições')
        .max(60, 'Repetições: use no máximo 60 caracteres')
        .refine(
            (value) => {
                const lower = value.trim().toLowerCase();
                return lower !== 'reps' && !lower.includes('definir');
            },
            { message: 'Informe as repetições' }
        ),
    rest: z.coerce
        .number({ invalid_type_error: 'Descanso inválido' })
        .int('Descanso deve ser um número inteiro de segundos')
        .min(0, 'Descanso não pode ser negativo')
        .max(600, 'Descanso: use até 600 s (10 min)')
        .default(60),
    restBySet: restBySetSchema,
    notes: z.string({ invalid_type_error: 'Observações inválidas' }).max(1000, 'Observações: use no máximo 1000 caracteres').nullish(),
    // Omitted (undefined) = keep what is stored: the iOS app released before these fields doesn't send them.
    load: z.string({ invalid_type_error: 'Carga inválida' }).max(80, 'Carga: use no máximo 80 caracteres').nullish(),
    rpe: z.string({ invalid_type_error: 'RPE inválido' }).max(20, 'RPE: use no máximo 20 caracteres').nullish(),
    // Superset (bi-set/tri-set): consecutive items of the day sharing an id. Omitted = keep (older app versions).
    groupId: z.string({ invalid_type_error: 'Grupo inválido' }).trim().max(40, 'Grupo inválido').nullish(),
    order: z.number().optional(),
});

export const planItemInputSchema = planItemFieldsSchema
    .superRefine((item, ctx) => {
        if (item.load != null) {
            const load = normalizeLoadInput(item.load, item.sets);
            if (!load.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['load'], message: load.error });
        }
        if (item.rpe != null) {
            const rpe = normalizeRpeInput(item.rpe);
            if (!rpe.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rpe'], message: rpe.error });
        }
    })
    .transform((item) => {
        const load = item.load == null ? item.load : normalizeLoadInput(item.load, item.sets);
        const rpe = item.rpe == null ? item.rpe : normalizeRpeInput(item.rpe);
        return {
            ...item,
            load: load && typeof load === 'object' ? (load.ok ? load.value : null) : load,
            rpe: rpe && typeof rpe === 'object' ? (rpe.ok ? rpe.value : null) : rpe,
        };
    });

export const planDayInputSchema = z.object({
    id: z.string().nullish(),
    name: z
        .string({ required_error: 'Informe o nome do treino', invalid_type_error: 'Nome do treino inválido' })
        .trim()
        .min(1, 'Informe o nome do treino')
        .max(80, 'Nome do treino: use no máximo 80 caracteres'),
    // 7 is accepted as Sunday (ISO weekday) for older clients.
    dayOfWeek: z.preprocess(
        (value) => (value === 7 || value === '7' ? 0 : value),
        z.coerce
            .number({ invalid_type_error: 'Dia da semana inválido' })
            .int('Dia da semana inválido')
            .min(0, 'Dia da semana deve estar entre domingo (0) e sábado (6)')
            .max(6, 'Dia da semana deve estar entre domingo (0) e sábado (6)')
    ),
    items: z.array(planItemInputSchema, { invalid_type_error: 'Lista de exercícios inválida' }).default([]),
})
    .superRefine((day, ctx) => {
        // Only clients that send groups are validated; older ones get their kept groups repaired on save.
        if (day.items.every((item) => item.groupId === undefined)) return;
        findGroupIssues(day.items).forEach((issue) =>
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', issue.index, 'groupId'], message: issue.message })
        );
    })
    .transform((day) => {
        if (day.items.every((item) => item.groupId === undefined)) return day;
        const ids = normalizedGroupIds(day.items);
        return { ...day, items: day.items.map((item, index) => ({ ...item, groupId: ids[index] })) };
    });

const titleSchema = z
    .string({ required_error: 'Informe o título da ficha', invalid_type_error: 'Título inválido' })
    .trim()
    .min(1, 'Informe o título da ficha')
    .max(120, 'Título: use no máximo 120 caracteres');

const requiredDate = (label: string) =>
    z
        .string({ required_error: `Informe a data de ${label}`, invalid_type_error: `Data de ${label} inválida` })
        .refine((value) => parsePlanDate(value) !== null, `Data de ${label} inválida`);

const optionalDate = (label: string) =>
    z
        .string({ invalid_type_error: `Data de ${label} inválida` })
        .nullish()
        .refine((value) => !value || parsePlanDate(value) !== null, `Data de ${label} inválida`);

export const planCreateSchema = z.object({
    title: titleSchema,
    studentId: z.string({ required_error: 'Selecione o aluno', invalid_type_error: 'Aluno inválido' }).min(1, 'Selecione o aluno'),
    startDate: requiredDate('início'),
    endDate: requiredDate('término'),
    active: z.boolean().optional(),
    notifyStudent: z.boolean().optional(),
    saveAsTemplate: z.boolean().optional(),
    workoutDays: z.array(planDayInputSchema, { invalid_type_error: 'Dias de treino inválidos' }).optional(),
});

export const planUpdateSchema = z.object({
    title: titleSchema.optional(),
    startDate: optionalDate('início'),
    endDate: optionalDate('término'),
    active: z.boolean().optional(),
    notifyStudent: z.boolean().optional(),
    /** Optional optimistic lock: the version the client loaded. */
    version: z.number().int().optional(),
    workoutDays: z.array(planDayInputSchema, { invalid_type_error: 'Dias de treino inválidos' }).optional(),
});

export const templateDayInputSchema = planDayInputSchema;

export const templateUpsertSchema = z.object({
    title: z
        .string({ required_error: 'Informe o nome do modelo', invalid_type_error: 'Nome do modelo inválido' })
        .trim()
        .min(1, 'Informe o nome do modelo')
        .max(120, 'Nome do modelo: use no máximo 120 caracteres'),
    description: z.string().max(500, 'Descrição: use no máximo 500 caracteres').nullish(),
    templateDays: z.array(templateDayInputSchema, { invalid_type_error: 'Dias do modelo inválidos' }),
});

const DIFFICULTIES = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'] as const;

/** Empty strings clear the field (null); anything else must be a full HTTP/HTTPS URL. */
const optionalUrl = (label: string) =>
    z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
        z
            .string({ invalid_type_error: `${label} inválida` })
            .trim()
            .url(`${label} inválida. Cole o link completo, começando com https://`)
            .refine(
                (url) => /^https?:\/\//i.test(url),
                { message: `${label} inválida. Cole o link completo, começando com https:// ou http://` }
            )
            .nullish()
    );

export const exerciseCreateSchema = z.object({
    name: z
        .string({ required_error: 'Informe o nome do exercício', invalid_type_error: 'Nome inválido' })
        .trim()
        .min(1, 'Informe o nome do exercício')
        .max(120, 'Nome: use no máximo 120 caracteres'),
    muscleGroup: z
        .string({ required_error: 'Selecione o grupo muscular', invalid_type_error: 'Grupo muscular inválido' })
        .trim()
        .min(1, 'Selecione o grupo muscular')
        .max(60, 'Grupo muscular: use no máximo 60 caracteres'),
    equipment: z.string().trim().max(80, 'Equipamento: use no máximo 80 caracteres').nullish(),
    difficulty: z.enum(DIFFICULTIES, { errorMap: () => ({ message: 'Dificuldade inválida' }) }).optional(),
    videoUrl: optionalUrl('URL do vídeo'),
    thumbnailUrl: optionalUrl('URL da imagem'),
    instructions: z.string().max(4000, 'Instruções: use no máximo 4000 caracteres').nullish(),
    tips: z.string().max(4000, 'Dicas: use no máximo 4000 caracteres').nullish(),
});

export const exerciseUpdateSchema = exerciseCreateSchema.partial();

export const DUPLICATE_EXERCISE_NAME =
    'Já existe um exercício com este nome. Use outro nome ou procure o existente na biblioteca.';

/** Compara nomes ignorando maiúsculas e acentos, considerando exercícios globais e do próprio personal. */
export async function isExerciseNameTaken(
    db: { exercise: Pick<Prisma.TransactionClient['exercise'], 'findMany'> },
    name: string,
    exceptId?: string,
    personalId?: string | null
) {
    const target = normalizeText(name);
    const exercises = await db.exercise.findMany({
        where: {
            OR: personalId ? [{ personalId: null }, { personalId }] : [{ personalId: null }],
        },
        select: { id: true, name: true },
    });
    return exercises.some((exercise) => exercise.id !== exceptId && normalizeText(exercise.name) === target);
}

export type PlanDayInput = z.infer<typeof planDayInputSchema>;
export type PlanItemInput = z.infer<typeof planItemInputSchema>;

const FIELD_LABELS: Record<string, string> = {
    title: 'o título',
    studentId: 'o aluno',
    startDate: 'a data de início',
    endDate: 'a data de término',
    workoutDays: 'os dias de treino',
    templateDays: 'os dias do modelo',
    name: 'o nome',
    dayOfWeek: 'o dia da semana',
    items: 'os exercícios',
    exerciseId: 'o exercício',
    sets: 'as séries',
    reps: 'as repetições',
    rest: 'o descanso',
    restBySet: 'o descanso por série',
    load: 'a carga',
    rpe: 'o RPE',
    groupId: 'o agrupamento (bi-set)',
    notes: 'as observações',
    active: 'o status',
    muscleGroup: 'o grupo muscular',
    equipment: 'o equipamento',
    difficulty: 'a dificuldade',
    videoUrl: 'a URL do vídeo',
    thumbnailUrl: 'a URL da imagem',
    instructions: 'as instruções',
    tips: 'as dicas',
};

function isEnglishZodMessage(message: string) {
    return /^(Required|Expected|Invalid|String must|Number must|Array must)/.test(message);
}

/**
 * Turns the first zod issue into a pt-BR sentence that says where the problem is,
 * e.g. "Treino B · exercício 3: Informe as repetições".
 */
export function formatValidationError(error: z.ZodError, body?: unknown): string {
    const issue = error.issues[0];
    if (!issue) return 'Dados inválidos';
    const path = issue.path;
    const field = String(path[path.length - 1] ?? '');
    let message = issue.message;
    if (isEnglishZodMessage(message)) {
        const label = FIELD_LABELS[field] ?? 'um campo';
        message = issue.code === 'invalid_type' && issue.received === 'undefined' ? `Informe ${label}` : `Valor inválido para ${label}`;
    }

    const daysKey = path[0] === 'workoutDays' || path[0] === 'templateDays' ? path[0] : null;
    if (daysKey && typeof path[1] === 'number') {
        const dayIndex = path[1];
        const rawDays = (body as Record<string, unknown> | undefined)?.[daysKey];
        const rawName = Array.isArray(rawDays) ? (rawDays[dayIndex] as { name?: unknown } | undefined)?.name : undefined;
        const dayLabel = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : `Dia ${dayIndex + 1}`;
        if (path[2] === 'items' && typeof path[3] === 'number') {
            return `${dayLabel} · exercício ${path[3] + 1}: ${message}`;
        }
        return `${dayLabel}: ${message}`;
    }
    return message;
}

export function validationErrorResponse(error: z.ZodError, body?: unknown) {
    return NextResponse.json({ success: false, error: formatValidationError(error, body) }, { status: 400 });
}

/** Known Prisma errors → pt-BR responses; null when the error is unexpected. */
export function prismaErrorResponse(error: unknown) {
    const code = (error as { code?: string } | null)?.code;
    if (code === 'P2003') {
        return NextResponse.json(
            { success: false, error: 'Um ou mais exercícios não existem mais na biblioteca. Atualize a página e tente novamente.' },
            { status: 400 }
        );
    }
    if (code === 'P2025') {
        return NextResponse.json({ success: false, error: 'Registro não encontrado' }, { status: 404 });
    }
    return null;
}

// ---------------------------------------------------------------------------
// Prisma helpers
// ---------------------------------------------------------------------------

/** Relations returned by plan detail endpoints (GET/PUT by id, POST). */
export const planDetailInclude = {
    student: {
        include: {
            user: { select: { name: true, email: true } },
        },
    },
    workoutDays: {
        orderBy: { order: 'asc' },
        include: {
            items: {
                orderBy: { order: 'asc' },
                include: { exercise: true },
            },
        },
    },
} satisfies Prisma.WorkoutPlanInclude;

export const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/** Keeps "one active plan per student": deactivates every other active plan of the student. */
export async function deactivateOtherActivePlans(tx: Prisma.TransactionClient, studentId: string, keepPlanId?: string) {
    await tx.workoutPlan.updateMany({
        where: { studentId, active: true, ...(keepPlanId ? { id: { not: keepPlanId } } : {}) },
        data: { active: false },
    });
}

function itemData(item: PlanItemInput, order: number) {
    return {
        exerciseId: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        rest: item.rest,
        restBySet: item.restBySet ?? null,
        load: item.load ?? null,
        rpe: item.rpe ?? null,
        groupId: item.groupId ?? null,
        notes: item.notes ?? '',
        order,
    };
}

/** Nested `create` input for new plans (ids in the payload are ignored). */
export function buildDaysCreateInput(days: PlanDayInput[]) {
    return days.map((day, dayIndex) => ({
        name: day.name,
        dayOfWeek: day.dayOfWeek,
        order: dayIndex,
        items: { create: day.items.map((item, itemIndex) => itemData(item, itemIndex)) },
    }));
}

/** Nested `create` input for template days (templates have no rest-by-set column). */
export function buildTemplateDaysCreateInput(days: PlanDayInput[]) {
    return days.map((day, dayIndex) => ({
        name: day.name,
        dayOfWeek: day.dayOfWeek,
        order: dayIndex,
        items: {
            create: day.items.map((item, itemIndex) => {
                const { restBySet: _restBySet, ...data } = itemData(item, itemIndex);
                return data;
            }),
        },
    }));
}

/**
 * Applies the edited days to a plan WITHOUT recreating the days that still exist, so
 * completions, set logs and sessions (which reference WorkoutDay.id) keep working.
 *
 * Matching:
 * - Web editor payloads carry `id` (null for new rows): days/items are matched by id only.
 * - Payloads without any id (iOS app): days match by exact name, then by position;
 *   items match by exercise within the same day.
 * Matched rows are updated in place (only when something changed), new rows are created
 * and only the rows that disappeared are deleted.
 */
export async function syncPlanDays(tx: Prisma.TransactionClient, planId: string, incoming: PlanDayInput[]) {
    const existingDays = await tx.workoutDay.findMany({
        where: { planId },
        orderBy: { order: 'asc' },
        include: { items: { orderBy: { order: 'asc' } } },
    });

    const usesIds = incoming.some((day) => day.id !== undefined || day.items.some((item) => item.id !== undefined));
    const unmatchedDayIds = new Set(existingDays.map((day) => day.id));
    const matches: Array<(typeof existingDays)[number] | null> = incoming.map(() => null);

    const take = (index: number, day: (typeof existingDays)[number] | undefined) => {
        if (!day) return;
        matches[index] = day;
        unmatchedDayIds.delete(day.id);
    };

    if (usesIds) {
        incoming.forEach((day, index) => {
            if (day.id && unmatchedDayIds.has(day.id)) take(index, existingDays.find((existing) => existing.id === day.id));
        });
    } else {
        // Name match, preferring the same weekday when several days share a name.
        incoming.forEach((day, index) => {
            const candidates = existingDays.filter((existing) => unmatchedDayIds.has(existing.id) && existing.name === day.name);
            take(index, candidates.find((existing) => existing.dayOfWeek === day.dayOfWeek) ?? candidates[0]);
        });
        // Position fallback only for the day at the same position and weekday; anything else is a new day,
        // so a deleted day's history (completions, set logs) is never attached to a different workout.
        incoming.forEach((day, index) => {
            if (matches[index]) return;
            const samePosition = existingDays[index];
            if (samePosition && unmatchedDayIds.has(samePosition.id) && samePosition.dayOfWeek === day.dayOfWeek) {
                take(index, samePosition);
            }
        });
    }

    const existingItems = new Map(existingDays.flatMap((day) => day.items.map((item) => [item.id, item] as const)));
    const keptItemIds = new Set<string>();

    for (let dayIndex = 0; dayIndex < incoming.length; dayIndex++) {
        const day = incoming[dayIndex];
        const match = matches[dayIndex];
        let dayId: string;

        if (match) {
            dayId = match.id;
            if (match.name !== day.name || match.dayOfWeek !== day.dayOfWeek || match.order !== dayIndex) {
                await tx.workoutDay.update({
                    where: { id: dayId },
                    data: { name: day.name, dayOfWeek: day.dayOfWeek, order: dayIndex },
                });
            }
        } else {
            const created = await tx.workoutDay.create({
                data: { planId, name: day.name, dayOfWeek: day.dayOfWeek, order: dayIndex },
                select: { id: true },
            });
            dayId = created.id;
        }

        const toCreate: Array<ReturnType<typeof itemData> & { workoutDayId: string }> = [];
        for (let itemIndex = 0; itemIndex < day.items.length; itemIndex++) {
            const item = day.items[itemIndex];
            let existing: (typeof existingDays)[number]['items'][number] | undefined;

            if (usesIds) {
                if (item.id && !keptItemIds.has(item.id)) existing = existingItems.get(item.id);
            } else if (match) {
                existing = match.items.find(
                    (candidate) => !keptItemIds.has(candidate.id) && candidate.exerciseId === item.exerciseId
                );
            }

            const data = { ...itemData(item, itemIndex), workoutDayId: dayId };
            if (!existing) {
                toCreate.push(data);
                continue;
            }

            keptItemIds.add(existing.id);
            // Older app versions don't send load/rpe: keep the stored prescription instead of wiping it.
            const updateData: Partial<typeof data> = { ...data };
            if (item.load === undefined) delete updateData.load;
            if (item.rpe === undefined) delete updateData.rpe;
            if (item.groupId === undefined) delete updateData.groupId;
            const changed =
                existing.workoutDayId !== data.workoutDayId ||
                existing.exerciseId !== data.exerciseId ||
                existing.sets !== data.sets ||
                existing.reps !== data.reps ||
                existing.rest !== data.rest ||
                (existing.restBySet ?? null) !== data.restBySet ||
                (item.load !== undefined && (existing.load ?? null) !== data.load) ||
                (item.rpe !== undefined && (existing.rpe ?? null) !== data.rpe) ||
                (item.groupId !== undefined && (existing.groupId ?? null) !== data.groupId) ||
                (existing.notes ?? '') !== data.notes ||
                existing.order !== data.order;
            if (changed) {
                await tx.workoutItem.update({ where: { id: existing.id }, data: updateData });
            }
        }

        if (toCreate.length) {
            await tx.workoutItem.createMany({ data: toCreate });
        }

        // Groups kept from a save that didn't send them may no longer be valid (items moved, sets changed):
        // ungroup those instead of rejecting the save.
        if (day.items.some((item) => item.groupId === undefined)) {
            const saved = await tx.workoutItem.findMany({
                where: { workoutDayId: dayId },
                orderBy: { order: 'asc' },
                select: { id: true, sets: true, groupId: true },
            });
            const repaired = normalizedGroupIds(saved, { repairInvalid: true });
            const toUngroup = saved.filter((row, index) => (row.groupId ?? null) !== repaired[index]).map((row) => row.id);
            if (toUngroup.length) {
                await tx.workoutItem.updateMany({ where: { id: { in: toUngroup } }, data: { groupId: null } });
            }
        }
    }

    const removedItemIds = Array.from(existingItems.keys()).filter((id) => !keptItemIds.has(id));
    if (removedItemIds.length) {
        await tx.workoutItem.deleteMany({ where: { id: { in: removedItemIds } } });
    }
    if (unmatchedDayIds.size) {
        await tx.workoutDay.deleteMany({ where: { planId, id: { in: Array.from(unmatchedDayIds) } } });
    }
}

type SessionUser = { id?: string; role?: string; personalId?: string; studentId?: string } | undefined;

/** Personals may access plans they created or plans of their students; students only their own. */
export function canAccessPlan(
    user: SessionUser,
    plan: { personalId: string; studentId: string; student?: { personalId: string } | null }
): boolean {
    if (!user) return false;
    if (user.role === 'PERSONAL') {
        return Boolean(user.personalId) && (plan.personalId === user.personalId || plan.student?.personalId === user.personalId);
    }
    if (user.role === 'STUDENT') {
        return Boolean(user.studentId) && plan.studentId === user.studentId;
    }
    return false;
}
