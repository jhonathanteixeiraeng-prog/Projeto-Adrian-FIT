import { PLAN_ENDING_WINDOW_DAYS } from '@/components/personal/dashboard/attention-rules';
import { STUDENTS_USE_APP } from '@/lib/features';
import { contactEmail } from '@/lib/student-access';
import { normalizeText } from '@/lib/utils';
import {
    INACTIVITY_ALERT_DAYS,
    type BillingInfo,
    daysSince,
    getBillingInfo,
    monthlyValue,
} from '@/lib/student-status';
import {
    PAYMENT_LABELS,
    STATUS_LABELS,
    csvNumber,
    daysUntil,
    downloadCsv,
    firstName,
    formatDate,
    onlyDigits,
    planLabel,
    whatsappUrl,
} from './lib';
import type { Checkin, StudentListItem } from './types';

type WorkoutSummary = NonNullable<StudentListItem['workoutPlans']>[number];
type DietSummary = NonNullable<StudentListItem['dietPlans']>[number];

export interface CrmRow {
    id: string;
    student: StudentListItem;
    name: string;
    email: string;
    phone: string;
    phoneDigits: string;
    status: string;
    billing: BillingInfo;
    monthly: number | null;
    lastWorkoutAt: string | null;
    lastWorkoutDays: number | null;
    lastWorkoutName: string | null;
    lastCheckin: Checkin | null;
    lastCheckinDays: number | null;
    workout: WorkoutSummary | null;
    workoutEndsIn: number | null;
    diet: DietSummary | null;
    dietEndsIn: number | null;
    onTrack: boolean;
    atRisk: boolean;
    /** Active student without a workout plan, or whose workout/diet ends within 7 days or is over. */
    planAlert: boolean;
    billingAlert: boolean;
}

export function buildRow(student: StudentListItem, now: Date): CrmRow {
    const status = student.status || 'ACTIVE';
    const lastSession = student.workoutSessions?.[0] ?? null;
    const lastWorkoutDays = daysSince(lastSession?.completedAt, now);
    const lastCheckin = student.checkins?.[0] ?? null;
    const workout = student.workoutPlans?.[0] ?? null;
    const diet = student.dietPlans?.[0] ?? null;
    const workoutEndsIn = workout ? daysUntil(workout.endDate, now) : null;
    const dietEndsIn = diet ? daysUntil(diet.endDate, now) : null;
    const endsSoon = (days: number | null) => days !== null && days <= PLAN_ENDING_WINDOW_DAYS;
    const billing = getBillingInfo(student, now);
    const isActive = status === 'ACTIVE';
    const phone = student.user?.phone || '';

    return {
        id: student.id,
        student,
        name: student.user?.name || 'Aluno',
        // Students without app access have a placeholder address: never shown, exported or searched.
        email: contactEmail(student.user?.email) ?? '',
        phone,
        phoneDigits: onlyDigits(phone),
        status,
        billing,
        monthly: monthlyValue(student.planType, student.planValue),
        lastWorkoutAt: lastSession?.completedAt ?? null,
        lastWorkoutDays,
        lastWorkoutName: lastSession?.dayName ?? null,
        lastCheckin,
        lastCheckinDays: daysSince(lastCheckin?.date, now),
        workout,
        workoutEndsIn,
        diet,
        dietEndsIn,
        onTrack: isActive && lastWorkoutDays !== null && lastWorkoutDays < INACTIVITY_ALERT_DAYS,
        atRisk: isActive && (lastWorkoutDays === null || lastWorkoutDays >= INACTIVITY_ALERT_DAYS),
        planAlert: isActive && (!workout || endsSoon(workoutEndsIn) || endsSoon(dietEndsIn)),
        // Former students (INACTIVE) are not billed, so they never count as a billing alert.
        billingAlert: status !== 'INACTIVE' && ['OVERDUE', 'EXPIRING', 'PENDING'].includes(billing.status),
    };
}

// ---------------------------------------------------------------------------
// Tabs, filters, sorting
// ---------------------------------------------------------------------------

export const CRM_TABS = [
    { id: 'all', label: 'Todos' },
    { id: 'on-track', label: 'Treinando no ritmo' },
    { id: 'risk', label: 'Em risco' },
    { id: 'plans', label: 'Planos a renovar' },
    { id: 'billing', label: 'Cobrança' },
    { id: 'inactive', label: 'Pausados / Inativos' },
] as const;
export type CrmTab = (typeof CRM_TABS)[number]['id'];

/** "Treinando no ritmo" and "Em risco" come from workouts logged in the students' app. */
const APP_TABS: CrmTab[] = ['on-track', 'risk'];
export const VISIBLE_CRM_TABS = CRM_TABS.filter((tab) => STUDENTS_USE_APP || !APP_TABS.includes(tab.id));

export const tabPredicates: Record<CrmTab, (row: CrmRow) => boolean> = {
    all: () => true,
    'on-track': (row) => row.onTrack,
    risk: (row) => row.atRisk,
    plans: (row) => row.planAlert,
    billing: (row) => row.billingAlert,
    inactive: (row) => row.status === 'PAUSED' || row.status === 'INACTIVE',
};

export const BILLING_FILTER_OPTIONS = [
    { value: 'all', label: 'Toda cobrança' },
    { value: 'OVERDUE', label: 'Vencido / atrasado' },
    { value: 'EXPIRING', label: 'Vence em até 7 dias' },
    { value: 'PENDING', label: 'Pagamento pendente' },
    { value: 'OK', label: 'Em dia' },
    { value: 'NO_PLAN', label: 'Sem contrato' },
];

