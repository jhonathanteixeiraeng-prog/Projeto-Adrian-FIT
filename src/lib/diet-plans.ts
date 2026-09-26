/**
 * Regras compartilhadas pelos endpoints de planos alimentares e modelos (somente servidor).
 *
 * - Um aluno tem no máximo uma dieta ativa: todo caminho de criação/ativação usa
 *   `createDietPlanForStudent` / `deactivateOtherDietPlans` dentro de uma transação.
 * - Alimentos são gravados no formato canônico do `diet-normalizer` (lido pelo app do aluno e pelo iOS),
 *   preservando observações (`notes`) e substituições (`substitutionNote`).
 */
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { normalizeDietFood, withUnambiguousQuantity, type NormalizedDietFood } from '@/lib/diet-normalizer';
import { notifyStudentAboutPlan } from '@/lib/plan-notifications';
import { lockStudentForActivation } from '@/lib/student-lock';

export const DEFAULT_PLAN_DURATION_DAYS = 30;

const numberLike = z.union([z.number(), z.string()]).optional().nullable();
const optionalText = (max: number) => z.string().max(max).optional().nullable();

/** Alimento enviado pelos editores (web e iOS). Chaves legadas desconhecidas são ignoradas. */
export const dietFoodInputSchema = z.object({
    foodId: z.string().optional().nullable(),
    // Nome vazio é aceito (o normalizador grava "Alimento"), como antes.
    name: z.string().max(300).optional().nullable(),
    portion: optionalText(200),
    quantity: numberLike,
    calories: numberLike,
    protein: numberLike,
    carbs: numberLike,
    fat: numberLike,
    notes: optionalText(5000),
    substitutionNote: optionalText(5000),
    substitutionText: optionalText(5000),
    displayUnit: optionalText(20),
    source: optionalText(30),
});

/** Refeição enviada pelos editores. Aceita `items` (web/iOS create) ou `foods` (PUT). */
export const dietMealInputSchema = z.object({
    id: z.string().optional().nullable(),
    name: z.string().max(300).optional().nullable(),
    time: z.string().max(20).optional().nullable(),
    notes: optionalText(5000),
    items: z.array(dietFoodInputSchema).optional(),
    foods: z.array(dietFoodInputSchema).optional(),
});

export type DietMealInput = z.infer<typeof dietMealInputSchema>;

const targetValue = z.union([z.number(), z.string()]).optional().nullable();

/** Corpo de criação/edição de modelos. Metas opcionais: sem elas, vale a soma dos alimentos. */
export const dietTemplateSchema = z.object({
    title: z.string().trim().min(1, 'Título é obrigatório').max(300),
    calories: targetValue,
    protein: targetValue,
    carbs: targetValue,
    fat: targetValue,
    meals: z.array(dietMealInputSchema),
});

export interface PreparedMeal {
    /** Id da refeição existente (atualização no lugar); ausente para refeições novas. */
    id?: string;
    name: string;
    time: string;
    notes: string | null;
    order: number;
    foods: string;
}

