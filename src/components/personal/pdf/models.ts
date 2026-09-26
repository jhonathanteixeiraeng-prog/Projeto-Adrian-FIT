import { describeFoodAmount } from '@/components/personal/diet-editor/units';
import { firstName, formatDate } from '@/components/personal/students/lib';
import { normalizeDietFood } from '@/lib/diet-normalizer';
import { formatRest, formatReps, formatSubstitution } from '@/lib/plan-format';
import { getDayOfWeekName } from '@/lib/utils';
import { describeGroups } from '@/lib/workout-groups';
import { formatLoad, formatRpe } from '@/lib/workout-load';

/**
 * What goes into the workout and diet PDFs the trainer sends to students over WhatsApp.
 * Pure functions over the API responses (GET /api/workout-plans/:id, GET /api/diets/:id).
 */

export type PdfKind = 'workout' | 'diet';

export interface PdfIdentity {
    /** Brand on the document header ("Adrian Fit"). */
    brand: string;
    coach: string;
    coachPhone: string | null;
}

export interface PdfHeader {
    identity: PdfIdentity;
    /** "Ficha de treino" / "Plano alimentar". */
    documentTitle: string;
    planTitle: string;
    studentName: string;
    goal: string | null;
    /** "26/09/2026 a 25/11/2026"; null when the plan has no dates. */
    period: string | null;
    issuedAt: string;
}

// ---------------------------------------------------------------------------
// API shapes (only the fields the PDF reads)
// ---------------------------------------------------------------------------

interface ApiStudentRef {
    goal?: string | null;
    user?: { name?: string | null; phone?: string | null } | null;
}

export interface WorkoutPlanForPdf {
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    student?: ApiStudentRef | null;
    workoutDays: Array<{
        id: string;
        name: string;
        dayOfWeek: number;
        order?: number | null;
        items: Array<{
            id: string;
            sets: number;
            reps: string;
            rest: number;
            restBySet?: string | null;
            load?: string | null;
            rpe?: string | null;
            groupId?: string | null;
            notes?: string | null;
            order?: number | null;
            exercise?: { name?: string | null; muscleGroup?: string | null; videoUrl?: string | null } | null;
        }>;
    }>;
}

