import { describeGroups, findGroupIssues, type GroupInfo } from '@/lib/workout-groups';
import { formatLoadInput, normalizeLoadInput, normalizeRpeInput } from '@/lib/workout-load';
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
    /** Prescribed load in kg as typed: "" (none), "20" or per set "20/22,5/25". */
    load: string;
    /** Prescribed RPE as typed: "" (none), "8", "8,5" or "7-8". */
    rpe: string;
    notes: string;
    /**
     * Superset (bi-set, tri-set, circuito): consecutive rows of the day sharing this id; null when ungrouped.
     * Every member has the same séries and holds the group's descanso — the rest after each round, shown on
     * the last member. Only the last member is saved with it; the others are saved with 0.
     */
    groupId: string | null;
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
    /** Stored load: "20" or "20/22.5/25" (dot decimals). */
    load?: string | null;
    /** Stored RPE: "8", "8.5" or "7-8". */
    rpe?: string | null;
    /** Superset id shared by consecutive items of the day (bi-set, tri-set, circuito). */
    groupId?: string | null;
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
/** Limit of the student app. */
export const MAX_SETS = 12;

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
        load: '',
        rpe: '',
        notes: '',
        groupId: null,
        ...base,
    };
}

/** Copy of an item with a fresh key and no server id; it stays in the same group (duplicate row). */
export function cloneItem(item: EditorItem): EditorItem {
    return { ...item, key: newKey('item'), id: null };
}

/** Copy of a day: fresh keys, no server ids and the same grouping under new group ids. */
export function cloneDay(day: EditorDay, overrides: Partial<EditorDay> = {}): EditorDay {
    return { ...day, key: newKey('day'), id: null, items: withFreshGroupIds(day.items.map(cloneItem)), ...overrides };
}

/** "g_" + 6 random characters, not in `taken` (group ids only need to be unique within a day). */
export function newGroupId(taken: Iterable<string | null | undefined> = []): string {
    const used = new Set<string>();
    for (const id of Array.from(taken)) if (id) used.add(id);
    for (;;) {
        const id = `g_${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}`;
        if (!used.has(id)) return id;
    }
}

/**
 * Same grouping with new group ids, also different from `taken` (a duplicated or imported day never
 * shares ids with the rows it came from, so rows moved between days can't merge into another group).
 */
export function withFreshGroupIds(items: EditorItem[], taken: Iterable<string | null | undefined> = []): EditorItem[] {
    const used = new Set<string>();
    for (const id of Array.from(taken)) if (id) used.add(id);
    const renamed = new Map<string, string>();
    return items.map((item) => {
        if (!item.groupId) return item;
        let id = renamed.get(item.groupId);
        if (!id) {
            id = newGroupId(used);
            used.add(id);
            renamed.set(item.groupId, id);
        }
        return { ...item, groupId: id };
    });
}

// ---------------------------------------------------------------------------
// API → editor
// ---------------------------------------------------------------------------

/** Stored RPE shown in the input with pt-BR decimals: "8.5" → "8,5", "7-8" → "7-8". */
export function formatRpeInput(stored: string | null | undefined): string {
    return (stored ?? '').trim().replace(/\./g, ',');
}

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
        // A stored value the helpers can't read is shown as is (validation flags it) instead of being dropped on save.
        load: formatLoadInput(item.load) || (item.load ?? '').trim(),
        rpe: formatRpeInput(item.rpe),
        notes: item.notes ?? '',
        groupId: item.groupId?.trim() || null,
    };
}

/**
 * Grouped items before the last one are stored with rest 0: in the editor every member holds the
 * group's rest (the last member's), so a row that leaves the group gets it back.
 */
