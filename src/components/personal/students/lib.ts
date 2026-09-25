import { invalidateApi, setApiData } from '@/hooks/use-api';
import { PLAN_TYPE_LABELS, PLAN_TYPE_MONTHS, monthlyValue } from '@/lib/student-status';
import type { StudentListItem, StudentPatch, StudentProfile, StudentUpdateResult } from './types';

// ---------------------------------------------------------------------------
// Cache keys (shared with the ⌘K palette and the plan editors)
// ---------------------------------------------------------------------------

export const STUDENTS_KEY = '/api/students';
export const profileKey = (id: string) => `/api/students/${id}?view=profile`;
export const reportKey = (id: string) => `/api/students/${id}?view=report`;

// ---------------------------------------------------------------------------
// Labels and options
// ---------------------------------------------------------------------------

export const STATUS_OPTIONS = [
    { value: 'ACTIVE', label: 'Ativo' },
    { value: 'PAUSED', label: 'Pausado' },
    { value: 'INACTIVE', label: 'Inativo' },
];
export const STATUS_LABELS: Record<string, string> = { ACTIVE: 'Ativo', PAUSED: 'Pausado', INACTIVE: 'Inativo' };

export const PAYMENT_OPTIONS = [
    { value: 'PAID', label: 'Pago' },
    { value: 'PENDENTE', label: 'Pendente' },
    { value: 'OVERDUE', label: 'Atrasado' },
];
export const PAYMENT_LABELS: Record<string, string> = { PAID: 'Pago', PENDENTE: 'Pendente', PENDING: 'Pendente', OVERDUE: 'Atrasado' };

export const PLAN_OPTIONS = Object.entries(PLAN_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const planLabel = (planType: string | null | undefined) => PLAN_TYPE_LABELS[(planType || 'MENSAL').toUpperCase()] ?? planType ?? 'Mensal';
export const planMonths = (planType: string | null | undefined) => PLAN_TYPE_MONTHS[(planType || 'MENSAL').toUpperCase()] ?? 1;
export const planPeriodLabel = (planType: string | null | undefined) => {
    const months = planMonths(planType);
    return months === 1 ? '+1 mês' : `+${months} meses`;
};

export const ACTIVITY_LEVEL_OPTIONS = [
    { value: 'SEDENTARY', label: 'Sedentário' },
    { value: 'LIGHT', label: 'Leve' },
    { value: 'MODERATE', label: 'Moderado' },
    { value: 'ACTIVE', label: 'Ativo' },
    { value: 'VERY_ACTIVE', label: 'Muito ativo' },
];
export const ACTIVITY_LEVEL_LABELS: Record<string, string> = Object.fromEntries(
    ACTIVITY_LEVEL_OPTIONS.map((option) => [option.value, option.label])
);

export const GENDER_OPTIONS = [
    { value: 'FEMALE', label: 'Feminino' },
    { value: 'MALE', label: 'Masculino' },
    { value: 'OTHER', label: 'Outro' },
];
export const GENDER_LABELS: Record<string, string> = { MALE: 'Masculino', FEMALE: 'Feminino', OTHER: 'Outro' };

export const PHOTO_ANGLE_LABELS: Record<string, string> = { FRONT: 'Frente', SIDE: 'Lado', BACK: 'Costas', OTHER: 'Outro' };

export const REMINDER_OPTIONS = [
    {
        value: 'WORKOUT_REMINDER',
        label: 'Treino',
        defaultMessage: 'Seu treino do dia já está pronto no app. Vamos manter a consistência hoje?',
    },
    {
        value: 'CHECKIN_REMINDER',
        label: 'Check-in',
        defaultMessage: 'Hora de atualizar seu peso, medidas e fotos para seu personal acompanhar sua evolução!',
    },
    {
        value: 'MEAL_REMINDER',
        label: 'Dieta',
        defaultMessage: 'Lembre-se de registrar suas refeições de hoje no app para bater suas metas nutricionais.',
    },
    {
        value: 'WATER_REMINDER',
        label: 'Hidratação',
        defaultMessage: 'Não esqueça de beber água regularmente ao longo do dia para manter sua performance e recuperação.',
    },
] as const;
export type ReminderType = (typeof REMINDER_OPTIONS)[number]['value'];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatBRL(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return currency.format(Number(value));
}

/** "R$ 100,00/mês" for plans longer than a month (annual, quarterly…); null otherwise. */
export function monthlyLabel(planType: string | null | undefined, planValue: number | null | undefined): string | null {
    if (planValue === null || planValue === undefined || planMonths(planType) <= 1) return null;
    const monthly = monthlyValue(planType, planValue);
    return monthly === null ? null : `${formatBRL(monthly)}/mês`;
}

export function formatNumber(value: number | null | undefined, suffix = ''): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return `${decimal.format(Number(value))}${suffix}`;
}

