import {
    formatRestInput,
    parsePerSetReps,
    parseRestBySetJson,
    parseRestInput,
} from '@/lib/workout-reps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorMode = 'plan' | 'template';

/** Exercise as returned by GET /api/exercises. */
export interface LibraryExercise {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string | null;
    difficulty: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    personalId: string | null;
    instructions?: string | null;
    tips?: string | null;
    createdAt?: string;
}

export interface EditorItem {
    /** Stable client id (React key, DnD, focus). */
    key: string;
    /** WorkoutItem id when the row came from the server; sent back so the row is updated in place. */
    id: string | null;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    /** Raw input values; parsed and validated on save. */
    sets: string;
    reps: string;
    /** "60" or per set "60/60/90". */
    rest: string;
    notes: string;
}

export interface EditorDay {
    key: string;
    /** WorkoutDay id when it came from the server (students' history references it). */
    id: string | null;
    name: string;
    dayOfWeek: number;
    items: EditorItem[];
}

export interface EditorState {
    title: string;
    description: string;
    studentId: string;
    startDate: string;
    endDate: string;
    days: EditorDay[];
    activeDayKey: string | null;
}

/** Shapes returned by the plan/template endpoints (only the fields the editor reads). */
export interface ApiExerciseRef {
    id: string;
    name: string;
    muscleGroup: string;
}

export interface ApiPlanItem {
    id: string;
    exerciseId: string;
    sets: number;
    reps: string;
    rest: number;
    restBySet?: string | null;
    notes?: string | null;
    exercise?: ApiExerciseRef | null;
}

export interface ApiPlanDay {
    id: string;
    name: string;
    dayOfWeek: number;
    items: ApiPlanItem[];
}

export interface ApiPlan {
    id: string;
    title: string;
    studentId: string;
    startDate: string;
    endDate: string;
    active: boolean;
    version: number;
    updatedAt?: string;
    student?: { id?: string; user?: { name?: string | null } | null } | null;
    workoutDays: ApiPlanDay[];
}

export interface ApiTemplate {
    id: string;
    title: string;
    description?: string | null;
    updatedAt?: string;
    createdAt?: string;
    templateDays: ApiPlanDay[];
}

// ---------------------------------------------------------------------------
// Constants & small helpers
// ---------------------------------------------------------------------------

/** Week order used in selects: Monday first. Values follow the API (0 = Sunday … 6 = Saturday). */
export const WEEKDAY_OPTIONS = [
    { value: 1, short: 'Seg', label: 'Segunda' },
    { value: 2, short: 'Ter', label: 'Terça' },
    { value: 3, short: 'Qua', label: 'Quarta' },
    { value: 4, short: 'Qui', label: 'Quinta' },
    { value: 5, short: 'Sex', label: 'Sexta' },
    { value: 6, short: 'Sáb', label: 'Sábado' },
    { value: 0, short: 'Dom', label: 'Domingo' },
];

export const DEFAULT_SETS = '3';
export const DEFAULT_REPS = '10-12';
export const DEFAULT_REST = '60';

