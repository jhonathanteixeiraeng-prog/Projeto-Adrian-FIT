'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    BookmarkPlus,
    CheckCircle2,
    History,
    Library,
    Loader2,
    Plus,
    Save,
    Undo2,
    UserRound,
    X,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, useDialogs, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { NOTIFY_STUDENT_STORAGE_KEY, getStoredNotifyStudent, personalLinks } from '@/lib/notifications';
import { parsePerSetReps } from '@/lib/workout-reps';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { isModalOpen, isTypingTarget, modKeyLabel, useHotkey } from '@/hooks/use-hotkey';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { usePageMeta } from '@/components/personal/page-meta';
import { rememberRecentStudent } from '@/components/personal/command-palette';
import { ExerciseFormDialog } from '@/components/personal/exercises/exercise-form-dialog';
import {
    apiDaysToEditor,
    collectServerIds,
    createDay,
    createItem,
    daysToPayload,
    editorReducer,
    findItem,
    serializeForDirty,
    validateEditor,
    withActiveDay,
    type ApiPlan,
    type ApiPlanDay,
    type ApiTemplate,
    type EditorDay,
    type EditorItem,
    type EditorMode,
    type EditorState,
    type ItemField,
    type LibraryExercise,
    type ValidationIssue,
} from './editor-state';
import { clearDraft, readDraft, setEditorHandoff, writeDraft, type EditorDraft } from './editor-storage';
import { ExerciseLibrary } from './exercise-library';
import { ROW_GRID_MD } from './exercise-row';
import { ImportDayDialog } from './import-day-dialog';
import { PlanHeader } from './plan-header';
import type { StudentOption } from './student-picker';
import { WorkoutDayCard } from './workout-day-card';

export interface WorkoutPlanEditorProps {
    mode: EditorMode;
    /** Where the editor lives: affects the URL after creating and the "back" link. */
    context: 'workouts' | 'student';
    initialState: EditorState;
    /** Serialized content considered saved (defaults to the initial state). */
    initialBaseline?: string;
    /** Plan or template id; null when creating. */
    entityId: string | null;
    version: number | null;
    active: boolean;
    updatedAt: string | null;
    /** Student fixed by the route or by the plan being edited. */
    studentLocked: boolean;
    studentName: string | null;
    draftKey: string;
    /** "Baseado no modelo X" etc. */
    sourceNote?: string | null;
}

type UndoEntry =
    | { kind: 'item'; dayKey: string; index: number; item: EditorItem; message: string }
    | { kind: 'day'; index: number; day: EditorDay; message: string };

type DragPayload = { kind: 'item'; itemKey: string } | { kind: 'exercises'; exercises: LibraryExercise[] };

const ROW_FIELDS: ItemField[] = ['sets', 'reps', 'rest', 'notes'];
const RECENTS_KEY = 'personal:recent-exercises';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

const byName = (a: LibraryExercise, b: LibraryExercise) => a.name.localeCompare(b.name, 'pt-BR');

type SaveOutcome = { ok: true; id: string } | { ok: false; conflict?: string };

async function sendJson(url: string, method: string, body: unknown) {
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    return { response, result };
}

function requestError(response: Response, result: any, fallback: string) {
    if (response.status === 401) {
        return 'Sua sessão expirou. Entre novamente em outra aba e salve de novo: suas alterações continuam aqui.';
    }
    return (result && typeof result.error === 'string' && result.error) || fallback;
}