/** Signed delta such as "+1,2" / "−0,5"; null when either side is missing. */
export function formatDelta(current: number | null | undefined, previous: number | null | undefined, suffix = ''): string | null {
    if (current == null || previous == null) return null;
    const delta = Math.round((Number(current) - Number(previous)) * 10) / 10;
    if (delta === 0) return `0${suffix}`;
    return `${delta > 0 ? '+' : '−'}${decimal.format(Math.abs(delta))}${suffix}`;
}

const toDateObject = (value: string | Date | null | undefined): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    // Calendar-day fields (plan dates, due dates, birth dates) are stored at exactly 00:00 or 12:00 UTC:
    // show that calendar day instead of the previous day in Brazil (UTC-3).
    const isDateOnly =
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0 &&
        (date.getUTCHours() === 0 || date.getUTCHours() === 12);
    return isDateOnly ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) : date;
};

export function formatDate(value: string | Date | null | undefined, fallback = '—'): string {
    const date = toDateObject(value);
    return date ? date.toLocaleDateString('pt-BR') : fallback;
}

export function formatShortDate(value: string | Date | null | undefined, fallback = '—'): string {
    const date = toDateObject(value);
    return date ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : fallback;
}

/**
 * Calendar date for date-only fields (birth date). Values saved as UTC midnight by older screens
 * keep their UTC day instead of shifting to the previous day in Brazil.
 */
