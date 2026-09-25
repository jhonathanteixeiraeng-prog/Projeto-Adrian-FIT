'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    AlertTriangle,
    ArrowLeft,
    BookmarkPlus,
    Check,
    ChevronDown,
    Copy,
    FilePlus2,
    History,
    Info,
    Loader2,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Save,
    Sigma,
    Sparkles,
    Trash2,
    UserRound,
    Wand2,
    X,
} from 'lucide-react';
import { useDialogs, useToast } from '@/components/ui';
import { usePageMeta, type PageMeta } from '@/components/personal/page-meta';
import { rememberRecentStudent } from '@/components/personal/command-palette';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { isModalOpen, modKeyLabel, useHotkey } from '@/hooks/use-hotkey';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { cn } from '@/lib/utils';
import { NOTIFY_STUDENT_STORAGE_KEY } from '@/lib/notifications';
import { CustomFoodDialog } from './custom-food-dialog';
import type { MealRef } from './food-row';
import { GenerateDraftDialog, type DraftResult, type DraftSource } from './generate-dialog';
import { fetchStudentContext, handoffs, loadRoute, sendJson, type DietEditorRoute, type Loaded, type PlanSummary } from './load';
import { FloatingBar, MacroBar } from './macro-bar';
import { MealCard } from './meal-card';
import { DropdownMenu, type MenuEntry } from './menu';
import {
    createMeal,
    editorReducer,
    emptyState,
    estimateEnergy,
    foodFromSnapshot,
    foodKey,
    formatDateBR,
    newUid,
    planTotals,
    resolvedTargets,
    snapshotFromFood,
    snapshotOf,
    suggestTargets,
    targetsFromTotals,
    toApiMeals,
    validateState,
    type EditorFood,
    type EditorIssues,
    type EditorKind,
    type EditorState,
    type FoodSnapshot,
    type MacroKey,
    type StudentProfile,
} from './model';
import { PlanDetails } from './plan-details';
import type { StudentOption } from './student-picker';

export type { DietEditorRoute } from './load';

const EMPTY_SET = new Set<string>();
const RECENT_LIMIT = 12;
const FAVORITE_LIMIT = 40;
const DRIFT_THRESHOLD = 0.15;

function issueMessages(issues: EditorIssues) {
    const messages = [issues.title, issues.student, issues.startDate, issues.endDate, issues.meals].filter(Boolean) as string[];
    if (issues.foods.size > 0) {
        messages.push(`${issues.foods.size} ${issues.foods.size === 1 ? 'quantidade inválida' : 'quantidades inválidas'} (destacadas em vermelho).`);
    }
    return messages;
}

function focusById(id: string) {
    const element = id.startsWith('#')
        ? document.getElementById(id.slice(1))
        : document.querySelector<HTMLElement>(`[data-focus-id="${id}"]`);
    if (!element) return false;
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    return true;
}

/** Foco pedido enquanto um diálogo fecha: espera o diálogo liberar o foco (a trava do Radix ainda está ativa no mesmo ciclo). */
function focusAfterDialog(id: string) {
    window.setTimeout(() => focusById(id), 60);
}