let keyCounter = 0;
export function newKey(prefix: string) {
    keyCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${keyCounter.toString(36)}`;
}

export function dayLetter(index: number) {
    return String.fromCharCode(65 + (index % 26));
}

/** Next weekday after the last day that is not used yet (first day: Monday). */
export function nextDayOfWeek(days: EditorDay[]): number {
    if (days.length === 0) return 1;
    const used = new Set(days.map((day) => day.dayOfWeek));
    const last = days[days.length - 1].dayOfWeek;
    for (let step = 1; step <= 7; step++) {
        const candidate = (last + step) % 7;
        if (!used.has(candidate)) return candidate;
    }
    return (last + 1) % 7;
}

/** "Treino A", "Treino B"… skipping letters already used by names like "Treino C". */
export function nextDayName(days: EditorDay[]): string {
    const used = new Set(days.map((day) => day.name.trim().toLowerCase()));
    for (let index = days.length; index < days.length + 26; index++) {
        const name = `Treino ${dayLetter(index)}`;
        if (!used.has(name.toLowerCase())) return name;
    }
    return `Treino ${days.length + 1}`;
}

export function createDay(days: EditorDay[], overrides: Partial<EditorDay> = {}): EditorDay {
    return {
        key: newKey('day'),
        id: null,
        name: nextDayName(days),
        dayOfWeek: nextDayOfWeek(days),
        items: [],
        ...overrides,
    };
}

export function createItem(exercise: Pick<LibraryExercise, 'id' | 'name' | 'muscleGroup'>, base?: Partial<EditorItem>): EditorItem {
    return {
        key: newKey('item'),
        id: null,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: DEFAULT_SETS,
        reps: DEFAULT_REPS,
        rest: DEFAULT_REST,
        notes: '',
        ...base,
    };
}

/** Copy of an item/day with fresh keys and no server ids (duplicate, import). */
export function cloneItem(item: EditorItem): EditorItem {
    return { ...item, key: newKey('item'), id: null };
}

export function cloneDay(day: EditorDay, overrides: Partial<EditorDay> = {}): EditorDay {
    return { ...day, key: newKey('day'), id: null, items: day.items.map(cloneItem), ...overrides };
}

// ---------------------------------------------------------------------------
// API → editor
// ---------------------------------------------------------------------------

export function apiItemToEditor(item: ApiPlanItem, keepIds: boolean): EditorItem {
    const restBySet = parseRestBySetJson(item.restBySet);
    return {
        key: newKey('item'),
        id: keepIds ? item.id : null,
        exerciseId: item.exerciseId,
        exerciseName: item.exercise?.name ?? 'Exercício removido',
        muscleGroup: item.exercise?.muscleGroup ?? '',
        sets: String(item.sets ?? ''),
        reps: item.reps ?? '',
        rest: formatRestInput(item.rest ?? 0, restBySet),
        notes: item.notes ?? '',
    };
}

export function apiDaysToEditor(days: ApiPlanDay[], keepIds: boolean): EditorDay[] {
    return days.map((day) => ({
        key: newKey('day'),
        id: keepIds ? day.id : null,
        name: day.name,
        dayOfWeek: day.dayOfWeek >= 0 && day.dayOfWeek <= 6 ? day.dayOfWeek : 0,
        items: day.items.map((item) => apiItemToEditor(item, keepIds)),
    }));
}

export function emptyState(overrides: Partial<EditorState> = {}): EditorState {
    return {
        title: '',
        description: '',
        studentId: '',
        startDate: '',
        endDate: '',
        days: [],
        activeDayKey: null,
        ...overrides,
    };
}

/** Makes sure there is at least one day and an active day. */
export function withActiveDay(state: EditorState): EditorState {
    const days = state.days.length ? state.days : [createDay([])];
    const activeDayKey = days.some((day) => day.key === state.activeDayKey) ? state.activeDayKey : days[0].key;
    return { ...state, days, activeDayKey };
}

// ---------------------------------------------------------------------------
// Editor → API
// ---------------------------------------------------------------------------

export interface ItemPayload {
    id?: string | null;
    exerciseId: string;
    sets: number;
    reps: string;
    rest: number;
    restBySet: string | null;
    notes: string;
    order: number;
}

export interface DayPayload {
    id?: string | null;
    name: string;
    dayOfWeek: number;
    items: ItemPayload[];
}

/** Assumes the state passed validation. With `includeIds`, new rows are sent with `id: null`. */
export function daysToPayload(days: EditorDay[], includeIds: boolean): DayPayload[] {
    return days.map((day) => ({
        ...(includeIds ? { id: day.id } : {}),
        name: day.name.trim(),
        dayOfWeek: day.dayOfWeek,
        items: day.items.map((item, index) => {
            const sets = Number.parseInt(item.sets, 10);
            const rest = parseRestInput(item.rest, sets) ?? { rest: 0, restBySet: null };
            return {
                ...(includeIds ? { id: item.id } : {}),
                exerciseId: item.exerciseId,
                sets,
                reps: item.reps.trim(),
                rest: rest.rest,
                restBySet: rest.restBySet ? JSON.stringify(rest.restBySet) : null,
                notes: item.notes.trim(),
                order: index,
            };
        }),
    }));
}

/** What counts as "unsaved changes" (keys, ids and the active day are UI details). */
export function serializeForDirty(state: EditorState): string {
    return JSON.stringify([
        state.title.trim(),
        state.description.trim(),
        state.studentId,
        state.startDate,
        state.endDate,
        state.days.map((day) => [
            day.name.trim(),
            day.dayOfWeek,
            day.items.map((item) => [item.exerciseId, item.sets.trim(), item.reps.trim(), item.rest.trim(), item.notes.trim()]),
        ]),
    ]);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ItemField = 'exercise' | 'sets' | 'reps' | 'rest' | 'notes';

export interface ValidationIssue {
    /** `plan:title`, `day:<key>:name`, `item:<key>:<field>` */
    id: string;
    message: string;
    dayKey?: string;
    itemKey?: string;
    field?: ItemField | 'name' | 'title' | 'student' | 'startDate' | 'endDate';
}

export const issueId = {
    plan: (field: string) => `plan:${field}`,
    day: (dayKey: string) => `day:${dayKey}:name`,
    item: (itemKey: string, field: ItemField) => `item:${itemKey}:${field}`,
};

export function validateEditor(
    state: EditorState,
    options: { mode: EditorMode; requireStudent: boolean }
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const push = (issue: ValidationIssue) => issues.push(issue);

    if (!state.title.trim()) {
        push({ id: issueId.plan('title'), field: 'title', message: options.mode === 'template' ? 'Informe o nome do modelo' : 'Informe o título da ficha' });
    }
    if (options.mode === 'plan') {
        if (options.requireStudent && !state.studentId) {
            push({ id: issueId.plan('student'), field: 'student', message: 'Selecione o aluno' });
        }
        if (!state.startDate) push({ id: issueId.plan('startDate'), field: 'startDate', message: 'Informe a data de início' });
        if (!state.endDate) push({ id: issueId.plan('endDate'), field: 'endDate', message: 'Informe a data de término' });
        if (state.startDate && state.endDate && state.endDate < state.startDate) {
            push({ id: issueId.plan('endDate'), field: 'endDate', message: 'A data de término deve ser depois do início' });
        }
    }
    if (state.days.length === 0) {
        push({ id: issueId.plan('days'), message: 'Adicione pelo menos um dia de treino' });
    }

    state.days.forEach((day, dayIndex) => {
        const dayLabel = day.name.trim() || `Dia ${dayIndex + 1}`;
        if (!day.name.trim()) {
            push({ id: issueId.day(day.key), dayKey: day.key, field: 'name', message: `Dia ${dayIndex + 1}: informe o nome do treino` });
        }
        day.items.forEach((item, itemIndex) => {
            const where = `${dayLabel} · linha ${itemIndex + 1}`;
            const base = { dayKey: day.key, itemKey: item.key };
            if (!item.exerciseId) {
                push({ ...base, id: issueId.item(item.key, 'exercise'), field: 'exercise', message: `${where}: selecione o exercício` });
            }
            const sets = Number(item.sets.trim());
            if (!item.sets.trim()) {
                push({ ...base, id: issueId.item(item.key, 'sets'), field: 'sets', message: `${where}: informe as séries` });
            } else if (!Number.isInteger(sets) || sets < 1 || sets > 12) {
                push({ ...base, id: issueId.item(item.key, 'sets'), field: 'sets', message: `${where}: Séries: use de 1 a 12 (limite do app do aluno)` });
            }
            const trimmedReps = item.reps.trim();
            const lowerReps = trimmedReps.toLowerCase();
            if (!trimmedReps || lowerReps === 'reps' || lowerReps.includes('definir')) {
                push({ ...base, id: issueId.item(item.key, 'reps'), field: 'reps', message: `${where}: Informe as repetições` });
            } else if (trimmedReps.length > 60) {
                push({ ...base, id: issueId.item(item.key, 'reps'), field: 'reps', message: `${where}: repetições com no máximo 60 caracteres` });
            }
            if (!item.rest.trim()) {
                push({ ...base, id: issueId.item(item.key, 'rest'), field: 'rest', message: `${where}: informe o descanso em segundos` });
            } else if (!parseRestInput(item.rest, Number.isInteger(sets) ? sets : 0)) {
                push({ ...base, id: issueId.item(item.key, 'rest'), field: 'rest', message: `${where}: Descanso: use até 600 s (10 min)` });
            } else if (options.mode === 'template' && parsePerSetReps(item.rest).length > 1) {
                push({ ...base, id: issueId.item(item.key, 'rest'), field: 'rest', message: `${where}: Modelos guardam um único descanso; use um valor (ex.: 90)` });
            }
            if (item.notes.length > 1000) {
                push({ ...base, id: issueId.item(item.key, 'notes'), field: 'notes', message: `${where}: observações com no máximo 1000 caracteres` });
            }
        });
    });

    return issues;
}

/** Non-blocking hint: "12/10/8" typed for 4 sets. */
export function repsSetsMismatch(item: EditorItem): string | null {
    const perSet = parsePerSetReps(item.reps);
    const sets = Number.parseInt(item.sets, 10);
    if (perSet.length > 1 && Number.isInteger(sets) && sets > 0 && perSet.length !== sets) {
        return `${perSet.length} valores de repetições para ${sets} séries`;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type EditorAction =
    | { type: 'init'; state: EditorState }
    | { type: 'setField'; field: 'title' | 'description' | 'studentId' | 'startDate' | 'endDate'; value: string }
    | { type: 'setActiveDay'; dayKey: string }
    | { type: 'addDay'; day?: EditorDay; afterKey?: string; activate?: boolean }
    | { type: 'updateDay'; dayKey: string; patch: Partial<Pick<EditorDay, 'name' | 'dayOfWeek'>> }
    | { type: 'removeDay'; dayKey: string }
    | { type: 'restoreDay'; day: EditorDay; index: number }
    | { type: 'duplicateDay'; dayKey: string }
    | { type: 'moveDay'; dayKey: string; delta: -1 | 1 }
    | { type: 'addItems'; dayKey: string; items: EditorItem[]; index?: number }
    | { type: 'updateItem'; itemKey: string; patch: Partial<Omit<EditorItem, 'key'>> }
    | { type: 'removeItem'; itemKey: string }
    | { type: 'restoreItem'; dayKey: string; index: number; item: EditorItem }
    | { type: 'duplicateItem'; itemKey: string }
    | { type: 'moveItem'; itemKey: string; toDayKey: string; toIndex: number }
    | { type: 'moveItemBy'; itemKey: string; delta: -1 | 1 }
    | { type: 'applyServerIds'; dayIds: Record<string, string>; itemIds: Record<string, string> };

export function findItem(state: EditorState, itemKey: string): { day: EditorDay; dayIndex: number; item: EditorItem; index: number } | null {
    for (let dayIndex = 0; dayIndex < state.days.length; dayIndex++) {
        const day = state.days[dayIndex];
        const index = day.items.findIndex((item) => item.key === itemKey);
        if (index >= 0) return { day, dayIndex, item: day.items[index], index };
    }
    return null;
}

function mapDay(state: EditorState, dayKey: string, fn: (day: EditorDay) => EditorDay): EditorState {
    return { ...state, days: state.days.map((day) => (day.key === dayKey ? fn(day) : day)) };
}

function insertAt<T>(list: T[], index: number, values: T[]): T[] {
    const clamped = Math.max(0, Math.min(index, list.length));
    return [...list.slice(0, clamped), ...values, ...list.slice(clamped)];
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'init':
            return withActiveDay(action.state);

        case 'setField':
            return { ...state, [action.field]: action.value };

        case 'setActiveDay':
            return state.activeDayKey === action.dayKey ? state : { ...state, activeDayKey: action.dayKey };

        case 'addDay': {
            const day = action.day ?? createDay(state.days);
            const afterIndex = action.afterKey ? state.days.findIndex((d) => d.key === action.afterKey) : -1;
            const days = afterIndex >= 0 ? insertAt(state.days, afterIndex + 1, [day]) : [...state.days, day];
            return { ...state, days, activeDayKey: action.activate === false ? state.activeDayKey : day.key };
        }

        case 'updateDay':
            return mapDay(state, action.dayKey, (day) => ({ ...day, ...action.patch }));

        case 'removeDay': {
            const index = state.days.findIndex((day) => day.key === action.dayKey);
            if (index < 0) return state;
            const days = state.days.filter((day) => day.key !== action.dayKey);
            const activeDayKey =
                state.activeDayKey === action.dayKey ? (days[Math.min(index, days.length - 1)]?.key ?? null) : state.activeDayKey;
            return { ...state, days, activeDayKey };
        }

        case 'restoreDay':
            return { ...state, days: insertAt(state.days, action.index, [action.day]), activeDayKey: action.day.key };

        case 'duplicateDay': {
            const index = state.days.findIndex((day) => day.key === action.dayKey);
            if (index < 0) return state;
            const source = state.days[index];
            const copy = cloneDay(source, { name: `${source.name} (cópia)`, dayOfWeek: nextDayOfWeek(state.days) });
            return { ...state, days: insertAt(state.days, index + 1, [copy]), activeDayKey: copy.key };
        }

        case 'moveDay': {
            const index = state.days.findIndex((day) => day.key === action.dayKey);
            const target = index + action.delta;
            if (index < 0 || target < 0 || target >= state.days.length) return state;
            const days = [...state.days];
            [days[index], days[target]] = [days[target], days[index]];
            return { ...state, days };
        }

        case 'addItems':
            return mapDay(state, action.dayKey, (day) => ({
                ...day,
                items: insertAt(day.items, action.index ?? day.items.length, action.items),
            }));

        case 'updateItem': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            return mapDay(state, found.day.key, (day) => ({
                ...day,
                items: day.items.map((item) => (item.key === action.itemKey ? { ...item, ...action.patch } : item)),
            }));
        }

        case 'removeItem': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            return mapDay(state, found.day.key, (day) => ({ ...day, items: day.items.filter((item) => item.key !== action.itemKey) }));
        }

        case 'restoreItem': {
            const dayKey = state.days.some((day) => day.key === action.dayKey) ? action.dayKey : state.activeDayKey;
            if (!dayKey) return state;
            return mapDay(state, dayKey, (day) => ({ ...day, items: insertAt(day.items, action.index, [action.item]) }));
        }

        case 'duplicateItem': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            return mapDay(state, found.day.key, (day) => ({
                ...day,
                items: insertAt(day.items, found.index + 1, [cloneItem(found.item)]),
            }));
        }

        case 'moveItem': {
            const found = findItem(state, action.itemKey);
            if (!found || !state.days.some((day) => day.key === action.toDayKey)) return state;
            let toIndex = action.toIndex;
            if (found.day.key === action.toDayKey && found.index < toIndex) toIndex -= 1;
            if (found.day.key === action.toDayKey && found.index === toIndex) return state;
            const removed = mapDay(state, found.day.key, (day) => ({
                ...day,
                items: day.items.filter((item) => item.key !== action.itemKey),
            }));
            return mapDay(removed, action.toDayKey, (day) => ({ ...day, items: insertAt(day.items, toIndex, [found.item]) }));
        }

        case 'moveItemBy': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            const target = found.index + action.delta;
            if (target >= 0 && target < found.day.items.length) {
                return mapDay(state, found.day.key, (day) => {
                    const items = [...day.items];
                    [items[found.index], items[target]] = [items[target], items[found.index]];
                    return { ...day, items };
                });
            }
            // Past the edge of the day: jump to the end of the previous day / start of the next one.
            const neighbour = state.days[found.dayIndex + action.delta];
            if (!neighbour) return state;
            return editorReducer(
                { ...state, activeDayKey: neighbour.key },
                { type: 'moveItem', itemKey: action.itemKey, toDayKey: neighbour.key, toIndex: action.delta < 0 ? neighbour.items.length : 0 }
            );
        }

        case 'applyServerIds':
            return {
                ...state,
                days: state.days.map((day) => ({
                    ...day,
                    id: action.dayIds[day.key] ?? day.id,
                    items: day.items.map((item) => ({ ...item, id: action.itemIds[item.key] ?? item.id })),
                })),
            };

        default:
            return state;
    }
}

/** Maps the ids of a saved plan back onto the keys that were sent (same order as the payload). */
export function collectServerIds(sentDays: EditorDay[], savedDays: ApiPlanDay[]) {
    const dayIds: Record<string, string> = {};
    const itemIds: Record<string, string> = {};
    sentDays.forEach((day, dayIndex) => {
        const saved = savedDays[dayIndex];
        if (!saved) return;
        dayIds[day.key] = saved.id;
        day.items.forEach((item, itemIndex) => {
            const savedItem = saved.items[itemIndex];
            if (savedItem) itemIds[item.key] = savedItem.id;
        });
    });
    return { dayIds, itemIds };
}
