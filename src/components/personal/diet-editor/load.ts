/** Carregamento dos dados do editor de dieta para cada tipo de rota. */
import { apiFetcher } from '@/hooks/use-api';
import {
    cloneMealsForNewPlan,
    dateInputFromDate,
    emptyState,
    estimateEnergy,
    mealsFromTemplate,
    planTotals,
    snapshotOf,
    stateFromPlan,
    suggestTargets,
    targetsFromValues,
    type EditorState,
    type MacroTotals,
    type StudentProfile,
} from './model';

export type DietEditorRoute =
    | { type: 'new-plan'; studentId?: string | null; templateId?: string | null; fromPlanId?: string | null }
    | { type: 'edit-plan'; planId: string }
    | { type: 'student'; studentId: string; planId?: string | null }
    | { type: 'new-template'; fromPlanId?: string | null }
    | { type: 'edit-template'; templateId: string };

export interface PlanSummary {
    id: string;
    title: string;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    calories: number | null;
    mealCount: number;
    createdAt: string;
}

export interface StudentContext {
    student: StudentProfile | null;
    plans: PlanSummary[];
    plan: any | null;
    requestedPlanMissing: boolean;
}

export interface Loaded {
    state: EditorState;
    planId: string | null;
    templateId: string | null;
    student: StudentProfile | null;
    plans: PlanSummary[];
    stored: MacroTotals | null;
    origin?: string | null;
    notice?: string | null;
    autoTargets?: boolean;
    focusId?: string | null;
    savedAt?: Date | null;
    /** Conteúdo já salvo (quando difere do estado entregue, ex.: edições feitas durante o salvamento). */
    baseline?: string;
    plansLoaded?: boolean;
    /** Plano antigo sem período: datas preenchidas a partir da criação (salvas no próximo salvamento). */
    datesSuggested?: boolean;
}

// Estado entregue à tela de edição logo após criar (evita recarregar e piscar a tela).
export const handoffs = new Map<string, Loaded>();

export function fetchStudentContext(studentId: string, query = '') {
    return apiFetcher<StudentContext>(`/api/students/${studentId}/diet-plans?view=editor${query}`);
}

function profileFromPlanStudent(student: any): StudentProfile | null {
    if (!student?.id) return null;
    return {
        id: student.id,
        name: student.user?.name ?? 'Aluno',
        email: student.user?.email ?? null,
        avatar: student.user?.avatar ?? null,
        birthDate: student.birthDate ?? null,
        gender: student.gender ?? null,
        height: student.height ?? null,
        weight: student.weight ?? null,
        goal: student.goal ?? null,
        activityLevel: student.anamnesis?.activityLevel ?? null,
        restrictions: student.anamnesis?.restrictions ?? null,
    };
}

function storedTotals(values: any): MacroTotals | null {
    const calories = Number(values?.calories);
    if (!(calories > 0)) return null;
    return {
        calories,
        protein: Number(values?.protein) || 0,
        carbs: Number(values?.carbs) || 0,
        fat: Number(values?.fat) || 0,
    };
}

function withPlanDates(plan: any): { state: EditorState; datesSuggested: boolean; baseline?: string } {
    const rawState = stateFromPlan(plan);
    if (rawState.startDate && rawState.endDate) return { state: rawState, datesSuggested: false };
    const created = plan?.createdAt ? new Date(plan.createdAt) : new Date();
    const start = rawState.startDate || dateInputFromDate(Number.isNaN(created.getTime()) ? new Date() : created);
    const end = new Date(`${start}T12:00:00`);
    end.setDate(end.getDate() + 30);
    return {
        state: { ...rawState, startDate: start, endDate: rawState.endDate || dateInputFromDate(end) },
        datesSuggested: true,
        baseline: snapshotOf(rawState, 'plan'),
    };
}

function withSuggestedTargets(state: EditorState, student: StudentProfile | null): { state: EditorState; auto: boolean } {
    const energy = estimateEnergy(student);
    if (!energy) return { state, auto: false };
    return { state: { ...state, targets: suggestTargets(energy.targetCalories, student?.weight, energy.goal) }, auto: true };
}