export function apiDaysToEditor(days: ApiPlanDay[], keepIds: boolean): EditorDay[] {
    return days.map((day) => ({
        key: newKey('day'),
        id: keepIds ? day.id : null,
        name: day.name,
        dayOfWeek: day.dayOfWeek >= 0 && day.dayOfWeek <= 6 ? day.dayOfWeek : 0,
        items: enforceDayGroups(day.items.map((item) => apiItemToEditor(item, keepIds))),
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

/** Drafts stored before load/RPE/groups existed have no such fields: fill them so the inputs stay controlled. */
export function upgradeEditorState(state: EditorState): EditorState {
    return enforceGroups({
        ...state,
        days: state.days.map((day) => ({
            ...day,
            items: day.items.map((item) => ({ ...item, load: item.load ?? '', rpe: item.rpe ?? '', groupId: item.groupId ?? null })),
        })),
    });
}

// ---------------------------------------------------------------------------
// Supersets (bi-set, tri-set, circuito)
// ---------------------------------------------------------------------------

/** Séries as a number for the shared group helpers (-1 while the field is empty or invalid). */
function setsCount(item: EditorItem): number {
    const sets = Number.parseInt(item.sets, 10);
    return Number.isFinite(sets) ? sets : -1;
}

const groupable = (items: EditorItem[]) => items.map((item) => ({ groupId: item.groupId, sets: setsCount(item) }));

/** Letter, position and label of each row's group ("A1", "Bi-set A"); null for ungrouped rows. */
export function describeEditorGroups(items: EditorItem[]): Array<GroupInfo | null> {
    return describeGroups(groupable(items));
}

/** First and last index of the group block around `index` (null when that row isn't grouped). */
export function groupBlock(items: EditorItem[], index: number): { start: number; end: number } | null {
    const id = items[index]?.groupId;
    if (!id) return null;
    let start = index;
    while (start > 0 && items[start - 1].groupId === id) start--;
    let end = index;
    while (end < items.length - 1 && items[end + 1].groupId === id) end++;
    return { start, end };
}

/**
 * A row can't land between two exercises of a group it doesn't belong to: an insertion index inside
 * such a block moves to the edge of the block — past the group in the direction the row is moving
 * (`fromIndex`, same list), or to the nearest edge when it comes from elsewhere. Members of the group
 * (`groupId`) reorder freely inside it.
 */
export function snapInsertIndex(
    items: EditorItem[],
    index: number,
    moving: { groupId?: string | null; fromIndex?: number } = {}
): number {
    const at = Math.max(0, Math.min(index, items.length));
    const id = items[at - 1]?.groupId;
    if (!id || items[at]?.groupId !== id || moving.groupId === id) return at;
    const block = groupBlock(items, at)!;
    if (moving.fromIndex !== undefined && moving.fromIndex >= 0) {
        return moving.fromIndex < block.start ? block.end + 1 : block.start;
    }
    return at - block.start <= block.end + 1 - at ? block.start : block.end + 1;
}

/**
 * Keeps a day's groups valid after any change: each group is one contiguous block of 2+ rows — a
 * member that ended up away from its block leaves the group (the largest block keeps it) and a group
 * left with one row is dissolved — and every member holds the group's rest, the last member's.
 * Returns the same array when nothing changed.
 */
export function enforceDayGroups(items: EditorItem[]): EditorItem[] {
    type Run = { id: string; start: number; end: number };
    const runs: Run[] = [];
    items.forEach((item, index) => {
        const id = typeof item.groupId === 'string' && item.groupId.trim() ? item.groupId : null;
        if (!id) return;
        const last = runs[runs.length - 1];
        if (last && last.id === id && last.end === index - 1) last.end = index;
        else runs.push({ id, start: index, end: index });
    });
    const size = (run: Run) => run.end - run.start + 1;
    const kept = new Map<string, Run>();
    runs.forEach((run) => {
        const current = kept.get(run.id);
        if (!current || size(run) > size(current)) kept.set(run.id, run);
    });

    const next = [...items];
    let changed = false;
    const patch = (index: number, changes: Partial<EditorItem>) => {
        next[index] = { ...next[index], ...changes };
        changed = true;
    };
    items.forEach((item, index) => {
        // Empty ids and drafts saved before groups existed.
        if (item.groupId !== null && !(typeof item.groupId === 'string' && item.groupId.trim())) patch(index, { groupId: null });
    });
    runs.forEach((run) => {
        const keep = kept.get(run.id) === run && size(run) >= 2;
        const rest = items[run.end].rest;
        for (let index = run.start; index <= run.end; index++) {
            if (!keep) patch(index, { groupId: null });
            else if (items[index].rest !== rest) patch(index, { rest });
        }
    });
    return changed ? next : items;
}

/** `enforceDayGroups` on every day; the same state when nothing changed. */
export function enforceGroups(state: EditorState): EditorState {
    let changed = false;
    const days = state.days.map((day) => {
        const items = enforceDayGroups(day.items);
        if (items === day.items) return day;
        changed = true;
        return { ...day, items };
    });
    return changed ? { ...state, days } : state;
}

/** Valid séries as text ("3"), or null. */
function validSets(item: EditorItem): string | null {
    const text = item.sets.trim();
    const sets = Number(text);
    return text && Number.isInteger(sets) && sets >= 1 && sets <= MAX_SETS ? String(sets) : null;
}

/** Rows grouped by "Agrupar com o próximo" on row `index`: its group (or itself) plus the next row's group (or row). */
function groupWithNextMembers(items: EditorItem[], index: number): EditorItem[] | null {
    const current = items[index];
    const next = items[index + 1];
    if (!current || !next || (current.groupId && current.groupId === next.groupId)) return null;
    const ids = new Set([current.groupId, next.groupId].filter(Boolean));
    return items.filter(
        (item) => item.key === current.key || item.key === next.key || (item.groupId !== null && ids.has(item.groupId))
    );
}

export interface GroupingPlan {
    /** Size of the resulting group (2 = bi-set…). */
    size: number;
    /** Séries every member will have: the row where the action started, else the first valid one ("" when none is valid). */
    sets: string;
    /** Some member has other séries: equalizing needs the personal's confirmation. */
    mismatch: boolean;
}

/** What "Agrupar com o próximo" on row `index` would create; null when there is no next row outside its group. */
export function planGroupWithNext(items: EditorItem[], index: number): GroupingPlan | null {
    const members = groupWithNextMembers(items, index);
    if (!members) return null;
    const sets = validSets(items[index]) ?? members.map(validSets).find(Boolean) ?? '';
    return { size: members.length, sets, mismatch: Boolean(sets) && members.some((item) => validSets(item) !== sets) };
}

/**
 * Puts a removed row back (undo). It rejoins its group when it lands next to it (taking the group's
 * séries and rest, which may have changed meanwhile); if the removal dissolved the group, the rows
 * left alone (`peers`, still ungrouped and with the same séries) are linked to it again.
 */
function restoreIntoDay(day: EditorDay, index: number, restored: EditorItem, peers: string[] = []): EditorDay {
    const id = restored.groupId;
    const at = snapInsertIndex(day.items, index, { groupId: id });
    const items = insertAt(day.items, at, [restored]);
    if (!id) return { ...day, items };

    if (items[at - 1]?.groupId === id || items[at + 1]?.groupId === id) {
        const members = items.filter((item, position) => position !== at && item.groupId === id);
        items[at] = { ...restored, sets: members[0].sets, rest: members[members.length - 1].rest };
        return { ...day, items };
    }
    const peerKeys = new Set(peers);
    const relink = (item: EditorItem | undefined) =>
        Boolean(item && !item.groupId && peerKeys.has(item.key) && item.sets.trim() === restored.sets.trim());
    let linked = false;
    for (let position = at - 1; position >= 0 && relink(items[position]); position--) {
        items[position] = { ...items[position], groupId: id };
        linked = true;
    }
    for (let position = at + 1; position < items.length && relink(items[position]); position++) {
        items[position] = { ...items[position], groupId: id };
        linked = true;
    }
    if (!linked) items[at] = { ...restored, groupId: null };
    return { ...day, items };
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
    /** Normalized ("20", "20/22.5/25"); null clears it. */
    load: string | null;
    /** Normalized ("8", "8.5", "7-8"); null clears it. */
    rpe: string | null;
    /** Superset id (null = ungrouped); always sent so the server stores what the editor shows. */
    groupId: string | null;
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
    return days.map((day) => {
        const groups = describeEditorGroups(day.items);
        return {
            ...(includeIds ? { id: day.id } : {}),
            name: day.name.trim(),
            dayOfWeek: day.dayOfWeek,
            items: day.items.map((item, index) => {
                const group = groups[index];
                const sets = Number.parseInt(item.sets, 10);
                // In a group the rest comes after the last exercise of each round: the others are saved with 0,
                // so app versions that don't know about groups don't rest between A1 and A2 either.
                const rest =
                    group && !group.isLast
                        ? { rest: 0, restBySet: null }
                        : (parseRestInput(item.rest, sets) ?? { rest: 0, restBySet: null });
                const load = normalizeLoadInput(item.load, sets);
                const rpe = normalizeRpeInput(item.rpe);
                return {
                    ...(includeIds ? { id: item.id } : {}),
                    exerciseId: item.exerciseId,
                    sets,
                    reps: item.reps.trim(),
                    rest: rest.rest,
                    restBySet: rest.restBySet ? JSON.stringify(rest.restBySet) : null,
                    // Invalid text never gets here (validation); if it did, the API answers with the message instead of clearing it.
                    load: load.ok ? load.value : item.load.trim(),
                    rpe: rpe.ok ? rpe.value : item.rpe.trim(),
                    groupId: group?.groupId ?? null,
                    notes: item.notes.trim(),
                    order: index,
                };
            }),
        };
    });
}

/** Group structure independent of the ids: 0 = ungrouped, 1… = order of the group in the day. */
function groupOrder(items: EditorItem[]): number[] {
    const order = new Map<string, number>();
    return describeEditorGroups(items).map((group) => {
        if (!group) return 0;
        if (!order.has(group.groupId)) order.set(group.groupId, order.size + 1);
        return order.get(group.groupId)!;
    });
}

/**
 * Load/RPE as they would be stored, so "22,5", "22.5" and "22,5 kg" are the same prescription
 * (a plan loaded as "22,5" and a draft typed as "22.5" don't count as different). Text the
 * helpers reject is compared as typed.
 */
function prescriptionKey(item: EditorItem): [string, string] {
    const sets = Number.parseInt(item.sets, 10);
    const load = normalizeLoadInput(item.load, sets);
    const rpe = normalizeRpeInput(item.rpe);
    return [load.ok ? (load.value ?? '') : item.load.trim(), rpe.ok ? (rpe.value ?? '') : item.rpe.trim()];
}

/** What counts as "unsaved changes" (keys, ids, group ids and the active day are UI details). */
export function serializeForDirty(state: EditorState): string {
    return JSON.stringify([
        state.title.trim(),
        state.description.trim(),
        state.studentId,
        state.startDate,
        state.endDate,
        state.days.map((day) => {
            const groups = groupOrder(day.items);
            return [
                day.name.trim(),
                day.dayOfWeek,
                day.items.map((item, index) => [
                    item.exerciseId,
                    item.sets.trim(),
                    item.reps.trim(),
                    item.rest.trim(),
                    ...prescriptionKey(item),
                    item.notes.trim(),
                    groups[index],
                ]),
            ];
        }),
    ]);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** `group`: problems with the row's superset (shown on its A1/A2 marker). */
export type ItemField = 'exercise' | 'sets' | 'reps' | 'load' | 'rpe' | 'rest' | 'notes' | 'group';

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
        const groups = describeEditorGroups(day.items);
        day.items.forEach((item, itemIndex) => {
            const where = `${dayLabel} · linha ${itemIndex + 1}`;
            const base = { dayKey: day.key, itemKey: item.key };
            // Grouped rows before the last one have no rest of their own (it comes after the round).
            const hasRest = !groups[itemIndex] || groups[itemIndex]!.isLast;
            if (!item.exerciseId) {
                push({ ...base, id: issueId.item(item.key, 'exercise'), field: 'exercise', message: `${where}: selecione o exercício` });
            }
            const sets = Number(item.sets.trim());
            const setsValid = Boolean(item.sets.trim()) && Number.isInteger(sets) && sets >= 1 && sets <= MAX_SETS;
            if (!item.sets.trim()) {
                push({ ...base, id: issueId.item(item.key, 'sets'), field: 'sets', message: `${where}: informe as séries` });
            } else if (!setsValid) {
                push({ ...base, id: issueId.item(item.key, 'sets'), field: 'sets', message: `${where}: Séries: use de 1 a 12 (limite do app do aluno)` });
            }
            const trimmedReps = item.reps.trim();
            const lowerReps = trimmedReps.toLowerCase();
            if (!trimmedReps || lowerReps === 'reps' || lowerReps.includes('definir')) {
                push({ ...base, id: issueId.item(item.key, 'reps'), field: 'reps', message: `${where}: Informe as repetições` });
            } else if (trimmedReps.length > 60) {
                push({ ...base, id: issueId.item(item.key, 'reps'), field: 'reps', message: `${where}: repetições com no máximo 60 caracteres` });
            }
            // Optional. Per-set loads are counted against the séries only once séries is valid (its own error comes first).
            const load = normalizeLoadInput(item.load, setsValid ? sets : MAX_SETS);
            if (!load.ok) {
                push({ ...base, id: issueId.item(item.key, 'load'), field: 'load', message: `${where}: ${load.error}` });
            }
            const rpe = normalizeRpeInput(item.rpe);
            if (!rpe.ok) {
                push({ ...base, id: issueId.item(item.key, 'rpe'), field: 'rpe', message: `${where}: ${rpe.error}` });
            }
            if (!hasRest) {
                // Nothing to check: the last member holds the same value and is checked instead.
            } else if (!item.rest.trim()) {
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

        // Safety net: the reducer keeps groups contiguous and with the same séries, so this should never fire.
        findGroupIssues(groupable(day.items)).forEach((issue) => {
            const item = day.items[issue.index];
            if (!item) return;
            const field: ItemField = issue.message.includes('séries') ? 'sets' : 'group';
            const id = issueId.item(item.key, field);
            if (issues.some((existing) => existing.id === id)) return;
            push({ dayKey: day.key, itemKey: item.key, id, field, message: `${dayLabel} · linha ${issue.index + 1}: ${issue.message}` });
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
    /** Undo of a removal; `groupPeers`: keys of the other members of its group when it was removed. */
    | { type: 'restoreItem'; dayKey: string; index: number; item: EditorItem; groupPeers?: string[] }
    | { type: 'duplicateItem'; itemKey: string }
    | { type: 'moveItem'; itemKey: string; toDayKey: string; toIndex: number }
    | { type: 'moveItemBy'; itemKey: string; delta: -1 | 1 }
    /** "Agrupar com o próximo"; `sets` equalizes every member (already confirmed by the personal). */
    | { type: 'groupWithNext'; itemKey: string; sets?: string }
    /** "Desagrupar": the row leaves its group. */
    | { type: 'ungroup'; itemKey: string }
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

/** Every action goes through `enforceGroups`, so groups stay contiguous, with 2+ rows and one rest. */
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    const next = reduce(state, action);
    return next === state ? state : enforceGroups(next);
}

function reduce(state: EditorState, action: EditorAction): EditorState {
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
                // Never between two exercises of a group (the new rows aren't part of it).
                items: insertAt(day.items, snapInsertIndex(day.items, action.index ?? day.items.length), action.items),
            }));

        case 'updateItem': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            // Séries and descanso belong to the whole group: every member gets the new value.
            const groupId = found.item.groupId;
            const shared: Partial<EditorItem> = {};
            if (groupId && action.patch.sets !== undefined) shared.sets = action.patch.sets;
            if (groupId && action.patch.rest !== undefined) shared.rest = action.patch.rest;
            const sharesChange = Object.keys(shared).length > 0;
            return mapDay(state, found.day.key, (day) => ({
                ...day,
                items: day.items.map((item) =>
                    item.key === action.itemKey
                        ? { ...item, ...action.patch }
                        : sharesChange && item.groupId === groupId
                          ? { ...item, ...shared }
                          : item
                ),
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
            const item = dayKey === action.dayKey ? action.item : { ...action.item, groupId: null };
            return mapDay(state, dayKey, (day) => restoreIntoDay(day, action.index, item, action.groupPeers));
        }

        case 'duplicateItem': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            // Right after the original: a grouped row's copy joins the same group.
            return mapDay(state, found.day.key, (day) => ({
                ...day,
                items: insertAt(day.items, found.index + 1, [cloneItem(found.item)]),
            }));
        }

        case 'moveItem': {
            const found = findItem(state, action.itemKey);
            const target = state.days.find((day) => day.key === action.toDayKey);
            if (!found || !target) return state;
            const sameDay = found.day.key === target.key;
            let toIndex = snapInsertIndex(
                target.items,
                action.toIndex,
                sameDay ? { groupId: found.item.groupId, fromIndex: found.index } : {}
            );
            if (sameDay && found.index < toIndex) toIndex -= 1;
            if (sameDay && found.index === toIndex) return state;
            // In another day it leaves its group; in the same day it stays only if it lands inside its block.
            const moved = sameDay ? found.item : { ...found.item, groupId: null };
            const removed = mapDay(state, found.day.key, (day) => ({
                ...day,
                items: day.items.filter((item) => item.key !== action.itemKey),
            }));
            return mapDay(removed, target.key, (day) => ({ ...day, items: insertAt(day.items, toIndex, [moved]) }));
        }

        case 'moveItemBy': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            const items = found.day.items;
            const target = found.index + action.delta;
            if (target >= 0 && target < items.length) {
                // One step, or past a whole group the row doesn't belong to (it can't split it).
                const block = items[target].groupId !== found.item.groupId ? groupBlock(items, target) : null;
                const toIndex = action.delta < 0 ? (block ? block.start : target) : (block ? block.end : target) + 1;
                return reduce(state, { type: 'moveItem', itemKey: action.itemKey, toDayKey: found.day.key, toIndex });
            }
            // Past the edge of the day: jump to the end of the previous day / start of the next one.
            const neighbour = state.days[found.dayIndex + action.delta];
            if (!neighbour) return state;
            return reduce(
                { ...state, activeDayKey: neighbour.key },
                { type: 'moveItem', itemKey: action.itemKey, toDayKey: neighbour.key, toIndex: action.delta < 0 ? neighbour.items.length : 0 }
            );
        }

        case 'groupWithNext': {
            const found = findItem(state, action.itemKey);
            if (!found) return state;
            const current = found.item;
            const next = found.day.items[found.index + 1];
            if (!next || (current.groupId && current.groupId === next.groupId)) return state;
            // Joining an existing group keeps its id; two groups merge into the one where the action started.
            const id = current.groupId ?? next.groupId ?? newGroupId(found.day.items.map((item) => item.groupId));
            const merged = new Set([current.groupId, next.groupId].filter(Boolean));
            return mapDay(state, found.day.key, (day) => ({
                ...day,
                items: day.items.map((item) =>
                    item.key === current.key || item.key === next.key || (item.groupId !== null && merged.has(item.groupId))
                        ? { ...item, groupId: id, ...(action.sets ? { sets: action.sets } : {}) }
                        : item
                ),
            }));
        }

        case 'ungroup': {
            const found = findItem(state, action.itemKey);
            const block = found ? groupBlock(found.day.items, found.index) : null;
            if (!found || !block) return state;
            // It keeps the group's rest (every member holds it).
            const freed = { ...found.item, groupId: null };
            return mapDay(state, found.day.key, (day) => {
                const items = day.items.map((item) => (item.key === freed.key ? freed : item));
                if (found.index === block.start || found.index === block.end) return { ...day, items };
                // A middle row can't leave without splitting the group: it goes right after it.
                return { ...day, items: insertAt(items.filter((item) => item.key !== freed.key), block.end, [freed]) };
            });
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