export interface DietPlanForPdf {
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    student?: ApiStudentRef | null;
    meals: Array<{ id: string; name: string; time?: string | null; notes?: string | null; order?: number | null; foods: unknown }>;
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export interface WorkoutPdfRow {
    key: string;
    /** Position in the day ("1", "2"…) or the superset tag ("A1", "A2"…). */
    tag: string;
    /** Superset color index; null when the exercise is on its own. */
    tone: number | null;
    /** "Bi-set A" on the first exercise of a group. */
    chip: string | null;
    name: string;
    details: string | null;
    videoUrl: string | null;
    sets: string;
    reps: string;
    load: string;
    rpe: string;
    rest: string;
    /** "após a volta" under the rest of a group's last exercise. */
    restNote: string | null;
}

export interface WorkoutPdfDay {
    key: string;
    weekday: string;
    name: string;
    summary: string;
    rows: WorkoutPdfRow[];
}

export interface WorkoutPdfModel {
    kind: 'workout';
    header: PdfHeader;
    summary: string;
    days: WorkoutPdfDay[];
    columns: { load: boolean; rpe: boolean };
    /** "Como ler" lines that apply to this plan (supersets, per-set values, RPE). */
    guide: string[];
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "26/09 a 25/11/2026" (the year once when both dates share it), "26/12/2026 a 25/01/2027". */
function periodText(start: string | null | undefined, end: string | null | undefined): string | null {
    if (!start && !end) return null;
    if (start && end) {
        const from = formatDate(start);
        const to = formatDate(end);
        const sameYear = from.slice(-4) === to.slice(-4);
        return `${sameYear ? from.slice(0, -5) : from} a ${to}`;
    }
    return start ? `A partir de ${formatDate(start)}` : `Até ${formatDate(end)}`;
}

function headerFor(
    kind: PdfKind,
    plan: { title: string; startDate?: string | null; endDate?: string | null; student?: ApiStudentRef | null },
    identity: PdfIdentity,
    now: Date
): PdfHeader {
    return {
        identity,
        documentTitle: kind === 'workout' ? 'Ficha de treino' : 'Plano alimentar',
        planTitle: plan.title.trim() || (kind === 'workout' ? 'Treino' : 'Dieta'),
        studentName: plan.student?.user?.name?.trim() || 'Aluno',
        goal: plan.student?.goal?.trim() || null,
        period: periodText(plan.startDate, plan.endDate),
        issuedAt: formatDate(now),
    };
}

export function buildWorkoutPdfModel(plan: WorkoutPlanForPdf, identity: PdfIdentity, now = new Date()): WorkoutPdfModel {
    const days = [...plan.workoutDays].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let hasGroups = false;
    let hasPerSet = false;
    let exerciseCount = 0;
    let setCount = 0;
    const columns = { load: false, rpe: false };

    const pdfDays = days.map<WorkoutPdfDay>((day) => {
        const items = [...day.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const groups = describeGroups(items.map((item) => ({ groupId: item.groupId, sets: item.sets })));
        const daySets = items.reduce((sum, item) => sum + (item.sets || 0), 0);
        exerciseCount += items.length;
        setCount += daySets;

        const rows = items.map<WorkoutPdfRow>((item, index) => {
            const group = groups[index];
            const load = formatLoad(item.load);
            const rpe = formatRpe(item.rpe).replace(/^RPE\s*/, '');
            const reps = formatReps(item.reps);
            // No rest between the exercises of a round: only after the group's last one.
            const beforeRoundEnd = Boolean(group && !group.isLast);
            const rest = beforeRoundEnd ? '—' : formatRest(item);
            if (load) columns.load = true;
            if (rpe) columns.rpe = true;
            if (group) hasGroups = true;
            if ([reps, load, rest].some((text) => text.includes('/'))) hasPerSet = true;

            const muscleGroup = item.exercise?.muscleGroup?.trim();
            const notes = item.notes?.trim();
            return {
                key: item.id,
                tag: group ? `${group.letter}${group.position}` : String(index + 1),
                tone: group ? (group.letter.charCodeAt(0) - 65) % 5 : null,
                chip: group?.isFirst ? `${group.label} ${group.letter}` : null,
                name: item.exercise?.name?.trim() || 'Exercício',
                details: [muscleGroup, notes].filter(Boolean).join(' · ') || null,
                videoUrl: item.exercise?.videoUrl?.trim() || null,
                sets: String(item.sets || '—'),
                reps,
                load: load || '—',
                rpe: rpe || '—',
                rest,
                restNote: group && group.isLast ? 'após a volta' : null,
            };
        });

        return {
            key: day.id,
            weekday: getDayOfWeekName(day.dayOfWeek),
            name: day.name.trim() || 'Treino',
            summary: `${plural(items.length, 'exercício', 'exercícios')} · ${plural(daySets, 'série', 'séries')}`,
            rows,
        };
    });

    const guide: string[] = [];
    if (hasGroups) {
        guide.push(
            'Bi-set, tri-set e circuito: faça os exercícios do grupo em sequência (A1, A2…), sem descanso entre eles. Descanse só no fim de cada volta e repita pelo número de séries.'
        );
    }
    if (hasPerSet) guide.push('Valores separados por barra (ex.: 12/10/8) valem para cada série, na ordem.');
    if (columns.rpe) guide.push('RPE: esforço de 1 a 10. No RPE 8, ao terminar a série você ainda conseguiria fazer cerca de 2 repetições.');

    return {
        kind: 'workout',
        header: headerFor('workout', plan, identity, now),
        summary: `${plural(pdfDays.length, 'treino', 'treinos')} · ${plural(exerciseCount, 'exercício', 'exercícios')} · ${plural(setCount, 'série', 'séries')}`,
        days: pdfDays,
        columns,
        guide,
    };
}

// ---------------------------------------------------------------------------
// Diet
// ---------------------------------------------------------------------------

export interface DietPdfFood {
    key: string;
    name: string;
    amount: string;
    notes: string | null;
    substitution: string | null;
    calories: number;
}

export interface DietPdfMeal {
    key: string;
    time: string;
    name: string;
    calories: number;
    notes: string | null;
    foods: DietPdfFood[];
}

export interface DietPdfNutrition {
    /** "Meta diária" when the plan has targets, otherwise "Total do plano". */
    label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

export interface DietPdfModel {
    kind: 'diet';
    header: PdfHeader;
    meals: DietPdfMeal[];
    /** Null when the trainer exports without calories and macros. */
    nutrition: DietPdfNutrition | null;
    showCalories: boolean;
}

function parseFoods(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return [];
    try {
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

const positive = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null);

export function buildDietPdfModel(
    plan: DietPlanForPdf,
    identity: PdfIdentity,
    options: { showCalories: boolean },
    now = new Date()
): DietPdfModel {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const meals = [...plan.meals]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map<DietPdfMeal>((meal) => {
            const foods = parseFoods(meal.foods).map((raw, index) => {
                const food = normalizeDietFood(raw);
                totals.calories += food.totalCalories;
                totals.protein += food.totalProtein;
                totals.carbs += food.totalCarbs;
                totals.fat += food.totalFat;
                return {
                    key: `${meal.id}-${index}`,
                    name: food.name.trim() || 'Alimento',
                    amount: describeFoodAmount(food),
                    notes: food.notes?.trim() || null,
                    substitution: formatSubstitution(food.substitutionNote),
                    calories: food.totalCalories,
                };
            });
            return {
                key: meal.id,
                time: (meal.time ?? '').trim(),
                name: meal.name.trim() || 'Refeição',
                calories: foods.reduce((sum, food) => sum + food.calories, 0),
                notes: meal.notes?.trim() || null,
                foods,
            };
        });

    const hasTargets = [plan.calories, plan.protein, plan.carbs, plan.fat].some((value) => positive(value) !== null);
    const nutrition: DietPdfNutrition | null = options.showCalories
        ? {
              label: hasTargets ? 'Meta diária' : 'Total do plano',
              calories: Math.round(positive(plan.calories) ?? totals.calories),
              protein: Math.round(positive(plan.protein) ?? totals.protein),
              carbs: Math.round(positive(plan.carbs) ?? totals.carbs),
              fat: Math.round(positive(plan.fat) ?? totals.fat),
          }
        : null;

    return {
        kind: 'diet',
        header: headerFor('diet', plan, identity, now),
        meals,
        nutrition,
        showCalories: options.showCalories,
    };
}

// ---------------------------------------------------------------------------
// File name and WhatsApp message
// ---------------------------------------------------------------------------

/** "Treino - João Silva - Hipertrofia fase 1.pdf": what the student sees in the WhatsApp chat. */
export function pdfFileName(kind: PdfKind, studentName: string, planTitle: string): string {
    const clean = (text: string) =>
        text
            .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, ' ')
            .replace(/[—–]/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
    const parts = [kind === 'workout' ? 'Treino' : 'Dieta', clean(studentName), clean(planTitle)].filter(Boolean);
    const name = parts.join(' - ').slice(0, 120).trim();
    return `${name}.pdf`;
}

/** Pre-filled WhatsApp text; the trainer attaches the PDF and can edit it before sending. */
export function whatsappMessage(kind: PdfKind, header: PdfHeader): string {
    const hello = `Olá, ${firstName(header.studentName)}!`;
    const what = kind === 'workout' ? `Segue a sua ficha de treino "${header.planTitle}"` : `Segue o seu plano alimentar "${header.planTitle}"`;
    // "26/09 a 25/11/2026" → ", válida de 26/09 a 25/11" (only when the plan has both dates).
    const range = header.period && /^\d/.test(header.period) ? header.period.replace(/\/\d{4}/g, '') : null;
    const validity = range ? `, ${kind === 'workout' ? 'válida' : 'válido'} de ${range}` : '';
    return `${hello} ${what}${validity}. Qualquer dúvida, é só me chamar.`;
}