export function calendarDate(value: string | Date | null | undefined): Date | null {
    const date = toDateObject(value);
    if (!date) return null;
    if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) {
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function ageFrom(value: string | null | undefined): number | null {
    const birth = calendarDate(value);
    if (!birth) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Calendar days from today until the date (negative when it's in the past). */
export function daysUntil(value: string | Date | null | undefined, now: Date = new Date()): number | null {
    const date = toDateObject(value);
    if (!date) return null;
    return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);
}

export function relativeDaysLabel(days: number | null): string {
    if (days === null) return 'Nunca';
    if (days <= 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    return `Há ${days} dias`;
}

export type Tone = 'ok' | 'warn' | 'danger' | 'muted';

/** "Termina em 5 dias" / "Terminou há 3 dias" for plan end dates. */
export function planEndInfo(endDate: string | null | undefined): { label: string; tone: Tone } | null {
    const days = daysUntil(endDate);
    if (days === null) return null;
    if (days < 0) return { label: `Terminou há ${Math.abs(days)} dia${days === -1 ? '' : 's'}`, tone: 'danger' };
    if (days === 0) return { label: 'Termina hoje', tone: 'warn' };
    return { label: `Termina em ${days} dia${days === 1 ? '' : 's'}`, tone: days <= 7 ? 'warn' : 'ok' };
}

export const toneText: Record<Tone, string> = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
    muted: 'text-muted-foreground',
};

// ---------------------------------------------------------------------------
// Date inputs (yyyy-mm-dd)
// ---------------------------------------------------------------------------

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateInputValue(value: string | Date | null | undefined, options: { calendar?: boolean } = {}): string {
    const date = options.calendar ? calendarDate(value) : toDateObject(value);
    if (!date) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayInput(offsetDays = 0): string {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return toDateInputValue(date);
}

/** yyyy-mm-dd → ISO at 12:00 UTC, so the calendar day is the same in every Brazilian time zone. */
export function dateInputToIso(value: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T12:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

export const onlyDigits = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

/** wa.me link with the Brazilian country code; null when the phone is too short to be valid. */
export function whatsappUrl(phone: string | null | undefined, text?: string): string | null {
    const digits = onlyDigits(phone);
    if (digits.length < 10) return null;
    const full = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
    return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export const firstName = (name: string | null | undefined) => (name || 'Aluno').trim().split(/\s+/)[0];

// ---------------------------------------------------------------------------
// Navigation order shared by the CRM and the profile (J/K, prev/next)
// ---------------------------------------------------------------------------

export const NAV_ORDER_KEY = 'personal:student-nav-order';
const NAV_NAMES_KEY = 'personal:student-nav-names';
const CRM_QUERY_KEY = 'personal:crm-last-query';

export function saveNavOrder(students: Array<{ id: string; name: string }>) {
    try {
        window.sessionStorage.setItem(NAV_ORDER_KEY, JSON.stringify(students.map((student) => student.id)));
        window.sessionStorage.setItem(NAV_NAMES_KEY, JSON.stringify(Object.fromEntries(students.map((s) => [s.id, s.name]))));
    } catch {
        // Storage unavailable: prev/next falls back to alphabetical order.
    }
}

export function readNavOrder(): string[] | null {
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(NAV_ORDER_KEY) || 'null');
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
    } catch {
        return null;
    }
}

export function readNavNames(): Record<string, string> {
    try {
        const parsed = JSON.parse(window.sessionStorage.getItem(NAV_NAMES_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/** The CRM remembers its filters so "Voltar para alunos" returns to the same list. */
export function saveCrmQuery(search: string) {
    try {
        window.sessionStorage.setItem(CRM_QUERY_KEY, search);
    } catch {
        // ignore
    }
}

export function crmHref(): string {
    try {
        const query = window.sessionStorage.getItem(CRM_QUERY_KEY);
        return query ? `/personal/students?${query}` : '/personal/students';
    } catch {
        return '/personal/students';
    }
}

// ---------------------------------------------------------------------------
// Dialog-aware keyboard helpers
// ---------------------------------------------------------------------------

/** True when a dialog other than the CRM side drawer is open (Radix dialogs, ⌘K palette, confirmations). */
export function isOtherDialogOpen(): boolean {
    if (typeof document === 'undefined') return false;
    return Boolean(
        document.querySelector(
            '[role="dialog"][data-state="open"]:not([data-student-drawer]), [role="dialog"][aria-modal="true"]:not([data-student-drawer]), [role="alertdialog"]'
        )
    );
}

/** Buttons, links and form fields handle Enter/Space themselves. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('a[href], button, input, select, textarea, summary, [role="button"], [role="option"], [contenteditable="true"]'));
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function requestJson<T = any>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
            headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
    } catch {
        throw new Error('Sem conexão com o servidor. Verifique sua internet e tente de novo.');
    }
    let json: any = null;
    try {
        json = await response.json();
    } catch {
        json = null;
    }
    if (!response.ok || (json && typeof json === 'object' && json.success === false)) {
        const message = json?.error || json?.message;
        throw new Error(typeof message === 'string' && message ? message : `Erro ${response.status} ao processar a solicitação`);
    }
    return json as T;
}

export const errorMessage = (error: unknown, fallback = 'Algo deu errado. Tente de novo.') =>
    error instanceof Error && error.message ? error.message : fallback;

// ---------------------------------------------------------------------------
// Cache updates
// ---------------------------------------------------------------------------

class NothingCached extends Error {}

/**
 * Updates cached data in place when the key is cached; otherwise drops it so the next screen fetches fresh data.
 * (setApiData would otherwise create an entry without data, which renders as "loaded but empty".)
 */
export function patchCachedData<T>(key: string, updater: (current: T) => T): boolean {
    try {
        setApiData<T>(key, (current) => {
            if (current === undefined || current === null) throw new NothingCached();
            return updater(current);
        });
        return true;
    } catch (error) {
        if (!(error instanceof NothingCached)) throw error;
        invalidateApi((cachedKey) => cachedKey === key);
        return false;
    }
}

const SCALAR_KEYS = [
    'status',
    'goal',
    'birthDate',
    'gender',
    'height',
    'weight',
    'planType',
    'planValue',
    'planExpiresAt',
    'paymentStatus',
] as const;

function mergeScalars<T extends { user?: StudentListItem['user'] }>(target: T, update: StudentUpdateResult): T {
    const next: any = { ...target };
    SCALAR_KEYS.forEach((key) => {
        if (key in update) next[key] = (update as any)[key];
    });
    if (update.user && target.user) next.user = { ...target.user, ...update.user };
    return next;
}

/** Applies a saved student (PUT response or bulk result) to every cached view of that student. */
export function applyStudentUpdate(update: StudentUpdateResult) {
    patchCachedData<StudentListItem[]>(STUDENTS_KEY, (list) =>
        Array.isArray(list) ? list.map((student) => (student.id === update.id ? mergeScalars(student, update) : student)) : list
    );
    patchCachedData<StudentProfile>(profileKey(update.id), (profile) => {
        const merged = mergeScalars(profile, update);
        return 'anamnesis' in update ? { ...merged, anamnesis: update.anamnesis ?? null } : merged;
    });
    invalidateApi((key) => key === reportKey(update.id));
}

export function removeStudentFromCaches(id: string) {
    patchCachedData<StudentListItem[]>(STUDENTS_KEY, (list) => (Array.isArray(list) ? list.filter((student) => student.id !== id) : list));
    invalidateApi((key) => key === profileKey(id) || key === reportKey(id));
}

/** Plans changed (assigned, cloned, edited): refresh the profile and the list's "treino/dieta ativa" columns. */
export function refreshStudentPlans(id: string) {
    invalidateApi((key) => key === STUDENTS_KEY || key === profileKey(id) || key === reportKey(id));
}

export async function updateStudent(id: string, patch: StudentPatch): Promise<StudentUpdateResult> {
    const json = await requestJson<{ data: StudentUpdateResult }>(`/api/students/${id}`, { method: 'PUT', body: patch });
    const updated = { ...json.data, id };
    applyStudentUpdate(updated);
    return updated;
}

export type BulkAction = 'MARK_PAID' | 'RENEW' | 'SET_STATUS';

export async function bulkUpdateStudents(ids: string[], action: BulkAction, status?: string) {
    const json = await requestJson<{ data: { updated: StudentUpdateResult[]; count: number; skipped: number } }>(
        '/api/students/bulk',
        { method: 'POST', body: { ids, action, status, clientDate: todayInput() } }
    );
    json.data.updated.forEach((student) => applyStudentUpdate(student));
    return json.data;
}

export async function sendReminder(studentId: string, type: ReminderType, customMessage?: string) {
    return requestJson('/api/personal/reminders', {
        method: 'POST',
        body: { studentId, type, ...(customMessage?.trim() ? { customMessage: customMessage.trim() } : {}) },
    });
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export function generatePassword(length = 10): string {
    // No look-alike characters (0/O, 1/l/I) so it can be read over the phone.
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = new Uint32Array(length);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(values);
    } else {
        for (let i = 0; i < length; i++) values[i] = Math.floor(Math.random() * 2 ** 32);
    }
    return Array.from(values, (value) => chars[value % chars.length]).join('');
}

export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
    const escape = (value: string | number | null | undefined) => {
        if (value === null || value === undefined) return '';
        let text = String(value);
        if (/^[=+\-@\t\r]/.test(text)) {
            text = `'${text}`;
        }
        return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const content = [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
    const blob = new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Decimal with comma for spreadsheets in pt-BR (Excel/Sheets). */
export const csvNumber = (value: number | null | undefined, digits = 2) =>
    value === null || value === undefined || Number.isNaN(Number(value)) ? '' : Number(value).toFixed(digits).replace('.', ',');