export type SortKey = 'name' | 'status' | 'workout' | 'lastWorkout' | 'lastCheckin' | 'plan' | 'expires';
export const SORT_KEYS: SortKey[] = ['name', 'status', 'workout', 'lastWorkout', 'lastCheckin', 'plan', 'expires'];

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, PAUSED: 1, INACTIVE: 2 };

function sortValue(row: CrmRow, key: SortKey): string | number | null {
    switch (key) {
        case 'name':
            return normalizeText(row.name);
        case 'status':
            return STATUS_ORDER[row.status] ?? 3;
        case 'workout':
            return row.workoutEndsIn;
        case 'lastWorkout':
            return row.lastWorkoutDays;
        case 'lastCheckin':
            return row.lastCheckinDays;
        case 'plan':
            return row.monthly;
        case 'expires':
            return row.billing.daysToExpire;
    }
}

/** Missing values always go to the end, whatever the direction. Ties fall back to the name. */
export function sortRows(rows: CrmRow[], key: SortKey, dir: 'asc' | 'desc'): CrmRow[] {
    const factor = dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const va = sortValue(a, key);
        const vb = sortValue(b, key);
        if (va === null && vb !== null) return 1;
        if (vb === null && va !== null) return -1;
        let result = 0;
        if (va !== null && vb !== null) {
            result = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'pt-BR') : Number(va) - Number(vb);
        }
        if (result === 0 && key !== 'name') return a.name.localeCompare(b.name, 'pt-BR');
        return result * factor;
    });
}

// ---------------------------------------------------------------------------
// Messages and export
// ---------------------------------------------------------------------------

/** Pre-filled WhatsApp message matching the billing situation shown on screen. */
export function billingWhatsappUrl(row: CrmRow): string | null {
    const name = firstName(row.name);
    let message: string;
    if (row.billing.status === 'OVERDUE') {
        message = `Oi ${name}, tudo bem? Passando para lembrar que a renovação da sua consultoria está em aberto. Me avise para eu te enviar a chave PIX e mantermos seu plano ativo!`;
    } else if (row.billing.status === 'EXPIRING') {
        message = `Oi ${name}, tudo bem? Sua consultoria vence ${row.billing.daysToExpire === 0 ? 'hoje' : `em ${row.billing.daysToExpire} dia${row.billing.daysToExpire === 1 ? '' : 's'}`}. Vamos garantir a renovação para seguirmos com a sua evolução?`;
    } else if (row.billing.status === 'PENDING') {
        message = `Oi ${name}, tudo bem? O pagamento da sua consultoria ainda consta como pendente. Consegue verificar para mim?`;
    } else {
        message = `Oi ${name}, tudo bem? Passando para saber como foram os treinos nesta semana!`;
    }
    return whatsappUrl(row.phone, message);
}

type CsvCell = string | number;

/** CSV columns; `app` ones come from the students' app and are left out while it isn't used. */
const CSV_COLUMNS: Array<{ header: string; value: (row: CrmRow) => CsvCell; app?: boolean }> = [
    { header: 'Nome', value: (row) => row.name },
    { header: 'E-mail', value: (row) => row.email },
    { header: 'Telefone', value: (row) => row.phone },
    { header: 'Status', value: (row) => STATUS_LABELS[row.status] ?? row.status },
    { header: 'Treino ativo', value: (row) => row.workout?.title ?? '' },
    { header: 'Fim do treino', value: (row) => (row.workout?.endDate ? formatDate(row.workout.endDate, '') : '') },
    { header: 'Dieta ativa', value: (row) => row.diet?.title ?? '' },
    { header: 'Fim da dieta', value: (row) => (row.diet?.endDate ? formatDate(row.diet.endDate, '') : '') },
    { header: 'Último treino', value: (row) => (row.lastWorkoutAt ? formatDate(row.lastWorkoutAt, '') : ''), app: true },
    { header: 'Dias sem treinar', value: (row) => row.lastWorkoutDays ?? '', app: true },
    { header: 'Último check-in', value: (row) => (row.lastCheckin ? formatDate(row.lastCheckin.date, '') : ''), app: true },
    { header: 'Adesão treino (%)', value: (row) => row.lastCheckin?.workoutAdherence ?? '', app: true },
    { header: 'Adesão dieta (%)', value: (row) => row.lastCheckin?.dietAdherence ?? '', app: true },
    { header: 'Plano', value: (row) => planLabel(row.student.planType) },
    { header: 'Valor do plano (R$)', value: (row) => csvNumber(row.student.planValue) },
    { header: 'Valor mensal (R$)', value: (row) => csvNumber(row.monthly) },
    { header: 'Vencimento', value: (row) => (row.student.planExpiresAt ? formatDate(row.student.planExpiresAt, '') : '') },
    { header: 'Situação da cobrança', value: (row) => row.billing.label },
    {
        header: 'Pagamento',
        value: (row) => (row.student.paymentStatus ? PAYMENT_LABELS[row.student.paymentStatus] ?? row.student.paymentStatus : ''),
    },
];

export function exportRowsCsv(rows: CrmRow[], filename: string) {
    const columns = CSV_COLUMNS.filter((column) => STUDENTS_USE_APP || !column.app);
    downloadCsv(
        filename,
        columns.map((column) => column.header),
        rows.map((row) => columns.map((column) => column.value(row)))
    );
}
