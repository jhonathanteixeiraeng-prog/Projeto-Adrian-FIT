/**
 * Business rules shared by the CRM, the student profile and the dashboard,
 * so every screen classifies a student the same way.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days before expiry when a plan starts showing as "vence em breve". */
export const EXPIRING_WINDOW_DAYS = 7;
/** A student with no completed workout for this many days is flagged as at risk. */
export const INACTIVITY_ALERT_DAYS = 3;
/** Check-ins are expected at least this often. */
export const CHECKIN_EXPECTED_DAYS = 7;

export const PLAN_TYPE_MONTHS: Record<string, number> = {
    MENSAL: 1,
    TRIMESTRAL: 3,
    SEMESTRAL: 6,
    ANUAL: 12,
};

export const PLAN_TYPE_LABELS: Record<string, string> = {
    MENSAL: 'Mensal',
    TRIMESTRAL: 'Trimestral',
    SEMESTRAL: 'Semestral',
    ANUAL: 'Anual',
    PERSONALIZADO: 'Personalizado',
};

/**
 * Monthly revenue equivalent of a plan (an annual R$1.200 plan counts R$100/month).
 * Returns null when there is no value, instead of inventing one.
 */
export function monthlyValue(planType: string | null | undefined, planValue: number | null | undefined): number | null {
    if (planValue === null || planValue === undefined || Number.isNaN(Number(planValue))) return null;
    const months = PLAN_TYPE_MONTHS[(planType || 'MENSAL').toUpperCase()] ?? 1;
    return Number(planValue) / months;
}

export type BillingStatus = 'OVERDUE' | 'EXPIRING' | 'PENDING' | 'OK' | 'NO_PLAN';

export interface BillingInfo {
    status: BillingStatus;
    /** Negative when already expired. Null when there is no expiry date. */
    daysToExpire: number | null;
    label: string;
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * Due dates are calendar days stored at 00:00 or 12:00 UTC (date-only saves); read those by their UTC day
 * so they don't become the previous day in Brazil. Other timestamps use the local day.
 */
function calendarDay(value: string | Date): Date | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const isDateOnly =
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0 &&
        (date.getUTCHours() === 0 || date.getUTCHours() === 12);
    return isDateOnly
        ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        : startOfDay(date);
}

/** Adds months keeping the day, clamped to the target month's last day (31/01 + 1 month = 28/02, not 03/03). */
function addMonthsClamped(date: Date, months: number): Date {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/**
 * Billing situation of a student.
 * An expiry date in the past is always "Vencido", even if the last payment was marked as paid:
 * the paid period is over and the plan needs renewal.
 */
export function getBillingInfo(
    student: { planExpiresAt?: string | Date | null; paymentStatus?: string | null },
    now: Date = new Date()
): BillingInfo {
    const payment = (student.paymentStatus || '').toUpperCase();
    const expiresAt = student.planExpiresAt ? calendarDay(student.planExpiresAt) : null;
    const daysToExpire = expiresAt
        ? Math.round((expiresAt.getTime() - startOfDay(now).getTime()) / DAY_MS)
        : null;

    if (payment === 'OVERDUE') {
        return { status: 'OVERDUE', daysToExpire, label: 'Pagamento atrasado' };
    }
    if (daysToExpire !== null && daysToExpire < 0) {
        const days = Math.abs(daysToExpire);
        return { status: 'OVERDUE', daysToExpire, label: `Vencido há ${days} dia${days === 1 ? '' : 's'}` };
    }
    if (daysToExpire !== null && daysToExpire <= EXPIRING_WINDOW_DAYS) {
        return {
            status: 'EXPIRING',
            daysToExpire,
            label: daysToExpire === 0 ? 'Vence hoje' : `Vence em ${daysToExpire} dia${daysToExpire === 1 ? '' : 's'}`,
        };
    }
    if (payment === 'PENDENTE' || payment === 'PENDING') {
        return { status: 'PENDING', daysToExpire, label: 'Pagamento pendente' };
    }
    if (daysToExpire === null && !payment) {
        return { status: 'NO_PLAN', daysToExpire, label: 'Sem contrato' };
    }
    return { status: 'OK', daysToExpire, label: 'Em dia' };
}

/** New expiry after renewing one period: counted from the current expiry, or from today if already expired. */
export function renewedExpiry(planType: string | null | undefined, currentExpiresAt: string | Date | null | undefined, now: Date = new Date()): Date {
    const months = PLAN_TYPE_MONTHS[(planType || 'MENSAL').toUpperCase()] ?? 1;
    const current = currentExpiresAt ? calendarDay(currentExpiresAt) : null;
    const today = startOfDay(now);
    const base = current && current > today ? current : today;
    return addMonthsClamped(base, months);
}

/** Whole days since a date (null when there is no date). */
export function daysSince(date: string | Date | null | undefined, now: Date = new Date()): number | null {
    if (!date) return null;
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return null;
    return Math.floor((now.getTime() - value.getTime()) / DAY_MS);
}