function Notice({
    tone,
    icon: Icon,
    children,
    onDismiss,
}: {
    tone: 'info' | 'warning' | 'draft';
    icon: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    onDismiss?: () => void;
}) {
    return (
        <div
            role="status"
            className={cn(
                'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
                tone === 'warning' && 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
                tone === 'info' && 'border-border bg-muted/50 text-foreground',
                tone === 'draft' && 'border-violet-500/40 bg-violet-500/10 text-foreground'
            )}
        >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'warning' ? 'text-amber-500' : tone === 'draft' ? 'text-violet-500' : 'text-[#F88022]')} />
            <div className="min-w-0 flex-1 space-y-1.5">{children}</div>
            {onDismiss && (
                <button type="button" onClick={onDismiss} aria-label="Dispensar aviso" className="rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground">
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

export function DietPlanEditor({ route }: { route: DietEditorRoute }) {
    const kind: EditorKind = route.type === 'new-template' || route.type === 'edit-template' ? 'template' : 'plan';
    const router = useRouter();
    const { toast } = useToast();
    const { confirm, prompt } = useDialogs();

    const [state, dispatch] = useReducer(editorReducer, undefined, emptyState);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const [planId, setPlanId] = useState<string | null>(null);
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [student, setStudent] = useState<StudentProfile | null>(null);
    const [studentPlans, setStudentPlans] = useState<PlanSummary[]>([]);
    const [plansLoaded, setPlansLoaded] = useState(false);
    const [baseline, setBaseline] = useState('');
    const [savedTitle, setSavedTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [showErrors, setShowErrors] = useState(false);
    const [drift, setDrift] = useState<number | null>(null);
    const [draft, setDraft] = useState<{ source: DraftSource; warnings: string[] } | null>(null);
    const [origin, setOrigin] = useState<string | null>(null);
    const [datesSuggested, setDatesSuggested] = useState(false);
    const [generateMode, setGenerateMode] = useState<DraftSource | null>(null);
    const [customFood, setCustomFood] = useState<{ mealUid: string; name: string } | null>(null);

    const stateRef = useRef(state);
    stateRef.current = state;
    const statusRef = useRef(status);
    statusRef.current = status;
    const planIdRef = useRef<string | null>(null);
    const templateIdRef = useRef<string | null>(null);
    const baselineRef = useRef('');
    const savingRef = useRef(false);
    const pendingFocusRef = useRef<string | null>(null);
    const activeMealRef = useRef<string | null>(null);
    const autoTargetsRef = useRef(false);

    const lockedStudentId = route.type === 'student' ? route.studentId : null;
    const studentsApi = useApi<any[]>(route.type === 'new-plan' ? '/api/students' : null);

    // ------------------------------------------------------------------ carregamento

    const applyLoaded = useCallback(
        (loaded: Loaded) => {
            dispatch({ type: 'load', state: loaded.state });
            const snapshot = loaded.baseline ?? snapshotOf(loaded.state, kind);
            baselineRef.current = snapshot;
            setBaseline(snapshot);
            planIdRef.current = loaded.planId;
            templateIdRef.current = loaded.templateId;
            setPlanId(loaded.planId);
            setTemplateId(loaded.templateId);
            setStudent(loaded.student);
            setStudentPlans(loaded.plans);
            setPlansLoaded(Boolean(loaded.plansLoaded));
            setSavedTitle(loaded.state.title);
            setOrigin(loaded.origin ?? null);
            setDatesSuggested(Boolean(loaded.datesSuggested));
            setLastSavedAt(loaded.savedAt ?? null);
            setShowErrors(false);
            setDraft(null);
            autoTargetsRef.current = Boolean(loaded.autoTargets);
            const computed = planTotals(loaded.state.meals);
            const stored = loaded.stored;
            setDrift(
                stored && computed.calories > 0 && Math.abs(computed.calories - stored.calories) / stored.calories > DRIFT_THRESHOLD
                    ? Math.round((Math.abs(computed.calories - stored.calories) / stored.calories) * 100)
                    : null
            );
            if (loaded.notice) toast.warning('Plano não encontrado', loaded.notice);
            pendingFocusRef.current = loaded.focusId ?? null;
            setStatus('ready');
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [kind]
    );

    const routeKey = JSON.stringify(route);
    useEffect(() => {
        // Após criar um plano pela ficha do aluno, a URL ganha ?planId= do plano já carregado.
        if (route.type === 'student' && route.planId && route.planId === planIdRef.current && statusRef.current === 'ready') return;

        const handoffKey =
            route.type === 'edit-plan' ? `plan:${route.planId}` : route.type === 'edit-template' ? `template:${route.templateId}` : null;
        const handoff = handoffKey ? handoffs.get(handoffKey) : undefined;
        if (handoff && handoffKey) {
            handoffs.delete(handoffKey);
            applyLoaded(handoff);
            return;
        }

        let cancelled = false;
        setStatus('loading');
        setLoadError(null);
        loadRoute(route)
            .then((loaded) => {
                if (!cancelled) applyLoaded(loaded);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar.');
                setStatus('error');
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, reloadToken]);

    // Histórico de planos do aluno (para o menu) quando a tela abriu pelo id do plano.
    useEffect(() => {
        if (status !== 'ready' || kind !== 'plan' || !student?.id || plansLoaded) return;
        let cancelled = false;
        fetchStudentContext(student.id)
            .then((context) => {
                if (cancelled) return;
                setStudentPlans(context.plans);
                setPlansLoaded(true);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [status, kind, student?.id, plansLoaded]);

    useEffect(() => {
        if (student?.id && (route.type === 'edit-plan' || route.type === 'student' || route.type === 'new-plan')) {
            rememberRecentStudent(student.id);
        }
    }, [student?.id, route.type]);

    // ------------------------------------------------------------------ foco

    useLayoutEffect(() => {
        const focusId = pendingFocusRef.current;
        if (!focusId) return;
        pendingFocusRef.current = null;
        focusById(focusId);
    });

    const requestFocus = useCallback((focusId: string) => {
        pendingFocusRef.current = focusId;
    }, []);

    const focusSearch = useCallback(
        (mealUid: string) => {
            const meal = stateRef.current.meals.find((item) => item.uid === mealUid);
            if (meal?.collapsed) {
                dispatch({ type: 'updateMeal', mealUid, patch: { collapsed: false } });
                requestFocus(`${mealUid}:search`);
                return;
            }
            if (!focusById(`${mealUid}:search`)) requestFocus(`${mealUid}:search`);
        },
        [requestFocus]
    );

    // ------------------------------------------------------------------ derivados

    const snapshot = useMemo(() => snapshotOf(state, kind), [state, kind]);
    const isDirty = status === 'ready' && snapshot !== baseline;
    useUnsavedChangesGuard(isDirty);

    const totals = useMemo(() => planTotals(state.meals), [state.meals]);
    const issues = useMemo(() => validateState(state, kind), [state, kind]);
    const invalidFoods = showErrors ? issues.foods : EMPTY_SET;
    const energy = useMemo(() => estimateEnergy(student), [student]);
    const hasFoods = state.meals.some((meal) => meal.foods.length > 0);

    const mealRefsCache = useRef<{ key: string; refs: MealRef[] }>({ key: '', refs: [] });
    const mealRefsKey = state.meals.map((meal) => `${meal.uid}\u0001${meal.name}`).join('\u0002');
    if (mealRefsCache.current.key !== mealRefsKey) {
        mealRefsCache.current = { key: mealRefsKey, refs: state.meals.map((meal) => ({ uid: meal.uid, name: meal.name })) };
    }
    const mealRefs = mealRefsCache.current.refs;

    const { data: session } = useSession();
    const userId = session?.user?.id;
    const recentsKey = userId ? `personal:diet-editor:recent-foods:${userId}` : 'personal:diet-editor:recent-foods';
    const favoritesKey = userId ? `personal:diet-editor:favorite-foods:${userId}` : 'personal:diet-editor:favorite-foods';

    useEffect(() => {
        if (!userId || typeof window === 'undefined') return;
        try {
            const oldRecents = window.localStorage.getItem('personal:diet-editor:recent-foods');
            const newRecents = window.localStorage.getItem(`personal:diet-editor:recent-foods:${userId}`);
            if (oldRecents && !newRecents) {
                window.localStorage.setItem(`personal:diet-editor:recent-foods:${userId}`, oldRecents);
            }
            const oldFavs = window.localStorage.getItem('personal:diet-editor:favorite-foods');
            const newFavs = window.localStorage.getItem(`personal:diet-editor:favorite-foods:${userId}`);
            if (oldFavs && !newFavs) {
                window.localStorage.setItem(`personal:diet-editor:favorite-foods:${userId}`, oldFavs);
            }
            // The shared keys go to the first user who opens the editor; drop them so they don't leak to others.
            window.localStorage.removeItem('personal:diet-editor:recent-foods');
            window.localStorage.removeItem('personal:diet-editor:favorite-foods');
        } catch {
            // ignore
        }
    }, [userId]);

    const [recents, setRecents] = useLocalStorageState<FoodSnapshot[]>(recentsKey, []);
    const [favorites, setFavorites] = useLocalStorageState<FoodSnapshot[]>(favoritesKey, []);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);
    const favoriteKeys = useMemo(() => new Set(favorites.map(foodKey)), [favorites]);

    const studentOptions = useMemo<StudentOption[]>(
        () =>
            (studentsApi.data ?? []).map((item: any) => ({
                id: item.id,
                name: item.user?.name ?? 'Aluno',
                email: item.user?.email ?? null,
                avatar: item.user?.avatar ?? null,
                hint: item.dietPlans?.[0]?.title ? `Dieta ativa: ${item.dietPlans[0].title}` : null,
            })),
        [studentsApi.data]
    );

    const activeOtherPlan = kind === 'plan' ? studentPlans.find((plan) => plan.active && plan.id !== planId) : undefined;
    const studentId = state.studentId || lockedStudentId || '';
    const studentName = student?.name ?? studentOptions.find((option) => option.id === studentId)?.name ?? '';
    const firstName = studentName.split(' ')[0] || 'o aluno';

    // ------------------------------------------------------------------ meta da página

    const meta = useMemo<PageMeta>(() => {
        if (kind === 'template') {
            const label = templateId ? savedTitle || 'Modelo' : 'Novo modelo';
            return {
                title: `${label} · Modelo de dieta`,
                breadcrumbs: [{ label: 'Planos de dieta', href: '/personal/diets?tab=templates' }, { label }],
            };
        }
        if ((route.type === 'edit-plan' || route.type === 'student') && studentName) {
            return {
                title: `${studentName} · Dieta`,
                breadcrumbs: [
                    { label: 'Alunos', href: '/personal/students' },
                    { label: studentName, href: `/personal/students/${studentId}` },
                    { label: 'Plano alimentar' },
                ],
            };
        }
        return {
            title: studentName && !planId ? `${studentName} · Nova dieta` : planId ? 'Plano alimentar' : 'Nova dieta',
            breadcrumbs: [{ label: 'Planos de dieta', href: '/personal/diets' }, { label: planId ? 'Plano alimentar' : 'Nova dieta' }],
        };
    }, [kind, templateId, savedTitle, route.type, studentName, studentId, planId]);
    usePageMeta(meta);

    // ------------------------------------------------------------------ ações de alimentos e refeições

    const rememberFood = useCallback(
        (food: FoodSnapshot) => {
            setRecents((list) => [food, ...list.filter((item) => foodKey(item) !== foodKey(food))].slice(0, RECENT_LIMIT));
        },
        [setRecents]
    );

    const toggleFavorite = useCallback(
        (food: FoodSnapshot) => {
            setFavorites((list) =>
                list.some((item) => foodKey(item) === foodKey(food))
                    ? list.filter((item) => foodKey(item) !== foodKey(food))
                    : [food, ...list].slice(0, FAVORITE_LIMIT)
            );
        },
        [setFavorites]
    );

    const toggleFoodFavorite = useCallback((food: EditorFood) => toggleFavorite(snapshotFromFood(food)), [toggleFavorite]);

    const pickFood = useCallback(
        (mealUid: string, snapshot: FoodSnapshot, fromDialog = false) => {
            const food = foodFromSnapshot(snapshot);
            dispatch({ type: 'addFood', mealUid, food });
            rememberFood(snapshot);
            if (fromDialog) focusAfterDialog(`${food.uid}:amount`);
            else requestFocus(`${food.uid}:amount`);
        },
        [rememberFood, requestFocus]
    );

    const addMeal = useCallback(() => {
        const meal = createMeal(stateRef.current.meals);
        dispatch({ type: 'addMeal', meal });
        requestFocus(`${meal.uid}:search`);
    }, [requestFocus]);

    const onActivateMeal = useCallback((mealUid: string) => {
        activeMealRef.current = mealUid;
    }, []);

    const moveMeal = useCallback(
        (mealUid: string, delta: number, field: string) => {
            dispatch({ type: 'moveMeal', mealUid, delta });
            const focusField = field === 'time' || field === 'notes' || field === 'search' ? field : 'name';
            requestFocus(`${mealUid}:${focusField}`);
        },
        [requestFocus]
    );

    const duplicateMeal = useCallback(
        (mealUid: string) => {
            const copyUid = newUid('meal');
            dispatch({ type: 'duplicateMeal', mealUid, newUid: copyUid });
            requestFocus(`${copyUid}:name`);
        },
        [requestFocus]
    );

    const removeMeal = useCallback(
        async (mealUid: string) => {
            const meal = stateRef.current.meals.find((item) => item.uid === mealUid);
            if (!meal) return;
            if (meal.foods.length > 0 || meal.notes.trim()) {
                const ok = await confirm({
                    title: `Remover “${meal.name || 'refeição'}”?`,
                    description: `A refeição tem ${meal.foods.length} ${meal.foods.length === 1 ? 'alimento' : 'alimentos'}. A remoção só vale depois de salvar.`,
                    confirmText: 'Remover refeição',
                    variant: 'danger',
                });
                if (!ok) return;
            }
            dispatch({ type: 'removeMeal', mealUid });
        },
        [confirm]
    );

    const moveFood = useCallback(
        (mealUid: string, foodUid: string, delta: number, field: string) => {
            dispatch({ type: 'moveFood', mealUid, foodUid, delta });
            const focusField = ['amount', 'unit', 'notes', 'substitution'].includes(field) ? field : 'amount';
            requestFocus(`${foodUid}:${focusField}`);
        },
        [requestFocus]
    );

    const moveFoodToMeal = useCallback(
        (fromMealUid: string, foodUid: string, toMealUid: string) => {
            dispatch({ type: 'moveFoodToMeal', fromMealUid, foodUid, toMealUid });
            requestFocus(`${foodUid}:amount`);
        },
        [requestFocus]
    );

    const duplicateFood = useCallback(
        (mealUid: string, foodUid: string) => {
            const copyUid = newUid('food');
            dispatch({ type: 'duplicateFood', mealUid, foodUid, newUid: copyUid });
            requestFocus(`${copyUid}:amount`);
        },
        [requestFocus]
    );

    const removeFood = useCallback(
        (mealUid: string, foodUid: string) => {
            const meal = stateRef.current.meals.find((item) => item.uid === mealUid);
            const index = meal?.foods.findIndex((food) => food.uid === foodUid) ?? -1;
            const neighbor = meal && index >= 0 ? meal.foods[index + 1] ?? meal.foods[index - 1] : undefined;
            dispatch({ type: 'removeFood', mealUid, foodUid });
            requestFocus(neighbor ? `${neighbor.uid}:amount` : `${mealUid}:search`);
        },
        [requestFocus]
    );

    const openCustomFood = useCallback((mealUid: string, name: string) => setCustomFood({ mealUid, name }), []);

    // ------------------------------------------------------------------ aluno e metas

    const selectStudent = useCallback(
        async (id: string) => {
            dispatch({ type: 'set', patch: { studentId: id } });
            setStudent(null);
            setStudentPlans([]);
            setPlansLoaded(true);
            if (!id) return;
            try {
                const context = await fetchStudentContext(id);
                if (stateRef.current.studentId !== id) return;
                setStudent(context.student);
                setStudentPlans(context.plans);
                const targetsEmpty = Object.values(stateRef.current.targets).every((value) => !value.trim());
                if (context.student && (targetsEmpty || autoTargetsRef.current)) {
                    const estimate = estimateEnergy(context.student);
                    if (estimate) {
                        dispatch({ type: 'setTargets', targets: suggestTargets(estimate.targetCalories, context.student.weight, estimate.goal) });
                        autoTargetsRef.current = true;
                    }
                }
            } catch {
                // O perfil só alimenta as sugestões; sem ele o plano continua editável.
            }
        },
        []
    );

    const setTarget = (key: MacroKey, value: string) => {
        autoTargetsRef.current = false;
        dispatch({ type: 'setTarget', key, value });
    };

    const applySuggestedTargets = () => {
        if (!energy) return;
        dispatch({ type: 'setTargets', targets: suggestTargets(energy.targetCalories, student?.weight, energy.goal) });
        autoTargetsRef.current = false;
    };

    const applyCalculatedTotals = () => {
        dispatch({ type: 'setTargets', targets: targetsFromTotals(planTotals(stateRef.current.meals)) });
        autoTargetsRef.current = false;
        setDrift(null);
    };

    // ------------------------------------------------------------------ salvar

    const save = useCallback(async (): Promise<boolean> => {
        if (savingRef.current || statusRef.current !== 'ready') return false;
        const current = stateRef.current;
        const currentIssues = validateState(current, kind);
        if (currentIssues.count > 0) {
            setShowErrors(true);
            toast.warning('Revise antes de salvar', issueMessages(currentIssues).join(' '));
            if (currentIssues.title) focusById('#diet-editor-title');
            else if (currentIssues.student) focusById('#diet-editor-student');
            else if (currentIssues.startDate) focusById('#diet-editor-start');
            else if (currentIssues.endDate) focusById('#diet-editor-end');
            else {
                const invalid = current.meals.flatMap((meal) => meal.foods).find((food) => currentIssues.foods.has(food.uid));
                if (invalid) focusById(`${invalid.uid}:amount`);
                else if (current.meals[0]) focusSearch(current.meals[0].uid);
            }
            return false;
        }

        const currentSnapshot = snapshotOf(current, kind);
        const persistedId = kind === 'template' ? templateIdRef.current : planIdRef.current;
        if (persistedId && currentSnapshot === baselineRef.current) {
            toast.info('Nada novo para salvar', 'Todas as alterações já estão salvas.');
            return true;
        }

        savingRef.current = true;
        setSaving(true);
        const sentMealUids = current.meals.map((meal) => meal.uid);
        const focusedId = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focusId ?? null : null;
        try {
            const values = resolvedTargets(current.targets, planTotals(current.meals));
            let createdId: string | null = null;
            let responseMeals: Array<{ id: string }> = [];

            if (kind === 'template') {
                const id = templateIdRef.current;
                const result = await sendJson(id ? `/api/diet-templates/${id}` : '/api/diet-templates', id ? 'PUT' : 'POST', {
                    title: current.title.trim(),
                    ...values,
                    meals: toApiMeals(current.meals, 'items', false),
                });
                if (!id) createdId = result.data?.id ?? null;
            } else if (planIdRef.current) {
                const result = await sendJson(`/api/diets/${planIdRef.current}`, 'PUT', {
                    title: current.title.trim(),
                    active: current.active,
                    notifyStudent,
                    startDate: current.startDate,
                    endDate: current.endDate,
                    ...values,
                    meals: toApiMeals(current.meals, 'foods', true),
                });
                responseMeals = result.data?.meals ?? [];
            } else {
                const result = await sendJson('/api/diet-plans', 'POST', {
                    title: current.title.trim(),
                    studentId: current.studentId,
                    startDate: current.startDate,
                    endDate: current.endDate,
                    active: current.active,
                    notifyStudent,
                    targetCalories: values.calories,
                    targetProtein: values.protein,
                    targetCarbs: values.carbs,
                    targetFat: values.fat,
                    meals: toApiMeals(current.meals, 'items', false),
                });
                createdId = result.id ?? null;
                responseMeals = result.meals ?? [];
            }

            baselineRef.current = currentSnapshot;
            setBaseline(currentSnapshot);
            setSavedTitle(current.title.trim());
            const savedAt = new Date();
            setLastSavedAt(savedAt);
            setShowErrors(false);
            setDraft(null);
            setDrift(null);
            setOrigin(null);
            setDatesSuggested(false);
            const mealIds: Record<string, string> =
                kind === 'plan' && responseMeals.length === sentMealUids.length
                    ? Object.fromEntries(sentMealUids.map((uid, index) => [uid, responseMeals[index].id]))
                    : {};
            if (Object.keys(mealIds).length > 0) dispatch({ type: 'setMealIds', ids: mealIds });
            // Estado mais recente (inclui o que foi digitado durante o salvamento), já com os ids das refeições.
            const handoffState = (): EditorState => ({
                ...stateRef.current,
                meals: stateRef.current.meals.map((meal) => (mealIds[meal.uid] ? { ...meal, dbId: mealIds[meal.uid] } : meal)),
            });

            invalidateApi('/api/diets');
            invalidateApi('/api/diet-plans');
            invalidateApi('/api/diet-templates');
            if (kind === 'plan') invalidateApi('/api/students');

            if (kind === 'template') {
                toast.success(createdId ? 'Modelo criado' : 'Modelo salvo', 'Disponível na biblioteca de modelos.');
            } else {
                toast.success(
                    createdId ? 'Plano criado' : 'Plano salvo',
                    current.active ? `Já está no app de ${firstName}.` : 'Plano inativo: não aparece no app do aluno.'
                );
            }

            if (createdId) {
                if (kind === 'template') {
                    templateIdRef.current = createdId;
                    setTemplateId(createdId);
                    handoffs.set(`template:${createdId}`, {
                        state: handoffState(),
                        baseline: currentSnapshot,
                        planId: null,
                        templateId: createdId,
                        student: null,
                        plans: [],
                        stored: null,
                        focusId: focusedId,
                        savedAt,
                    });
                    router.replace(`/personal/diets/templates/${createdId}`);
                } else {
                    planIdRef.current = createdId;
                    setPlanId(createdId);
                    if (route.type === 'student') {
                        fetchStudentContext(route.studentId)
                            .then((context) => {
                                setStudentPlans(context.plans);
                                setPlansLoaded(true);
                            })
                            .catch(() => undefined);
                        if (!current.active) router.replace(`/personal/students/${route.studentId}/diet?planId=${createdId}`);
                    } else {
                        handoffs.set(`plan:${createdId}`, {
                            state: handoffState(),
                            baseline: currentSnapshot,
                            planId: createdId,
                            templateId: null,
                            student,
                            plans: [],
                            stored: null,
                            focusId: focusedId,
                            savedAt,
                        });
                        router.replace(`/personal/diets/${createdId}`);
                    }
                }
            } else {
                if (kind === 'plan' && current.active && studentPlans.some((plan) => plan.active && plan.id !== planIdRef.current)) {
                    setStudentPlans((plans) => plans.map((plan) => ({ ...plan, active: plan.id === planIdRef.current })));
                }
                // Sem ?planId=, a ficha do aluno abre a dieta ativa: um plano recém-desativado precisa do id na URL.
                if (route.type === 'student' && !current.active && !route.planId && planIdRef.current) {
                    router.replace(`/personal/students/${route.studentId}/diet?planId=${planIdRef.current}`);
                }
            }
            return true;
        } catch (error) {
            toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
            return false;
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, route, firstName, student, studentPlans, focusSearch]);

    useHotkey('mod+s', () => {
        if (isModalOpen()) return;
        void save();
    });

    useHotkey(
        '/',
        () => {
            const meals = stateRef.current.meals;
            if (meals.length === 0) {
                addMeal();
                return;
            }
            const active = meals.find((meal) => meal.uid === activeMealRef.current) ?? meals[meals.length - 1];
            focusSearch(active.uid);
        },
        { enabled: status === 'ready' }
    );

    const saveAsTemplate = async () => {
        const current = stateRef.current;
        if (!current.meals.some((meal) => meal.foods.length > 0)) {
            toast.warning('Adicione alimentos antes', 'O modelo precisa de pelo menos um alimento.');
            return;
        }
        if (validateState(current, kind).foods.size > 0) {
            setShowErrors(true);
            toast.warning('Revise as quantidades destacadas antes de criar o modelo.');
            return;
        }
        const name = await prompt({
            title: kind === 'template' ? 'Salvar como novo modelo' : 'Salvar como modelo',
            description: 'Cria um modelo na biblioteca com as refeições exatamente como estão nesta tela.',
            label: 'Nome do modelo',
            defaultValue: `${current.title.trim() || 'Plano alimentar'}${kind === 'template' ? ' (cópia)' : ' - Modelo'}`,
            confirmText: 'Criar modelo',
        });
        if (!name) return;

        try {
            const values = resolvedTargets(current.targets, planTotals(current.meals));
            await sendJson('/api/diet-templates', 'POST', { title: name, ...values, meals: toApiMeals(current.meals, 'items', false) });
            invalidateApi('/api/diet-templates');
            toast.success('Modelo criado', `“${name}” está na biblioteca de modelos.`);
        } catch (error) {
            toast.error('Não foi possível criar o modelo', error instanceof Error ? error.message : undefined);
        }
    };

    const deleteCurrent = async () => {
        const isTemplate = kind === 'template';
        const id = isTemplate ? templateIdRef.current : planIdRef.current;
        if (!id) return;
        const ok = await confirm({
            title: isTemplate ? 'Excluir este modelo?' : 'Excluir este plano alimentar?',
            description: isTemplate
                ? 'Planos já criados a partir dele não são afetados.'
                : `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)} deixa de ver esta dieta no app. Esta ação não pode ser desfeita.`,
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await sendJson(isTemplate ? `/api/diet-templates/${id}` : `/api/diets/${id}`, 'DELETE');
            baselineRef.current = snapshotOf(stateRef.current, kind);
            setBaseline(baselineRef.current);
            invalidateApi('/api/diets');
            invalidateApi('/api/diet-plans');
            invalidateApi('/api/diet-templates');
            invalidateApi('/api/students');
            toast.success(isTemplate ? 'Modelo excluído' : 'Plano excluído');
            router.push(isTemplate ? '/personal/diets?tab=templates' : studentId ? `/personal/students/${studentId}?tab=diet` : '/personal/diets');
        } catch (error) {
            toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
        }
    };

    const applyDraft = (result: DraftResult) => {
        dispatch({ type: 'replaceMeals', meals: result.meals, append: result.append });
        if (result.title && (!stateRef.current.title.trim() || stateRef.current.title === 'Plano alimentar')) {
            dispatch({ type: 'set', patch: { title: result.title } });
        }
        if (result.targets) {
            dispatch({ type: 'setTargets', targets: result.targets });
            autoTargetsRef.current = false;
        }
        setDraft({ source: result.source, warnings: result.warnings });
        setGenerateMode(null);
        setDrift(null);
        if (result.meals[0]) focusAfterDialog(`${result.meals[0].uid}:name`);
        toast.info('Rascunho pronto para revisão', 'Confira quantidades e substituições e salve quando estiver tudo certo.');
    };

    // ------------------------------------------------------------------ render

    if (status === 'loading') {
        return (
            <div className="space-y-4" aria-busy="true" aria-label="Carregando plano alimentar">
                <div className="h-14 w-72 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-2xl bg-muted" />
                <div className="h-32 animate-pulse rounded-2xl bg-muted" />
                <div className="h-48 animate-pulse rounded-2xl bg-muted" />
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-card p-8 text-center">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
                <div>
                    <h1 className="text-lg font-bold text-foreground">Não foi possível abrir</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                </div>
                <div className="flex justify-center gap-2">
                    <button
                        type="button"
                        onClick={() => setReloadToken((token) => token + 1)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </button>
                    <Link
                        href={kind === 'template' ? '/personal/diets?tab=templates' : lockedStudentId ? `/personal/students/${lockedStudentId}?tab=diet` : '/personal/diets'}
                        className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                        Voltar
                    </Link>
                </div>
            </div>
        );
    }

    const mod = modKeyLabel();
    const isNew = kind === 'template' ? !templateId : !planId;
    const backToStudent = kind === 'plan' && Boolean(studentId) && (route.type !== 'new-plan' || Boolean(route.studentId));
    const backHref = kind === 'template' ? '/personal/diets?tab=templates' : backToStudent ? `/personal/students/${studentId}?tab=diet` : '/personal/diets';
    const backLabel = kind === 'template' ? 'Biblioteca de modelos' : backToStudent ? 'Voltar para a ficha do aluno' : 'Planos de dieta';
    const heading =
        kind === 'template'
            ? isNew
                ? 'Novo modelo de dieta'
                : 'Editar modelo de dieta'
            : isNew
                ? 'Novo plano alimentar'
                : 'Plano alimentar';

    const historyItems: MenuEntry[] = [
        ...studentPlans.map<MenuEntry>((plan) => ({
            key: plan.id,
            label: plan.title,
            icon: plan.id === planId ? Check : undefined,
            hint: plan.active ? 'Ativa' : formatDateBR(plan.startDate) || formatDateBR(plan.createdAt),
            disabled: plan.id === planId,
            href: route.type === 'student' ? `/personal/students/${studentId}/diet?planId=${plan.id}` : `/personal/diets/${plan.id}`,
        })),
        { type: 'separator', key: 'history-sep' },
        { key: 'history-new', label: 'Novo plano para este aluno', icon: FilePlus2, href: `/personal/diets/new?studentId=${studentId}` },
    ];

    const moreItems: MenuEntry[] = [
        { key: 'template', label: kind === 'template' ? 'Salvar como novo modelo…' : 'Salvar como modelo…', icon: BookmarkPlus, onSelect: saveAsTemplate },
        ...(kind === 'plan' && planId
            ? ([
                { key: 'version', label: 'Criar nova versão para o aluno', icon: FilePlus2, href: `/personal/diets/new?fromPlanId=${planId}&studentId=${studentId}` },
                { key: 'duplicate', label: 'Duplicar para outro aluno…', icon: Copy, href: `/personal/diets/new?fromPlanId=${planId}` },
            ] as MenuEntry[])
            : []),
        ...(kind === 'plan' && studentId
            ? ([{ key: 'profile', label: 'Abrir ficha do aluno', icon: UserRound, href: `/personal/students/${studentId}?tab=diet` }] as MenuEntry[])
            : []),
        ...(!isNew
            ? ([
                { type: 'separator', key: 'sep-delete' },
                { key: 'delete', label: kind === 'template' ? 'Excluir modelo' : 'Excluir plano', icon: Trash2, danger: true, onSelect: deleteCurrent },
            ] as MenuEntry[])
            : []),
    ];

    const generateItems: MenuEntry[] = [
        { key: 'ai', label: 'Com IA (OpenAI)…', icon: Sparkles, onSelect: () => setGenerateMode('ai') },
        { key: 'rules', label: 'Automático por regras (TACO)…', icon: Wand2, onSelect: () => setGenerateMode('rules') },
    ];

    const saveStatus = saving ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Salvando…
        </span>
    ) : isDirty ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
            {isNew ? 'Ainda não salvo' : 'Alterações não salvas'}
        </span>
    ) : isNew ? (
        <span className="text-xs text-muted-foreground">Ainda não salvo</span>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {lastSavedAt ? `Salvo às ${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Tudo salvo'}
        </span>
    );

    const errors = showErrors ? issues : null;

    return (
        <div className="space-y-4 pb-16">
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                    <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        {backLabel}
                    </Link>
                    <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">
                        {heading}
                        {kind === 'plan' && studentName && <span className="font-semibold text-muted-foreground"> · {studentName}</span>}
                    </h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {kind === 'plan' && studentId && studentPlans.length > 0 && (
                        <DropdownMenu
                            label="Planos deste aluno"
                            items={historyItems}
                            buttonClassName="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
                        >
                            <History className="h-4 w-4" />
                            Planos ({studentPlans.length})
                            <ChevronDown className="h-4 w-4 opacity-60" />
                        </DropdownMenu>
                    )}
                    <DropdownMenu
                        label="Gerar rascunho"
                        items={generateItems}
                        buttonClassName="inline-flex h-9 items-center gap-2 rounded-xl border border-[#F88022]/60 bg-card px-3 text-sm font-semibold text-[#F88022] hover:bg-[#F88022]/10"
                    >
                        <Sparkles className="h-4 w-4" />
                        Gerar rascunho
                        <ChevronDown className="h-4 w-4 opacity-70" />
                    </DropdownMenu>
                    <DropdownMenu
                        label="Mais ações"
                        items={moreItems}
                        buttonClassName="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenu>
                </div>
            </div>

            {/* Barra de macros (acompanha a rolagem) */}
            <FloatingBar>
                {(floating) => (
                    <MacroBar totals={totals} targets={state.targets} compact={floating}>
                        {saveStatus}
                        {kind === 'plan' && (isNew || state.active) && (
                            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notifyStudent}
                                    onChange={(e) => setNotifyStudent(e.target.checked)}
                                    className="rounded border-border text-[#F88022] focus:ring-[#F88022]/25"
                                />
                                Avisar o aluno
                            </label>
                        )}
                        <button
                            type="button"
                            onClick={() => void save()}
                            disabled={saving}
                            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F88022] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#F88022]/90 disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isNew ? (kind === 'template' ? 'Criar modelo' : 'Criar plano') : 'Salvar'}
                            <kbd className="hidden rounded-md bg-white/20 px-1.5 text-xs font-semibold sm:inline">{mod} S</kbd>
                        </button>
                    </MacroBar>
                )}
            </FloatingBar>

            {/* Avisos */}
            {origin && (
                <Notice tone="info" icon={Info} onDismiss={() => setOrigin(null)}>
                    <p>{origin}</p>
                </Notice>
            )}
            {draft && (
                <Notice tone="draft" icon={draft.source === 'ai' ? Sparkles : Wand2} onDismiss={() => setDraft(null)}>
                    <p className="font-semibold">
                        Rascunho {draft.source === 'ai' ? 'gerado pela IA' : 'gerado automaticamente'} — ainda não foi salvo.
                    </p>
                    <p className="text-muted-foreground">Revise quantidades, alimentos e substituições; o aluno só recebe depois que você salvar.</p>
                    {draft.warnings.length > 0 && (
                        <ul className="list-disc space-y-0.5 pl-5 text-amber-700 dark:text-amber-300">
                            {draft.warnings.map((warning, index) => (
                                <li key={`${warning}-${index}`}>{warning}</li>
                            ))}
                        </ul>
                    )}
                </Notice>
            )}
            {drift !== null && (
                <Notice tone="warning" icon={AlertTriangle} onDismiss={() => setDrift(null)}>
                    <p>
                        <strong>Os totais salvos diferem do cálculo dos alimentos em {drift}%.</strong> As metas abaixo mostram os totais salvos (exibidos ao
                        aluno); os alimentos não foram alterados.
                    </p>
                    <button
                        type="button"
                        onClick={applyCalculatedTotals}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                        <Sigma className="h-3.5 w-3.5" />
                        Usar totais calculados
                    </button>
                </Notice>
            )}
            {kind === 'plan' && route.type === 'student' && !planId && !activeOtherPlan && studentPlans.length > 0 && (
                <Notice tone="info" icon={Info}>
                    <p>
                        {firstName.charAt(0).toUpperCase() + firstName.slice(1)} não tem dieta ativa. Você está criando um novo plano — os anteriores estão em
                        “Planos ({studentPlans.length})”.
                    </p>
                </Notice>
            )}
            {kind === 'plan' && state.active && activeOtherPlan && (
                <Notice tone="warning" icon={Info}>
                    <p>
                        {firstName.charAt(0).toUpperCase() + firstName.slice(1)} já tem a dieta ativa “{activeOtherPlan.title}”. Ao salvar este plano como ativo,
                        ela será desativada (o app mostra só uma dieta).
                    </p>
                </Notice>
            )}

            {/* Dados do plano */}
            <PlanDetails
                kind={kind}
                state={state}
                dispatch={dispatch}
                errors={errors}
                totals={totals}
                hasFoods={hasFoods}
                student={student}
                energy={energy}
                studentId={studentId}
                studentName={studentName}
                studentPicker={
                    route.type === 'new-plan' && !planId
                        ? { students: studentOptions, loading: studentsApi.isLoading, onSelect: (id) => void selectStudent(id) }
                        : null
                }
                datesSuggested={datesSuggested}
                onTargetChange={setTarget}
                onSuggestTargets={applySuggestedTargets}
                onUseCalculatedTotals={applyCalculatedTotals}
            />

            {/* Refeições */}
            <div className="space-y-3">
                {errors?.meals && (
                    <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                        {errors.meals}
                    </p>
                )}
                {state.meals.map((meal, index) => (
                    <MealCard
                        key={meal.uid}
                        meal={meal}
                        index={index}
                        count={state.meals.length}
                        meals={mealRefs}
                        invalidFoods={invalidFoods}
                        favoriteKeys={favoriteKeys}
                        recents={recents}
                        favorites={favorites}
                        dispatch={dispatch}
                        onActivate={onActivateMeal}
                        onMoveMeal={moveMeal}
                        onDuplicateMeal={duplicateMeal}
                        onRemoveMeal={removeMeal}
                        onPickFood={pickFood}
                        onCreateCustomFood={openCustomFood}
                        onToggleFavorite={toggleFavorite}
                        onToggleFoodFavorite={toggleFoodFavorite}
                        onMoveFood={moveFood}
                        onMoveFoodToMeal={moveFoodToMeal}
                        onDuplicateFood={duplicateFood}
                        onRemoveFood={removeFood}
                        onAmountEnter={focusSearch}
                    />
                ))}
                <button
                    type="button"
                    onClick={addMeal}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#F88022]/60 hover:text-foreground"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar refeição
                </button>
                <p className="text-center text-xs text-muted-foreground">
                    Atalhos: <kbd className="font-semibold">/</kbd> busca alimento · <kbd className="font-semibold">Enter</kbd> adiciona e depois volta para a busca ·{' '}
                    <kbd className="font-semibold">Alt ↑/↓</kbd> move linha ou refeição · <kbd className="font-semibold">{mod} S</kbd> salva sem sair
                </p>
            </div>

            <CustomFoodDialog
                open={customFood !== null}
                initialName={customFood?.name ?? ''}
                onClose={() => {
                    const target = customFood;
                    setCustomFood(null);
                    if (target) focusAfterDialog(`${target.mealUid}:search`);
                }}
                onCreated={(food) => {
                    const target = customFood;
                    setCustomFood(null);
                    if (target) pickFood(target.mealUid, food, true);
                }}
            />
            <GenerateDraftDialog
                mode={generateMode}
                onClose={() => setGenerateMode(null)}
                student={kind === 'plan' ? student : null}
                energy={kind === 'plan' ? energy : null}
                targets={state.targets}
                hasFoods={hasFoods}
                mealCount={hasFoods ? state.meals.length : 0}
                onDraft={applyDraft}
            />
        </div>
    );
}