export function WorkoutPlanEditor(props: WorkoutPlanEditorProps) {
    const { mode, context, draftKey } = props;
    const router = useRouter();
    const { toast } = useToast();
    const { confirm, prompt } = useDialogs();

    const [initial] = useState(() => withActiveDay(props.initialState));
    const [state, dispatch] = useReducer(editorReducer, initial);
    const stateRef = useRef(state);
    stateRef.current = state;

    const [entityId, setEntityId] = useState(props.entityId);
    const entityIdRef = useRef(props.entityId);
    const [version, setVersion] = useState(props.version);
    const versionRef = useRef(props.version);
    const [active, setActive] = useState(props.active);
    const [activating, setActivating] = useState(false);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

    const serialized = useMemo(() => serializeForDirty(state), [state]);
    const [baseline, setBaseline] = useState(() => props.initialBaseline ?? serializeForDirty(initial));
    const isDirty = serialized !== baseline;
    const isDirtyRef = useRef(isDirty);
    isDirtyRef.current = isDirty;

    const [showErrors, setShowErrors] = useState(false);
    const [collapsedDays, setCollapsedDays] = useState<Set<string>>(() => new Set());
    const [swapItemKey, setSwapItemKey] = useState<string | null>(null);
    const swapItemKeyRef = useRef<string | null>(null);
    swapItemKeyRef.current = swapItemKey;
    const [flashKey, setFlashKey] = useState<string | null>(null);
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
    const undoStackRef = useRef<UndoEntry[]>([]);
    const [undoVisible, setUndoVisible] = useState(false);
    // Read synchronously: if the restore notice only appeared after an effect, the "clear draft when
    // clean" effect below would run first and delete the draft the notice offers to restore.
    const [draft, setDraft] = useState<EditorDraft | null>(() => {
        if (typeof window === 'undefined') return null;
        const saved = readDraft(draftKey);
        return saved && serializeForDirty(saved.state) !== baseline ? saved : null;
    });
    const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
    const [createName, setCreateName] = useState<string | null>(null);
    const [importDayKey, setImportDayKey] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [dropTarget, setDropTargetState] = useState<{ dayKey: string; index: number } | null>(null);
    const dropTargetRef = useRef<{ dayKey: string; index: number } | null>(null);
    const dragRef = useRef<DragPayload | null>(null);
    const pendingFocusRef = useRef<{ itemKey: string; field: string } | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);
    const mobileSearchRef = useRef<HTMLInputElement>(null);
    const titleRef = useRef<HTMLInputElement>(null);
    const paneRef = useRef<HTMLDivElement>(null);

    const exercisesApi = useApi<LibraryExercise[]>('/api/exercises');
    const studentsApi = useApi<StudentOption[]>(mode === 'plan' ? '/api/students' : null);
    const [recentIds, setRecentIds] = useLocalStorageState<string[]>(RECENTS_KEY, []);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);

    const isNew = !entityId;
    const studentName =
        studentsApi.data?.find((student) => student.id === state.studentId)?.user.name ?? (state.studentId ? props.studentName : null);
    const activeDay = state.days.find((day) => day.key === state.activeDayKey) ?? state.days[0] ?? null;
    const swapItem = swapItemKey ? findItem(state, swapItemKey)?.item ?? null : null;

    const discardedRef = useRef(false);
    const handoffRef = useRef<{
        id: string;
        baseline: string;
        version: number | null;
        active: boolean;
        updatedAt: string | null;
        studentName: string | null;
    } | null>(null);

    useUnsavedChangesGuard(isDirty, {
        onDiscard: () => {
            discardedRef.current = true;
            clearDraft(draftKey);
        },
    });

    // ------------------------------------------------------------------ page meta
    const pageTitle =
        mode === 'template'
            ? `${state.title.trim() || 'Novo modelo'} · Modelo`
            : studentName
              ? `${studentName} · Treino`
              : isNew
                ? 'Nova ficha'
                : state.title.trim() || 'Ficha de treino';
    usePageMeta({
        title: pageTitle,
        breadcrumbs:
            context === 'student' && state.studentId
                ? [
                      { label: 'Alunos', href: '/personal/students' },
                      { label: studentName ?? 'Aluno', href: `/personal/students/${state.studentId}` },
                      { label: 'Treino' },
                  ]
                : mode === 'template'
                  ? [
                        { label: 'Fichas de treino', href: '/personal/workouts' },
                        { label: 'Modelos', href: '/personal/workouts?tab=library' },
                        { label: isNew ? 'Novo modelo' : state.title.trim() || 'Modelo' },
                    ]
                  : [
                        { label: 'Fichas de treino', href: '/personal/workouts' },
                        { label: isNew ? 'Nova ficha' : state.title.trim() || 'Ficha' },
                    ],
    });

    useEffect(() => {
        if (mode === 'plan' && state.studentId) rememberRecentStudent(state.studentId);
    }, [mode, state.studentId]);

    // ------------------------------------------------------------------ validation
    const issues = useMemo(
        () => (showErrors ? validateEditor(state, { mode, requireStudent: mode === 'plan' }) : []),
        [showErrors, state, mode]
    );
    const issueMaps = useMemo(() => {
        const plan: Partial<Record<string, string>> = {};
        const dayNames: Record<string, string> = {};
        const items: Record<string, Partial<Record<ItemField, string>>> = {};
        issues.forEach((issue) => {
            if (issue.itemKey && issue.field) {
                items[issue.itemKey] = { ...items[issue.itemKey], [issue.field]: issue.message };
            } else if (issue.dayKey) {
                dayNames[issue.dayKey] = issue.message;
            } else {
                plan[issue.field ?? 'days'] = issue.message;
            }
        });
        return { plan, dayNames, items };
    }, [issues]);

    useEffect(() => {
        if (showErrors && issues.length === 0) setShowErrors(false);
    }, [showErrors, issues.length]);

    // ------------------------------------------------------------------ focus helpers
    const focusSearch = useCallback((options: { select?: boolean } = {}) => {
        if (isDesktop()) {
            const input = searchRef.current;
            input?.focus();
            if (options.select) input?.select();
        } else {
            setMobileLibraryOpen(true);
        }
    }, []);

    const focusField = useCallback((itemKey: string, field: string) => {
        const element = document.querySelector<HTMLElement>(`[data-item-key="${itemKey}"][data-field="${field}"]`);
        if (!element) return;
        element.focus();
        element.scrollIntoView({ block: 'nearest' });
        if (element instanceof HTMLInputElement) element.select();
    }, []);

    useIsomorphicLayoutEffect(() => {
        const pending = pendingFocusRef.current;
        if (!pending) return;
        pendingFocusRef.current = null;
        const element = document.querySelector<HTMLElement>(`[data-item-key="${pending.itemKey}"][data-field="${pending.field}"]`);
        element?.focus();
        element?.scrollIntoView({ block: 'nearest' });
    });

    const focusIssue = useCallback(
        (issue: ValidationIssue) => {
            if (issue.dayKey) {
                setCollapsedDays((current) => {
                    if (!current.has(issue.dayKey!)) return current;
                    const next = new Set(current);
                    next.delete(issue.dayKey!);
                    return next;
                });
            }
            window.requestAnimationFrame(() => {
                if (issue.itemKey && issue.field) {
                    focusField(issue.itemKey, issue.field);
                } else if (issue.dayKey) {
                    document.querySelector<HTMLElement>(`[data-day-name="${issue.dayKey}"]`)?.focus();
                } else if (issue.field === 'title') {
                    titleRef.current?.focus();
                } else if (issue.field) {
                    document.getElementById(`editor-${issue.field}`)?.focus();
                }
            });
        },
        [focusField]
    );

    // ------------------------------------------------------------------ flash + scroll to added rows
    useEffect(() => {
        if (!flashKey) return;
        const element = document.querySelector<HTMLElement>(`[data-row-key="${flashKey}"]`);
        element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const id = window.setTimeout(() => setFlashKey(null), 1200);
        return () => window.clearTimeout(id);
    }, [flashKey]);

    // ------------------------------------------------------------------ drafts
    const isNewDraftKey = draftKey.startsWith('new');
    const initialSerializedRef = useRef(baseline);

    useEffect(() => {
        return () => {
            if (handoffRef.current) {
                setEditorHandoff(handoffRef.current.id, {
                    state: stateRef.current,
                    baseline: handoffRef.current.baseline,
                    version: handoffRef.current.version,
                    active: handoffRef.current.active,
                    updatedAt: handoffRef.current.updatedAt,
                    studentName: handoffRef.current.studentName,
                });
            }
        };
    }, []);

    useEffect(() => {
        // A stored draft identical to what was loaded has nothing to restore.
        const saved = readDraft(draftKey);
        if (saved && serializeForDirty(saved.state) === baseline) clearDraft(draftKey);
        // Only when the editor opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Dismiss draft restore notice and resume drafting on the first edit
    useEffect(() => {
        if (draft && serialized !== initialSerializedRef.current) {
            setDraft(null);
        }
    }, [draft, serialized]);

    useEffect(() => {
        if (!isDirty) {
            if (!draft) clearDraft(draftKey);
            return;
        }
        if (draft) return;
        if (isNewDraftKey && (entityIdRef.current || handoffRef.current)) {
            clearDraft(draftKey);
            return;
        }
        const id = window.setTimeout(() => {
            writeDraft(draftKey, { savedAt: Date.now(), version: versionRef.current, state: stateRef.current });
        }, 800);
        return () => window.clearTimeout(id);
    }, [serialized, isDirty, draft, draftKey, isNewDraftKey]);

    useEffect(() => {
        const saveDraftNow = () => {
            if (discardedRef.current) return;
            if (isNewDraftKey && (entityIdRef.current || handoffRef.current)) {
                clearDraft(draftKey);
                return;
            }
            if (isDirtyRef.current && !draft) {
                writeDraft(draftKey, { savedAt: Date.now(), version: versionRef.current, state: stateRef.current });
            }
        };
        window.addEventListener('pagehide', saveDraftNow);
        return () => {
            window.removeEventListener('pagehide', saveDraftNow);
            saveDraftNow();
        };
    }, [draftKey, draft, isNewDraftKey]);

    // ------------------------------------------------------------------ recents
    const pushRecents = useCallback(
        (ids: string[]) => setRecentIds((current) => [...ids, ...current.filter((id) => !ids.includes(id))].slice(0, 30)),
        [setRecentIds]
    );

    // ------------------------------------------------------------------ undo
    const pushUndo = useCallback((entry: UndoEntry) => {
        undoStackRef.current = [...undoStackRef.current, entry].slice(-20);
        setUndoStack(undoStackRef.current);
        setUndoVisible(true);
    }, []);

    const undo = useCallback(() => {
        const last = undoStackRef.current[undoStackRef.current.length - 1];
        if (!last) return;
        undoStackRef.current = undoStackRef.current.slice(0, -1);
        setUndoStack(undoStackRef.current);
        if (last.kind === 'item') {
            dispatch({ type: 'restoreItem', dayKey: last.dayKey, index: last.index, item: last.item });
            setFlashKey(last.item.key);
        } else {
            dispatch({ type: 'restoreDay', day: last.day, index: last.index });
        }
        setUndoVisible(undoStackRef.current.length > 0);
    }, []);

    useEffect(() => {
        if (!undoVisible) return;
        const id = window.setTimeout(() => setUndoVisible(false), 8000);
        return () => window.clearTimeout(id);
    }, [undoVisible, undoStack]);

    // ------------------------------------------------------------------ adding / swapping exercises
    const buildItems = useCallback((exercises: LibraryExercise[], day: EditorDay | null) => {
        // New rows inherit séries/reps/descanso from the last row of the day (typing once per plan, not per row).
        const last = day?.items[day.items.length - 1];
        const base = last ? { sets: last.sets, reps: last.reps, rest: last.rest } : undefined;
        return exercises.map((exercise) => createItem(exercise, base));
    }, []);

    const handlePick = useCallback(
        (exercises: LibraryExercise[]) => {
            if (!exercises.length) return;
            const current = stateRef.current;

            if (swapItemKey) {
                const exercise = exercises[0];
                const found = findItem(current, swapItemKey);
                if (found) {
                    dispatch({
                        type: 'updateItem',
                        itemKey: swapItemKey,
                        patch: { exerciseId: exercise.id, exerciseName: exercise.name, muscleGroup: exercise.muscleGroup },
                    });
                    setFlashKey(swapItemKey);
                    pushRecents([exercise.id]);
                }
                setSwapItemKey(null);
                if (!isDesktop()) setMobileLibraryOpen(false);
                return;
            }

            let day = current.days.find((candidate) => candidate.key === current.activeDayKey) ?? current.days[0] ?? null;
            if (!day) {
                day = createDay([]);
                dispatch({ type: 'addDay', day });
            }
            const items = buildItems(exercises, day);
            dispatch({ type: 'addItems', dayKey: day.key, items });
            pushRecents(exercises.map((exercise) => exercise.id));
            setFlashKey(items[items.length - 1].key);
        },
        [swapItemKey, buildItems, pushRecents]
    );

    const startSwap = useCallback(
        (itemKey: string) => {
            const found = findItem(stateRef.current, itemKey);
            if (!found) return;
            dispatch({ type: 'setActiveDay', dayKey: found.day.key });
            setSwapItemKey(itemKey);
            focusSearch({ select: true });
        },
        [focusSearch]
    );

    const addExerciseToDay = useCallback(
        (dayKey: string) => {
            dispatch({ type: 'setActiveDay', dayKey });
            setSwapItemKey(null);
            focusSearch({ select: true });
        },
        [focusSearch]
    );

    const onExerciseCreated = useCallback(
        (exercise: LibraryExercise) => {
            exercisesApi.mutate(
                (current) => [...(current ?? []).filter((item) => item.id !== exercise.id), exercise].sort(byName),
                { revalidate: false }
            );
            invalidateApi((key) => key.startsWith('/api/exercises?'));
            handlePick([exercise]);
            toast.success('Exercício criado', `${exercise.name} já está na ficha e na sua biblioteca.`);
        },
        [exercisesApi, handlePick, toast]
    );

    // ------------------------------------------------------------------ item & day handlers (stable for memoized rows)
    const handlers = useMemo(
        () => ({
            onActivate: (dayKey: string) => dispatch({ type: 'setActiveDay', dayKey }),
            onUpdateDay: (dayKey: string, patch: Partial<Pick<EditorDay, 'name' | 'dayOfWeek'>>) =>
                dispatch({ type: 'updateDay', dayKey, patch }),
            onDuplicateDay: (dayKey: string) => dispatch({ type: 'duplicateDay', dayKey }),
            onMoveDay: (dayKey: string, delta: -1 | 1) => dispatch({ type: 'moveDay', dayKey, delta }),
            onItemChange: (itemKey: string, patch: Partial<EditorItem>) => dispatch({ type: 'updateItem', itemKey, patch }),
            onDuplicateItem: (itemKey: string) => dispatch({ type: 'duplicateItem', itemKey }),
            onMoveItemBy: (itemKey: string, delta: -1 | 1) => dispatch({ type: 'moveItemBy', itemKey, delta }),
            onMoveItemToDay: (itemKey: string, dayKey: string) => {
                const target = stateRef.current.days.find((day) => day.key === dayKey);
                if (!target) return;
                dispatch({ type: 'moveItem', itemKey, toDayKey: dayKey, toIndex: target.items.length });
                dispatch({ type: 'setActiveDay', dayKey });
                setFlashKey(itemKey);
            },
            onImportIntoDay: (dayKey: string) => setImportDayKey(dayKey),
        }),
        []
    );

    const removeItem = useCallback(
        (itemKey: string) => {
            const found = findItem(stateRef.current, itemKey);
            if (!found) return;
            dispatch({ type: 'removeItem', itemKey });
            pushUndo({
                kind: 'item',
                dayKey: found.day.key,
                index: found.index,
                item: found.item,
                message: `“${found.item.exerciseName}” removido de ${found.day.name || 'dia'}`,
            });
            if (swapItemKeyRef.current === itemKey) setSwapItemKey(null);
        },
        [pushUndo]
    );

    const removeDay = useCallback(
        async (dayKey: string) => {
            const current = stateRef.current;
            const index = current.days.findIndex((day) => day.key === dayKey);
            const day = current.days[index];
            if (!day) return;
            if (day.items.length > 0 || day.id) {
                const ok = await confirm({
                    title: `Remover ${day.name || 'este dia'}?`,
                    description: day.id
                        ? `O dia e ${day.items.length === 1 ? 'seu exercício' : `seus ${day.items.length} exercícios`} saem da ficha. Ao salvar, o histórico de treinos concluídos deste dia deixa de aparecer para o aluno.`
                        : `${day.items.length === 1 ? 'O exercício deste dia será removido' : `Os ${day.items.length} exercícios deste dia serão removidos`}.`,
                    confirmText: 'Remover dia',
                    variant: 'danger',
                });
                if (!ok) return;
            }
            dispatch({ type: 'removeDay', dayKey });
            pushUndo({ kind: 'day', index, day, message: `${day.name || 'Dia'} removido` });
        },
        [confirm, pushUndo]
    );

    const addDay = useCallback(() => {
        const day = createDay(stateRef.current.days);
        dispatch({ type: 'addDay', day });
        window.requestAnimationFrame(() => {
            const input = document.querySelector<HTMLInputElement>(`[data-day-name="${day.key}"]`);
            input?.focus();
            input?.select();
            input?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }, []);

    const toggleCollapse = useCallback((dayKey: string) => {
        setCollapsedDays((current) => {
            const next = new Set(current);
            if (next.has(dayKey)) next.delete(dayKey);
            else next.add(dayKey);
            return next;
        });
    }, []);

    // ------------------------------------------------------------------ drag and drop
    const setDropTarget = useCallback((target: { dayKey: string; index: number } | null) => {
        const current = dropTargetRef.current;
        if (current?.dayKey === target?.dayKey && current?.index === target?.index) return;
        dropTargetRef.current = target;
        setDropTargetState(target);
    }, []);

    const endDrag = useCallback(() => {
        dragRef.current = null;
        setDragActive(false);
        setDropTarget(null);
    }, [setDropTarget]);

    const dragHandlers = useMemo(
        () => ({
            onItemDragStart: (itemKey: string) => {
                dragRef.current = { kind: 'item', itemKey };
                setDragActive(true);
            },
            onDragEnd: endDrag,
            onDragOverDay: (dayKey: string, index: number) => setDropTarget({ dayKey, index }),
            onDropOnDay: (dayKey: string) => {
                const payload = dragRef.current;
                const current = stateRef.current;
                const day = current.days.find((candidate) => candidate.key === dayKey);
                if (!payload || !day) return endDrag();
                const index = dropTargetRef.current?.dayKey === dayKey ? dropTargetRef.current.index : day.items.length;
                if (payload.kind === 'item') {
                    dispatch({ type: 'moveItem', itemKey: payload.itemKey, toDayKey: dayKey, toIndex: index });
                    setFlashKey(payload.itemKey);
                } else {
                    const items = buildItems(payload.exercises, day);
                    dispatch({ type: 'addItems', dayKey, items, index });
                    pushRecents(payload.exercises.map((exercise) => exercise.id));
                    setFlashKey(items[items.length - 1]?.key ?? null);
                }
                dispatch({ type: 'setActiveDay', dayKey });
                endDrag();
            },
        }),
        [buildItems, endDrag, pushRecents, setDropTarget]
    );

    const mutateExercises = exercisesApi.mutate;
    const retryExercises = useCallback(() => void mutateExercises(), [mutateExercises]);
    const cancelSwap = useCallback(() => setSwapItemKey(null), []);
    const blurSearch = useCallback(() => searchRef.current?.blur(), []);

    const onLibraryDrag = useCallback((exercises: LibraryExercise[]) => {
        dragRef.current = { kind: 'exercises', exercises };
        setDragActive(true);
    }, []);

    // ------------------------------------------------------------------ keyboard inside the days
    const onDaysKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (event.nativeEvent.isComposing) return;

        if (target.dataset.dayName && event.key === 'Enter') {
            event.preventDefault();
            focusSearch({ select: true });
            return;
        }

        const itemKey = target.dataset.itemKey;
        const field = target.dataset.field;
        if (!itemKey || !field) return;

        if (event.altKey && !event.metaKey && !event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            dispatch({ type: 'moveItemBy', itemKey, delta: event.key === 'ArrowUp' ? -1 : 1 });
            pendingFocusRef.current = { itemKey, field };
            return;
        }

        if (target.tagName !== 'INPUT' || event.metaKey || event.ctrlKey || event.altKey) return;

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const index = ROW_FIELDS.indexOf(field as ItemField);
            if (index >= 0 && index < ROW_FIELDS.length - 1) focusField(itemKey, ROW_FIELDS[index + 1]);
            else focusSearch({ select: true });
            return;
        }

        if (!event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            // Spreadsheet-like: same column in the previous/next row (across days).
            const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-field="${field}"][data-item-key]`));
            const position = rows.indexOf(target);
            const next = rows[position + (event.key === 'ArrowUp' ? -1 : 1)];
            if (next) {
                event.preventDefault();
                next.focus();
                if (next instanceof HTMLInputElement) next.select();
                next.scrollIntoView({ block: 'nearest' });
            }
        }
    };

    // ------------------------------------------------------------------ saving
    const performSave = useCallback(
        async (force: boolean): Promise<SaveOutcome> => {
            const snapshot = stateRef.current;
            const snapshotSerialized = serializeForDirty(snapshot);
            const currentId = entityIdRef.current;

            const finishSaved = (id: string, nextVersion: number | null) => {
                entityIdRef.current = id;
                setEntityId(id);
                versionRef.current = nextVersion;
                setVersion(nextVersion);
                setBaseline(snapshotSerialized);
                isDirtyRef.current = false;
                setLastSavedAt(new Date());
                clearDraft(draftKey);
            };

            if (mode === 'template') {
                const payload = {
                    title: snapshot.title.trim(),
                    description: snapshot.description.trim(),
                    templateDays: daysToPayload(snapshot.days, false),
                };
                const { response, result } = await sendJson(
                    currentId ? `/api/workout-templates/${currentId}` : '/api/workout-templates',
                    currentId ? 'PUT' : 'POST',
                    payload
                );
                if (!response.ok || !result?.success) throw new Error(requestError(response, result, 'Erro ao salvar o modelo'));
                const template = result.data as ApiTemplate;
                finishSaved(template.id, null);
                invalidateApi('/api/workout-templates');
                if (!currentId) {
                    handoffRef.current = {
                        id: template.id,
                        baseline: snapshotSerialized,
                        version: null,
                        active: false,
                        updatedAt: template.updatedAt ?? null,
                        studentName: null,
                    };
                    setEditorHandoff(template.id, {
                        state: stateRef.current,
                        baseline: snapshotSerialized,
                        version: null,
                        active: false,
                        updatedAt: template.updatedAt ?? null,
                        studentName: null,
                    });
                    router.replace(`/personal/workouts/${template.id}?kind=template`);
                }
                return { ok: true, id: template.id };
            }

            if (!currentId) {
                const payload = {
                    title: snapshot.title.trim(),
                    studentId: snapshot.studentId,
                    startDate: snapshot.startDate,
                    endDate: snapshot.endDate,
                    active: true,
                    notifyStudent,
                    workoutDays: daysToPayload(snapshot.days, false),
                };
                const { response, result } = await sendJson('/api/workout-plans', 'POST', payload);
                if (!response.ok || !result?.success) throw new Error(requestError(response, result, 'Erro ao criar a ficha'));
                const plan = result.data as ApiPlan;
                const ids = collectServerIds(snapshot.days, plan.workoutDays);
                dispatch({ type: 'applyServerIds', ...ids });
                finishSaved(plan.id, plan.version);
                setActive(plan.active);
                const finalState = editorReducer(stateRef.current, { type: 'applyServerIds', ...ids });
                handoffRef.current = {
                    id: plan.id,
                    baseline: snapshotSerialized,
                    version: plan.version,
                    active: plan.active,
                    updatedAt: plan.updatedAt ?? null,
                    studentName: plan.student?.user?.name ?? studentName ?? null,
                };
                setEditorHandoff(plan.id, {
                    state: finalState,
                    baseline: snapshotSerialized,
                    version: plan.version,
                    active: plan.active,
                    updatedAt: plan.updatedAt ?? null,
                    studentName: plan.student?.user?.name ?? studentName ?? null,
                });
                invalidateApi('/api/workout-plans');
                invalidateApi('/api/students');
                router.replace(
                    context === 'student'
                        ? `/personal/students/${plan.studentId}/workout?planId=${plan.id}`
                        : `/personal/workouts/${plan.id}`
                );
                return { ok: true, id: plan.id };
            }

            const payload = {
                title: snapshot.title.trim(),
                startDate: snapshot.startDate,
                endDate: snapshot.endDate,
                ...(force || versionRef.current === null ? {} : { version: versionRef.current }),
                workoutDays: daysToPayload(snapshot.days, true),
            };
            const { response, result } = await sendJson(`/api/workout-plans/${currentId}`, 'PUT', payload);
            if (response.status === 409 && result?.code === 'VERSION_CONFLICT') {
                return { ok: false, conflict: result.error as string };
            }
            if (!response.ok || !result?.success) throw new Error(requestError(response, result, 'Erro ao salvar a ficha'));
            const plan = result.data as ApiPlan;
            dispatch({ type: 'applyServerIds', ...collectServerIds(snapshot.days, plan.workoutDays) });
            finishSaved(plan.id, plan.version);
            setActive(plan.active);
            invalidateApi('/api/workout-plans');
            return { ok: true, id: plan.id };
        },
        [mode, context, draftKey, router, studentName, notifyStudent]
    );

    const save = useCallback(
        async (options: { quiet?: boolean } = {}): Promise<string | null> => {
            if (savingRef.current) return null;
            if (entityIdRef.current && !isDirtyRef.current) {
                // Nothing to send: avoid bumping the plan version for an empty save.
                if (!options.quiet) toast.info('Nenhuma alteração para salvar');
                return entityIdRef.current;
            }
            const problems = validateEditor(stateRef.current, { mode, requireStudent: mode === 'plan' });
            if (problems.length) {
                setShowErrors(true);
                focusIssue(problems[0]);
                toast.error(
                    problems.length === 1 ? 'Corrija 1 campo antes de salvar' : `Corrija ${problems.length} campos antes de salvar`,
                    problems[0].message
                );
                return null;
            }

            const wasNew = !entityIdRef.current;
            savingRef.current = true;
            setSaving(true);
            try {
                let outcome = await performSave(false);
                if (!outcome.ok && outcome.conflict) {
                    savingRef.current = false;
                    setSaving(false);
                    const overwrite = await confirm({
                        title: 'A ficha foi alterada em outro lugar',
                        description: `${outcome.conflict} Se sobrescrever, as mudanças feitas em outro lugar serão substituídas pelas suas.`,
                        confirmText: 'Sobrescrever com a minha versão',
                        cancelText: 'Continuar editando',
                        variant: 'danger',
                    });
                    if (!overwrite) return null;
                    savingRef.current = true;
                    setSaving(true);
                    outcome = await performSave(true);
                }
                if (!outcome.ok) return null;
                if (!options.quiet) {
                    if (mode === 'template') toast.success(wasNew ? 'Modelo criado' : 'Modelo salvo');
                    else if (wasNew) toast.success('Ficha criada', 'Ela já é a ficha ativa do aluno.');
                    else toast.success('Ficha salva', versionRef.current ? `Versão ${versionRef.current}` : undefined);
                }
                return outcome.id;
            } catch (error) {
                toast.error('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.');
                return null;
            } finally {
                savingRef.current = false;
                setSaving(false);
            }
        },
        [mode, focusIssue, toast, performSave, confirm]
    );

    const saveAsTemplate = useCallback(async () => {
        const hasPerSetRest = stateRef.current.days.some((day) =>
            day.items.some((item) => parsePerSetReps(item.rest).length > 1)
        );
        if (hasPerSetRest) {
            const proceed = await confirm({
                title: 'Salvar como modelo',
                description:
                    'Esta ficha tem descansos por série. No modelo, cada exercício vai guardar só o primeiro valor (ex.: 60/90/120 → 60 s). Continuar?',
                confirmText: 'Continuar',
            });
            if (!proceed) return;
        }

        const name = await prompt({
            title: 'Salvar como modelo',
            description: 'Uma cópia desta ficha vai para a sua biblioteca de modelos, pronta para usar com outros alunos.',
            label: 'Nome do modelo',
            defaultValue: `${stateRef.current.title.trim() || 'Treino'} - Modelo`,
            confirmText: 'Salvar modelo',
        });
        if (!name) return;
        let planId = entityIdRef.current;
        if (!planId || isDirtyRef.current) {
            // Saving first: from-plan copies what is stored, not what is on screen.
            planId = await save({ quiet: Boolean(planId) });
            if (!planId) return;
        }
        try {
            const { response, result } = await sendJson('/api/workout-templates/from-plan', 'POST', { planId, title: name });
            if (!response.ok || !result?.success) throw new Error(requestError(response, result, 'Erro ao salvar o modelo'));
            invalidateApi('/api/workout-templates');
            toast.success('Modelo salvo na biblioteca', name);
        } catch (error) {
            toast.error('Não foi possível salvar o modelo', error instanceof Error ? error.message : undefined);
        }
    }, [confirm, prompt, save, toast]);

    const activate = useCallback(async () => {
        const planId = entityIdRef.current;
        if (!planId) return;
        const shouldNotify = getStoredNotifyStudent();
        const ok = await confirm({
            title: 'Ativar esta ficha?',
            description: `Ela passa a ser a ficha que ${studentName ?? 'o aluno'} vê no app. A ficha ativa atual será desativada (continua no histórico). ${shouldNotify ? 'O aluno será avisado no app.' : 'O aluno não será avisado.'}`,
            confirmText: 'Ativar ficha',
        });
        if (!ok) return;
        setActivating(true);
        try {
            const { response, result } = await sendJson(`/api/workout-plans/${planId}`, 'PUT', { active: true, notifyStudent: shouldNotify });
            if (!response.ok || !result?.success) throw new Error(requestError(response, result, 'Erro ao ativar a ficha'));
            setActive(true);
            invalidateApi('/api/workout-plans');
            invalidateApi('/api/students');
            toast.success('Ficha ativada', 'Agora é a ficha que o aluno vê no app.');
        } catch (error) {
            toast.error('Não foi possível ativar a ficha', error instanceof Error ? error.message : undefined);
        } finally {
            setActivating(false);
        }
    }, [confirm, studentName, toast]);

    // ------------------------------------------------------------------ shortcuts
    useHotkey('mod+s', () => {
        if (isModalOpen()) return;
        void save();
    });
    useHotkey('/', () => focusSearch({ select: true }));
    useHotkey(
        'mod+z',
        (event) => {
            if (isTypingTarget(event.target) || isModalOpen() || undoStackRef.current.length === 0) return;
            event.preventDefault();
            undo();
        },
        { preventDefault: false }
    );

    // ------------------------------------------------------------------ derived view data
    const stats = useMemo(
        () => ({
            days: state.days.length,
            exercises: state.days.reduce((sum, day) => sum + day.items.length, 0),
            sets: state.days.reduce((sum, day) => sum + day.items.reduce((acc, item) => acc + (Number.parseInt(item.sets, 10) || 0), 0), 0),
        }),
        [state.days]
    );

    const dayListKey = state.days.map((day) => `${day.key}\u0000${day.name}`).join('\u0001');
    const allDays = useMemo(
        () => state.days.map((day) => ({ key: day.key, name: day.name })),
        // Only names/keys matter for the "move to day" menus.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [dayListKey]
    );

    // Keyed by the exercise ids only, so typing séries/reps doesn't re-render the library.
    const activeExerciseIds = activeDay?.items.map((item) => item.exerciseId).join(',') ?? '';
    const countsInTarget = useMemo(() => {
        const counts: Record<string, number> = {};
        activeExerciseIds
            .split(',')
            .filter(Boolean)
            .forEach((id) => {
                counts[id] = (counts[id] ?? 0) + 1;
            });
        return counts;
    }, [activeExerciseIds]);

    const knownMuscleGroups = useMemo(() => Array.from(new Set((exercisesApi.data ?? []).map((item) => item.muscleGroup))), [exercisesApi.data]);
    const knownEquipments = useMemo(
        () => Array.from(new Set((exercisesApi.data ?? []).map((item) => item.equipment ?? '').filter(Boolean))),
        [exercisesApi.data]
    );

    const backHref =
        context === 'student' && state.studentId
            ? personalLinks.student(state.studentId, 'workout')
            : mode === 'template'
              ? '/personal/workouts?tab=library'
              : '/personal/workouts';
    const backLabel = context === 'student' ? 'Voltar para o aluno' : mode === 'template' ? 'Voltar para os modelos' : 'Voltar para as fichas';

    const heading =
        mode === 'template'
            ? isNew
                ? 'Novo modelo de treino'
                : 'Editar modelo'
            : isNew
              ? 'Nova ficha de treino'
              : 'Editar ficha';

    const subheading =
        mode === 'template'
            ? 'Modelos ficam na biblioteca e podem ser usados com qualquer aluno'
            : [
                  studentName ?? (isNew ? 'Escolha o aluno' : null),
                  version ? `versão ${version}` : null,
                  !lastSavedAt && props.updatedAt && !isNew
                      ? `atualizada em ${new Date(props.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                      : null,
              ]
                  .filter(Boolean)
                  .join(' · ');

    const saveStatus = saving ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
        </span>
    ) : isDirty ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Alterações não salvas
        </span>
    ) : lastSavedAt ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo às {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
    ) : (
        <span className="text-xs text-muted-foreground">{isNew ? 'Ainda não salvo' : 'Sem alterações'}</span>
    );

    const lastUndo = undoStack[undoStack.length - 1];
    const importTargetDay = state.days.find((day) => day.key === importDayKey) ?? null;
    const mod = modKeyLabel();

    const libraryProps = {
        exercises: exercisesApi.data,
        isLoading: exercisesApi.isLoading,
        error: exercisesApi.error,
        onRetry: retryExercises,
        targetLabel: activeDay?.name || 'o dia selecionado',
        swapTargetName: swapItem?.exerciseName ?? null,
        onCancelSwap: cancelSwap,
        countsInTarget,
        recentIds,
        onPick: handlePick,
        onRequestCreate: setCreateName,
    };

    return (
        <div className="flex flex-col gap-3 pb-24 lg:h-[calc(100dvh-8rem)] lg:min-h-[560px] lg:pb-0">
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-card px-3 py-2">
                <Link
                    href={backHref}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={backLabel}
                    aria-label={backLabel}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="min-w-0 flex-1">
                    <h1 className="truncate text-base font-bold text-foreground">{heading}</h1>
                    <p className="truncate text-xs text-muted-foreground">{subheading}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="hidden sm:inline-flex">{saveStatus}</span>
                    {mode === 'plan' && state.studentId && context !== 'student' && (
                        <Link
                            href={personalLinks.student(state.studentId, 'workout')}
                            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
                        >
                            <UserRound className="h-4 w-4" /> Ver aluno
                        </Link>
                    )}
                    {mode === 'plan' && (
                        <button
                            type="button"
                            onClick={() => void saveAsTemplate()}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
                            title="Copiar esta ficha para a biblioteca de modelos"
                        >
                            <BookmarkPlus className="h-4 w-4" />
                            <span className="hidden sm:inline">Salvar como modelo</span>
                        </button>
                    )}
                    {mode === 'plan' && !entityId && (
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
                        className="inline-flex items-center gap-2 rounded-lg bg-[#F88022] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#F88022]/90 disabled:opacity-70"
                        title={`Salvar sem sair da tela (${mod}S)`}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar
                        <kbd className="hidden rounded bg-white/20 px-1.5 text-xs font-medium lg:inline">{mod}S</kbd>
                    </button>
                </div>
            </div>

            {draft && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-sm">
                    <History className="h-4 w-4 shrink-0 text-blue-500" />
                    <span className="min-w-0 flex-1 text-foreground">
                        Há alterações não salvas desta {mode === 'template' ? 'ficha-modelo' : 'ficha'} de{' '}
                        {new Date(draft.savedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {draft.version !== null && version !== null && draft.version !== version ? ' (feitas sobre uma versão anterior)' : ''}.
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'init', state: draft.state });
                            versionRef.current = draft.version;
                            setVersion(draft.version);
                            setDraft(null);
                            toast.info('Rascunho restaurado', 'Revise e salve para enviar ao aluno.');
                        }}
                        className="rounded-lg bg-blue-500 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-600"
                    >
                        Restaurar
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            clearDraft(draftKey);
                            setDraft(null);
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        Descartar
                    </button>
                </div>
            )}

            <div className="flex min-h-0 flex-1 gap-4">
                <aside className="hidden w-[340px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card lg:flex lg:flex-col">
                    <ExerciseLibrary
                        {...libraryProps}
                        inputRef={searchRef}
                        autoFocus={!(mode === 'plan' && isNew && !state.studentId) && isDesktop()}
                        onDragExercises={onLibraryDrag}
                        onDragEnd={endDrag}
                        onEscapeEmpty={blurSearch}
                        className="min-h-0 flex-1"
                    />
                </aside>

                <div
                    ref={paneRef}
                    className="min-w-0 flex-1 space-y-3 lg:overflow-y-auto lg:overscroll-contain lg:pb-6 lg:pr-1"
                    onKeyDown={onDaysKeyDown}
                    onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
                    }}
                >
                    <PlanHeader
                        mode={mode}
                        isNew={isNew}
                        state={state}
                        onField={(field, value) => dispatch({ type: 'setField', field, value })}
                        studentLocked={props.studentLocked || !isNew}
                        studentName={studentName}
                        students={studentsApi.data}
                        studentsLoading={studentsApi.isLoading}
                        active={active}
                        activating={activating}
                        onActivate={() => void activate()}
                        issues={issueMaps.plan}
                        stats={stats}
                        sourceNote={props.sourceNote ?? null}
                        autoFocusStudent={mode === 'plan' && isNew && !state.studentId && !props.studentLocked}
                        titleRef={titleRef}
                    />

                    {stats.exercises > 0 && (
                        <div
                            aria-hidden
                            className={cn(
                                'sticky top-0 z-10 hidden gap-x-2 border-b border-border/60 bg-background/95 px-[13px] py-1 text-xs font-medium text-muted-foreground backdrop-blur md:grid',
                                ROW_GRID_MD
                            )}
                        >
                            <span />
                            <span className="text-center">#</span>
                            <span className="pl-1">Exercício</span>
                            <span className="text-center">Séries</span>
                            <span className="pl-2">Reps</span>
                            <span className="pl-2">Desc. (s)</span>
                            <span className="pl-2">Observações</span>
                            <span />
                        </div>
                    )}

                    {state.days.map((day, index) => (
                        <WorkoutDayCard
                            key={day.key}
                            day={day}
                            index={index}
                            totalDays={state.days.length}
                            isActive={day.key === activeDay?.key}
                            isFirstDay={index === 0}
                            isLastDay={index === state.days.length - 1}
                            collapsed={collapsedDays.has(day.key)}
                            onToggleCollapse={toggleCollapse}
                            nameError={issueMaps.dayNames[day.key]}
                            itemIssues={issueMaps.items}
                            flashKey={flashKey}
                            dropIndex={dropTarget?.dayKey === day.key ? dropTarget.index : null}
                            dragActive={dragActive}
                            allDays={allDays}
                            {...handlers}
                            {...dragHandlers}
                            onRemoveDay={removeDay}
                            onAddExercise={addExerciseToDay}
                            onSwap={startSwap}
                            onRemoveItem={removeItem}
                        />
                    ))}

                    <button
                        type="button"
                        onClick={addDay}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#F88022]/60 hover:text-[#F88022]"
                    >
                        <Plus className="h-4 w-4" /> Adicionar dia de treino
                    </button>

                    <p className="hidden pb-2 text-center text-xs text-muted-foreground lg:block">
                        Enter avança para o próximo campo · Alt ↑/↓ move a linha · ↑/↓ troca de linha · {mod}Z desfaz remoção · {mod}S salva
                    </p>
                </div>
            </div>

            {/* Undo bar */}
            {undoVisible && lastUndo && (
                <div className="fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm shadow-xl lg:bottom-6">
                    <span className="max-w-[260px] truncate text-foreground sm:max-w-[420px]">{lastUndo.message}</span>
                    <button
                        type="button"
                        onClick={undo}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-[#F88022] hover:bg-[#F88022]/10"
                    >
                        <Undo2 className="h-4 w-4" /> Desfazer
                        <kbd className="hidden rounded border border-border px-1 text-xs font-medium text-muted-foreground lg:inline">{mod}Z</kbd>
                    </button>
                    <button
                        type="button"
                        onClick={() => setUndoVisible(false)}
                        aria-label="Fechar"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Mobile action bar */}
            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 border-t border-border bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
                <button
                    type="button"
                    onClick={() => {
                        setSwapItemKey(null);
                        setMobileLibraryOpen(true);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-semibold text-foreground"
                >
                    <Library className="h-4 w-4" /> Exercícios
                </button>
                <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F88022] py-2 text-sm font-semibold text-white disabled:opacity-70"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isDirty ? <AlertCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    Salvar
                </button>
            </div>

            {/* Mobile library */}
            <Dialog
                open={mobileLibraryOpen}
                onOpenChange={(open) => {
                    setMobileLibraryOpen(open);
                    if (!open) setSwapItemKey(null);
                }}
            >
                <DialogContent
                    className="flex h-[88dvh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0"
                    onEscapeKeyDown={(event) => {
                        // First Esc clears the search (handled by the input), the next one closes.
                        if (mobileSearchRef.current?.value) event.preventDefault();
                    }}
                >
                    <DialogTitle className="sr-only">Biblioteca de exercícios</DialogTitle>
                    <ExerciseLibrary {...libraryProps} inputRef={mobileSearchRef} autoFocus className="min-h-0 flex-1 pt-6" />
                    <div className="border-t border-border p-3">
                        <button
                            type="button"
                            onClick={() => setMobileLibraryOpen(false)}
                            className="w-full rounded-lg bg-[#F88022] py-2 text-sm font-semibold text-white"
                        >
                            Concluir
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            <ExerciseFormDialog
                open={createName !== null}
                onOpenChange={(open) => {
                    if (!open) setCreateName(null);
                }}
                initialName={createName ?? ''}
                variant="quick"
                knownMuscleGroups={knownMuscleGroups}
                knownEquipments={knownEquipments}
                onSaved={(exercise) => onExerciseCreated(exercise)}
            />

            <ImportDayDialog
                open={importDayKey !== null}
                onOpenChange={(open) => {
                    if (!open) setImportDayKey(null);
                }}
                targetDayName={importTargetDay?.name || 'o dia'}
                excludePlanId={mode === 'plan' ? entityId : null}
                onImport={(days: ApiPlanDay[], importMode) => {
                    const targetKey = importDayKey;
                    const imported = apiDaysToEditor(days, false);
                    if (importMode === 'append' && targetKey) {
                        const items = imported.flatMap((day) => day.items);
                        dispatch({ type: 'addItems', dayKey: targetKey, items });
                        if (items.length) setFlashKey(items[items.length - 1].key);
                        toast.success(
                            items.length === 1 ? '1 exercício importado' : `${items.length} exercícios importados`,
                            `Adicionados em ${importTargetDay?.name || 'o dia'}`
                        );
                    } else {
                        let afterKey = targetKey ?? undefined;
                        imported.forEach((day) => {
                            dispatch({ type: 'addDay', day, afterKey });
                            afterKey = day.key;
                        });
                        toast.success(imported.length === 1 ? 'Dia importado' : `${imported.length} dias importados`);
                    }
                }}
            />
        </div>
    );
}