export interface MacroTotals {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export function normalizeFoodForStorage(raw: unknown): NormalizedDietFood {
    const normalized = normalizeDietFood(raw);
    return withUnambiguousQuantity(normalized);
}

/** Normaliza os alimentos, serializa o JSON gravado em DietMeal.foods e soma os macros. */
export function prepareMeals(meals: DietMealInput[] | undefined | null): { meals: PreparedMeal[]; totals: MacroTotals } {
    const totals: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const prepared = (meals ?? []).map((meal, index) => {
        const foods = (meal.items ?? meal.foods ?? []).map((food) => normalizeFoodForStorage(food));
        foods.forEach((food) => {
            totals.calories += food.totalCalories;
            totals.protein += food.totalProtein;
            totals.carbs += food.totalCarbs;
            totals.fat += food.totalFat;
        });
        return {
            id: meal.id || undefined,
            name: meal.name?.trim() || `Refeição ${index + 1}`,
            time: meal.time?.trim() || '12:00',
            notes: meal.notes?.trim() || null,
            order: index,
            foods: JSON.stringify(foods),
        };
    });
    return { meals: prepared, totals };
}

/** Converte kcal/macros recebidos (número ou texto) em inteiro positivo, ou null. */
export function toPositiveInt(value: unknown): number | null {
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.round(parsed);
}

/**
 * Datas "AAAA-MM-DD" são gravadas ao meio-dia UTC para aparecerem no mesmo dia do calendário
 * em qualquer fuso do Brasil (meia-noite UTC virava o dia anterior no app).
 */
export function parseDateInput(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value !== 'string' || !value.trim()) return null;
    const trimmed = value.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T12:00:00.000Z`) : new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function defaultPlanDates(reference = new Date()) {
    const startDate = new Date(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate(), 12));
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + DEFAULT_PLAN_DURATION_DAYS);
    return { startDate, endDate };
}

export function safeParseFoods(json: string | null | undefined): unknown[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { foods?: unknown }).foods)) {
            return (parsed as { foods: unknown[] }).foods;
        }
    } catch {
        // JSON inválido: tratamos como refeição sem alimentos em vez de derrubar a listagem.
    }
    return [];
}

export function findOwnedStudent(studentId: string, personalId: string) {
    return prisma.student.findFirst({
        where: { id: studentId, personalId },
        select: { id: true },
    });
}

type TransactionClient = Prisma.TransactionClient;

/**
 * Mantém "uma dieta ativa por aluno". Chame no início da transação que ativa o plano
 * (trava o aluno, ver `lockStudentForActivation`).
 */
export async function deactivateOtherDietPlans(tx: TransactionClient, studentId: string, exceptPlanId?: string) {
    await lockStudentForActivation(tx, studentId);
    return tx.dietPlan.updateMany({
        where: {
            studentId,
            active: true,
            ...(exceptPlanId ? { id: { not: exceptPlanId } } : {}),
        },
        data: { active: false },
    });
}

const createdPlanInclude = {
    meals: { orderBy: { order: 'asc' } },
    student: { include: { user: { select: { name: true } } } },
} satisfies Prisma.DietPlanInclude;

export interface CreateDietPlanInput {
    personalId: string;
    studentId: string;
    title: string;
    startDate: Date | null;
    endDate: Date | null;
    active: boolean;
    notifyStudent?: boolean;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    meals: PreparedMeal[];
}

/**
 * Único caminho de criação de planos: quando o plano nasce ativo, os demais planos ativos
 * do aluno são desativados na mesma transação (o app do aluno mostra apenas uma dieta).
 */
export async function createDietPlanForStudent(input: CreateDietPlanInput) {
    const created = await prisma.$transaction(async (tx) => {
        if (input.active) {
            await deactivateOtherDietPlans(tx, input.studentId);
        }
        return tx.dietPlan.create({
            data: {
                title: input.title,
                studentId: input.studentId,
                personalId: input.personalId,
                startDate: input.startDate,
                endDate: input.endDate,
                active: input.active,
                version: 1,
                calories: input.calories,
                protein: input.protein,
                carbs: input.carbs,
                fat: input.fat,
                meals: input.meals.length > 0
                    ? {
                        create: input.meals.map((meal) => ({
                            name: meal.name,
                            time: meal.time,
                            notes: meal.notes,
                            order: meal.order,
                            foods: meal.foods,
                        })),
                    }
                    : undefined,
            },
            include: createdPlanInclude,
        });
    });

    if (input.active && input.notifyStudent) {
        await notifyStudentAboutPlan({
            studentId: input.studentId,
            kind: 'diet',
            title: input.title,
        });
    }

    return created;
}

/** Plano completo para edição (mesmo formato de GET /api/diets/[id]). */
export async function getDietPlanForPersonal(planId: string, personalId: string) {
    const plan = await prisma.dietPlan.findFirst({
        where: { id: planId, student: { personalId } },
        include: {
            student: {
                include: {
                    user: { select: { name: true, email: true, avatar: true } },
                    anamnesis: true,
                },
            },
            meals: { orderBy: { order: 'asc' } },
        },
    });
    if (!plan) return null;
    return {
        ...plan,
        meals: plan.meals.map((meal) => ({
            ...meal,
            foods: safeParseFoods(meal.foods).map(normalizeDietFood),
        })),
    };
}

export function formatTemplate<T extends { meals: Array<{ foods: string }> }>(template: T) {
    return {
        ...template,
        meals: template.meals.map((meal) => ({
            ...meal,
            items: safeParseFoods(meal.foods).map(normalizeDietFood),
        })),
    };
}

/**
 * Dados do editor de dieta da ficha do aluno: perfil nutricional, histórico de planos e,
 * opcionalmente, o plano pedido (ou o ativo) já normalizado.
 */
export async function getStudentDietEditorView(
    studentId: string,
    personalId: string,
    options: { planId?: string | null; active?: boolean } = {}
) {
    const [student, plans] = await Promise.all([
        prisma.student.findFirst({
            where: { id: studentId, personalId },
            include: {
                user: { select: { name: true, email: true, avatar: true } },
                anamnesis: { select: { activityLevel: true, restrictions: true } },
            },
        }),
        prisma.dietPlan.findMany({
            where: { studentId, student: { personalId } },
            select: {
                id: true,
                title: true,
                active: true,
                startDate: true,
                endDate: true,
                calories: true,
                protein: true,
                carbs: true,
                fat: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { meals: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    const planId = options.planId || (options.active ? plans.find((plan) => plan.active)?.id : undefined);
    const plan = planId ? await getDietPlanForPersonal(planId, personalId) : null;
    const planBelongsToStudent = Boolean(plan && plan.studentId === studentId);

    return {
        student: student
            ? {
                id: student.id,
                name: student.user.name,
                email: student.user.email,
                avatar: student.user.avatar,
                birthDate: student.birthDate,
                gender: student.gender,
                height: student.height,
                weight: student.weight,
                goal: student.goal,
                activityLevel: student.anamnesis?.activityLevel ?? null,
                restrictions: student.anamnesis?.restrictions ?? null,
            }
            : null,
        plans: plans.map(({ _count, ...summary }) => ({ ...summary, mealCount: _count.meals })),
        // Um planId de outro aluno é ignorado (o editor avisa e abre a dieta ativa).
        plan: planBelongsToStudent ? plan : null,
        requestedPlanMissing: Boolean(options.planId) && !planBelongsToStudent,
    };
}

export interface DietPlanUpdate {
    title?: string;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    active?: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
    /** undefined = não altera as refeições. */
    meals?: PreparedMeal[];
}

/**
 * Atualiza um plano numa transação. Refeições enviadas com id existente são atualizadas no lugar
 * (preservando as marcações de "refeição feita" do aluno); as demais são criadas e as ausentes removidas.
 * Ativar o plano desativa os outros planos ativos do aluno.
 */
export function updateDietPlan(planId: string, studentId: string, update: DietPlanUpdate) {
    return prisma.$transaction(async (tx) => {
        if (update.active === true) {
            await deactivateOtherDietPlans(tx, studentId, planId);
        }

        if (update.meals) {
            const existingMeals = await tx.dietMeal.findMany({
                where: { dietPlanId: planId },
                select: { id: true },
            });
            const existingIds = new Set(existingMeals.map((meal) => meal.id));
            const keptIds = new Set<string>();

            for (const meal of update.meals) {
                const values = {
                    name: meal.name,
                    time: meal.time,
                    notes: meal.notes,
                    order: meal.order,
                    foods: meal.foods,
                };
                if (meal.id && existingIds.has(meal.id) && !keptIds.has(meal.id)) {
                    keptIds.add(meal.id);
                    await tx.dietMeal.update({ where: { id: meal.id }, data: values });
                } else {
                    await tx.dietMeal.create({ data: { ...values, dietPlanId: planId } });
                }
            }

            const removedIds = Array.from(existingIds).filter((id) => !keptIds.has(id));
            if (removedIds.length > 0) {
                await tx.dietMeal.deleteMany({ where: { id: { in: removedIds } } });
            }
        }

        return tx.dietPlan.update({
            where: { id: planId },
            data: {
                title: update.title,
                calories: update.calories,
                protein: update.protein,
                carbs: update.carbs,
                fat: update.fat,
                active: update.active,
                startDate: update.startDate,
                endDate: update.endDate,
            },
            include: {
                meals: { orderBy: { order: 'asc' } },
            },
        });
    });
}
