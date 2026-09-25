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
    onTrack: boolean;
    atRisk: boolean;
    billingAlert: boolean;
}

export function buildRow(student: StudentListItem, now: Date): CrmRow {
    const status = student.status || 'ACTIVE';
    const lastSession = student.workoutSessions?.[0] ?? null;
    const lastWorkoutDays = daysSince(lastSession?.completedAt, now);
    const lastCheckin = student.checkins?.[0] ?? null;
    const workout = student.workoutPlans?.[0] ?? null;
    const billing = getBillingInfo(student, now);
    const isActive = status === 'ACTIVE';
    const phone = student.user?.phone || '';

    return {
        id: student.id,
        student,
        name: student.user?.name || 'Aluno',
        email: student.user?.email || '',
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
        workoutEndsIn: workout ? daysUntil(workout.endDate, now) : null,
        diet: student.dietPlans?.[0] ?? null,
        onTrack: isActive && lastWorkoutDays !== null && lastWorkoutDays < INACTIVITY_ALERT_DAYS,
        atRisk: isActive && (lastWorkoutDays === null || lastWorkoutDays >= INACTIVITY_ALERT_DAYS),
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
    { id: 'billing', label: 'Cobrança' },
    { id: 'inactive', label: 'Pausados / Inativos' },
] as const;
export type CrmTab = (typeof CRM_TABS)[number]['id'];

export const tabPredicates: Record<CrmTab, (row: CrmRow) => boolean> = {
    all: () => true,
    'on-track': (row) => row.onTrack,
    risk: (row) => row.atRisk,
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

export function exportRowsCsv(rows: CrmRow[], filename: string) {
    const header = [
        'Nome',
        'E-mail',
        'Telefone',
        'Status',
        'Treino ativo',
        'Fim do treino',
        'Dieta ativa',
        'Último treino',
        'Dias sem treinar',
        'Último check-in',
        'Adesão treino (%)',
        'Adesão dieta (%)',
        'Plano',
        'Valor do plano (R$)',
        'Valor mensal (R$)',
        'Vencimento',
        'Situação da cobrança',
        'Pagamento',
    ];
    const lines = rows.map((row) => [
        row.name,
        row.email,
        row.phone,
        STATUS_LABELS[row.status] ?? row.status,
        row.workout?.title ?? '',
        row.workout?.endDate ? formatDate(row.workout.endDate, '') : '',
        row.diet?.title ?? '',
        row.lastWorkoutAt ? formatDate(row.lastWorkoutAt, '') : '',
        row.lastWorkoutDays ?? '',
        row.lastCheckin ? formatDate(row.lastCheckin.date, '') : '',
        row.lastCheckin?.workoutAdherence ?? '',
        row.lastCheckin?.dietAdherence ?? '',
        planLabel(row.student.planType),
        csvNumber(row.student.planValue),
        csvNumber(row.monthly),
        row.student.planExpiresAt ? formatDate(row.student.planExpiresAt, '') : '',
        row.billing.label,
        row.student.paymentStatus ? PAYMENT_LABELS[row.student.paymentStatus] ?? row.student.paymentStatus : '',
    ]);
    downloadCsv(filename, header, lines);
}