export async function loadRoute(route: DietEditorRoute): Promise<Loaded> {
    switch (route.type) {
        case 'edit-plan': {
            const plan = await apiFetcher<any>(`/api/diets/${route.planId}`);
            const { state, datesSuggested, baseline } = withPlanDates(plan);
            return {
                state,
                datesSuggested,
                planId: plan.id,
                templateId: null,
                student: profileFromPlanStudent(plan.student),
                plans: [],
                stored: storedTotals(plan),
                baseline,
            };
        }
        case 'student': {
            const context = await fetchStudentContext(route.studentId, route.planId ? `&planId=${encodeURIComponent(route.planId)}` : '&active=1');
            if (!context.student) throw new Error('Aluno não encontrado.');
            const notice = context.requestedPlanMissing ? 'O plano indicado no link não pertence a este aluno. Mostrando a dieta ativa.' : null;
            if (context.plan) {
                const { state, datesSuggested, baseline } = withPlanDates(context.plan);
                return {
                    state,
                    datesSuggested,
                    planId: context.plan.id,
                    templateId: null,
                    student: context.student,
                    plans: context.plans,
                    plansLoaded: true,
                    stored: storedTotals(context.plan),
                    notice,
                    baseline,
                };
            }
            if (context.requestedPlanMissing) {
                const active = context.plans.find((plan) => plan.active);
                if (active) return { ...(await loadRoute({ type: 'student', studentId: route.studentId, planId: active.id })), notice };
            }
            const base = { ...emptyState(), title: 'Plano alimentar', studentId: route.studentId };
            const suggested = withSuggestedTargets(base, context.student);
            return {
                state: suggested.state,
                planId: null,
                templateId: null,
                student: context.student,
                plans: context.plans,
                plansLoaded: true,
                stored: null,
                notice,
                autoTargets: suggested.auto,
            };
        }
        case 'new-plan':
        case 'new-template': {
            const isTemplate = route.type === 'new-template';
            let state: EditorState = { ...emptyState(), title: isTemplate ? '' : 'Plano alimentar' };
            let origin: string | null = null;
            let targetsFromSource = false;
            const studentId = route.type === 'new-plan' ? route.studentId : null;
            const templateId = route.type === 'new-plan' ? route.templateId : null;

            const [template, sourcePlan, context] = await Promise.all([
                templateId ? apiFetcher<any>(`/api/diet-templates/${templateId}`) : Promise.resolve(null),
                route.fromPlanId ? apiFetcher<any>(`/api/diets/${route.fromPlanId}`) : Promise.resolve(null),
                studentId ? fetchStudentContext(studentId) : Promise.resolve(null),
            ]);

            if (template) {
                const meals = mealsFromTemplate(template);
                // New plan from a template: keep the template's saved targets as they are. "Blank when equal to the
                // food sum" only applies when editing the same plan/template, otherwise the student's suggested
                // targets would replace them.
                state = { ...state, title: template.title ?? state.title, targets: targetsFromValues(template), meals: meals.length ? meals : state.meals };
                origin = `Baseado no modelo “${template.title}”. Ajuste o que precisar e salve para criar o plano.`;
                targetsFromSource = Object.values(state.targets).some(Boolean);
            } else if (sourcePlan) {
                const source = stateFromPlan(sourcePlan);
                const meals = cloneMealsForNewPlan(source.meals);
                state = { ...state, title: source.title, targets: targetsFromValues(sourcePlan), meals: meals.length ? meals : state.meals };
                origin = `Cópia de “${sourcePlan.title}”${sourcePlan.student?.user?.name ? ` (${sourcePlan.student.user.name})` : ''}. ${
                    isTemplate ? 'Salve para criar o modelo.' : studentId ? 'Revise e salve para criar o novo plano.' : 'Escolha o aluno e salve para criar o novo plano.'
                }`;
                targetsFromSource = Object.values(state.targets).some(Boolean);
            }

            let student: StudentProfile | null = null;
            let plans: PlanSummary[] = [];
            let autoTargets = false;
            if (!isTemplate && studentId && context?.student) {
                student = context.student;
                plans = context.plans;
                state = { ...state, studentId };
                if (!targetsFromSource) {
                    const suggested = withSuggestedTargets(state, student);
                    state = suggested.state;
                    autoTargets = suggested.auto;
                }
            }
            return { state, planId: null, templateId: null, student, plans, plansLoaded: Boolean(student), stored: null, origin, autoTargets };
        }
        case 'edit-template': {
            const template = await apiFetcher<any>(`/api/diet-templates/${route.templateId}`);
            const meals = mealsFromTemplate(template);
            return {
                state: {
                    ...emptyState(),
                    title: template.title ?? '',
                    targets: targetsFromValues(template, planTotals(meals)),
                    meals: meals.length ? meals : emptyState().meals,
                },
                planId: null,
                templateId: template.id,
                student: null,
                plans: [],
                stored: storedTotals(template),
            };
        }
    }
}

export async function sendJson(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false) {
        throw new Error((data && (data.error || data.message)) || `Erro ${response.status} ao salvar.`);
    }
    return data;
}
