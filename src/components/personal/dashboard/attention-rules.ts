/**
 * Why a student needs the trainer's attention today.
 *
 * Pure functions (no React, no Prisma) shared by /api/dashboard, /api/personal/reminders
 * and the dashboard UI, so the queue, its counters and "lembrar todos em risco" always agree.
 * Thresholds come from '@/lib/student-status' so the CRM and the profile classify students the same way.
 */
import {
    CHECKIN_EXPECTED_DAYS,
    INACTIVITY_ALERT_DAYS,
    daysSince,
    getBillingInfo,
    type BillingInfo,
} from '@/lib/student-status';

export type AttentionCategory = 'MESSAGES' | 'BILLING' | 'INACTIVITY' | 'CHECKIN' | 'PLANS';
export type AttentionSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AttentionReasonKey =
    | 'UNANSWERED_MESSAGE'
    | 'BILLING_OVERDUE'
    | 'BILLING_EXPIRING'
    | 'BILLING_PENDING'
    | 'INACTIVE'
    | 'NEVER_TRAINED'
    | 'CHECKIN_OVERDUE'
    | 'NO_CHECKIN'
    | 'LOW_ADHERENCE'
    | 'NO_WORKOUT_PLAN'
    | 'WORKOUT_PLAN_ENDING'
    | 'WORKOUT_PLAN_ENDED'
    | 'NO_DIET_PLAN'
    | 'DIET_PLAN_ENDING'
    | 'DIET_PLAN_ENDED';

export interface AttentionReason {
    key: AttentionReasonKey;
    category: AttentionCategory;
    severity: AttentionSeverity;
    /** Short pt-BR text shown as a chip. */
    label: string;
    /** ISO date the reason refers to (message sent, last workout...), when there is one. */
    since?: string | null;
}

export const ATTENTION_CATEGORIES: { key: AttentionCategory; label: string }[] = [
    { key: 'MESSAGES', label: 'Mensagens' },
    { key: 'BILLING', label: 'Cobrança' },
    { key: 'INACTIVITY', label: 'Inatividade' },
    { key: 'CHECKIN', label: 'Check-in' },
    { key: 'PLANS', label: 'Planos' },
];

/** Self-reported adherence (%) below this in a recent check-in is flagged. */
export const LOW_ADHERENCE_THRESHOLD = 60;
/** Workout adherence (%) below this is critical. */
export const CRITICAL_ADHERENCE_THRESHOLD = 50;
/** Check-ins older than this are too old to judge adherence. */
export const ADHERENCE_MAX_AGE_DAYS = 14;
/** Workout/diet plans ending within this many days are flagged. */
export const PLAN_ENDING_WINDOW_DAYS = 7;
/** A student message still unanswered after this many days is no longer "today's" work. */
export const UNANSWERED_LOOKBACK_DAYS = 14;
/** Unanswered for this long becomes critical. */
export const UNANSWERED_CRITICAL_HOURS = 24;
/** Days without training after which inactivity becomes critical. */
export const CRITICAL_INACTIVITY_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVERITY_WEIGHT: Record<AttentionSeverity, number> = { CRITICAL: 100, WARNING: 10, INFO: 1 };
const SEVERITY_ORDER: AttentionSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];

export interface AttentionSignals {
    /** ACTIVE | PAUSED | INACTIVE. Only messages are considered for students that are not active. */
    status: string;
    createdAt: Date | string;
    planExpiresAt?: Date | string | null;
    paymentStatus?: string | null;
    lastWorkoutAt?: Date | string | null;
    lastCheckin?: { date: Date | string; workoutAdherence: number; dietAdherence: number } | null;
    /** Active workout plan (null when there is none). */
    workoutPlan?: { startDate?: Date | string | null; endDate?: Date | string | null } | null;
    /** Active diet plan (null when there is none). */
    dietPlan?: { startDate?: Date | string | null; endDate?: Date | string | null } | null;
    /** Whether this trainer prescribes diets at all; otherwise "sem dieta ativa" would be noise. */
    expectsDiet?: boolean;
    /** Date of the conversation's last message, when that message was sent by the student. */
    unansweredMessageAt?: Date | string | null;
}

export interface AttentionOptions {
    now?: Date;
    /**
     * Viewer's `Date#getTimezoneOffset()`. Calendar-day rules (billing, plan end) are evaluated
     * in the viewer's timezone even when this runs on a UTC server.
     */
    tzOffset?: number | null;
}

const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
    `${count} ${count === 1 ? singular : pluralForm}`;

const toIso = (date: Date | string | null | undefined): string | null => {
    if (!date) return null;
    const value = new Date(date);
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
};

/** Shifts a date so the runtime's local calendar matches the viewer's calendar. */
export function toViewerClock(date: Date, tzOffset: number | null | undefined): Date {
    if (tzOffset === null || tzOffset === undefined || Number.isNaN(tzOffset)) return date;
    return new Date(date.getTime() + (date.getTimezoneOffset() - tzOffset) * 60 * 1000);
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Calendar days from today until `date` in the viewer's timezone (negative when in the past). */
export function calendarDaysUntil(date: Date | string, options: AttentionOptions = {}): number | null {
    const target = new Date(date);
    if (Number.isNaN(target.getTime())) return null;
    const now = options.now ?? new Date();
    return Math.round(
        (startOfDay(toViewerClock(target, options.tzOffset)) - startOfDay(toViewerClock(now, options.tzOffset))) / DAY_MS
    );
}

/** getBillingInfo evaluated in the viewer's timezone. */
export function billingFor(
    student: { planExpiresAt?: Date | string | null; paymentStatus?: string | null },
    options: AttentionOptions = {}
): BillingInfo {
    const now = options.now ?? new Date();
    const expires = student.planExpiresAt ? new Date(student.planExpiresAt) : null;
    return getBillingInfo(
        {
            planExpiresAt: expires && !Number.isNaN(expires.getTime()) ? toViewerClock(expires, options.tzOffset) : null,
            paymentStatus: student.paymentStatus,
        },
        toViewerClock(now, options.tzOffset)
    );
}

/** "12 min", "3 h", "2 dias". */
export function formatElapsed(minutes: number): string {
    const safe = Math.max(0, Math.floor(minutes));
    if (safe < 60) return `${Math.max(1, safe)} min`;
    if (safe < 24 * 60) return `${Math.floor(safe / 60)} h`;
    return plural(Math.floor(safe / (24 * 60)), 'dia');
}

const latestDate = (...dates: Array<Date | string | null | undefined>): Date | null => {
    let result: Date | null = null;
    for (const value of dates) {
        if (!value) continue;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) continue;
        if (!result || date > result) result = date;
    }
    return result;
};

/**
 * Training and check-in signals (the "at risk" set used by bulk reminders).
 * Inactivity is only checked when there is an active workout plan: without one,
 * the problem is the missing plan (see attentionReasons), not the student.
 */
export function engagementReasons(signals: AttentionSignals, options: AttentionOptions = {}): AttentionReason[] {
    if (signals.status !== 'ACTIVE') return [];
    const now = options.now ?? new Date();
    const reasons: AttentionReason[] = [];

    if (signals.workoutPlan) {
        const daysWithoutWorkout = daysSince(signals.lastWorkoutAt, now);
        if (daysWithoutWorkout === null) {
            const waitingSince = latestDate(signals.createdAt, signals.workoutPlan.startDate);
            const waitingDays = daysSince(waitingSince, now) ?? 0;
            if (waitingDays >= INACTIVITY_ALERT_DAYS) {
                reasons.push({
                    key: 'NEVER_TRAINED',
                    category: 'INACTIVITY',
                    severity: waitingDays >= CRITICAL_INACTIVITY_DAYS ? 'CRITICAL' : 'WARNING',
                    label: 'Ainda não treinou',
                    since: toIso(waitingSince),
                });
            }
        } else if (daysWithoutWorkout >= INACTIVITY_ALERT_DAYS) {
            reasons.push({
                key: 'INACTIVE',
                category: 'INACTIVITY',
                severity: daysWithoutWorkout >= CRITICAL_INACTIVITY_DAYS ? 'CRITICAL' : 'WARNING',
                label: `Sem treinar há ${plural(daysWithoutWorkout, 'dia')}`,
                since: toIso(signals.lastWorkoutAt),
            });
        }
    }

    const daysWithoutCheckin = daysSince(signals.lastCheckin?.date, now);
    if (daysWithoutCheckin === null) {
        const registeredDays = daysSince(signals.createdAt, now) ?? 0;
        if (registeredDays >= CHECKIN_EXPECTED_DAYS) {
            reasons.push({ key: 'NO_CHECKIN', category: 'CHECKIN', severity: 'INFO', label: 'Nenhum check-in enviado' });
        }
    } else if (daysWithoutCheckin >= CHECKIN_EXPECTED_DAYS) {
        reasons.push({
            key: 'CHECKIN_OVERDUE',
            category: 'CHECKIN',
            severity: daysWithoutCheckin >= CHECKIN_EXPECTED_DAYS * 2 ? 'WARNING' : 'INFO',
            label: `Check-in atrasado · ${plural(daysWithoutCheckin, 'dia')}`,
            since: toIso(signals.lastCheckin?.date),
        });
    }

    if (signals.lastCheckin && daysWithoutCheckin !== null && daysWithoutCheckin <= ADHERENCE_MAX_AGE_DAYS) {
        const { workoutAdherence, dietAdherence } = signals.lastCheckin;
        const low: string[] = [];
        if (workoutAdherence < LOW_ADHERENCE_THRESHOLD) low.push(`treino ${workoutAdherence}%`);
        if (dietAdherence < LOW_ADHERENCE_THRESHOLD) low.push(`dieta ${dietAdherence}%`);
        if (low.length > 0) {
            reasons.push({
                key: 'LOW_ADHERENCE',
                category: 'CHECKIN',
                severity: workoutAdherence < CRITICAL_ADHERENCE_THRESHOLD ? 'CRITICAL' : 'WARNING',
                label: `Adesão relatada baixa: ${low.join(' · ')}`,
                since: toIso(signals.lastCheckin.date),
            });
        }
    }

    return reasons;
}

function planEndReason(
    kind: 'WORKOUT' | 'DIET',
    endDate: Date | string | null | undefined,
    options: AttentionOptions
): AttentionReason | null {
    if (!endDate) return null;
    const days = calendarDaysUntil(endDate, options);
    if (days === null || days > PLAN_ENDING_WINDOW_DAYS) return null;
    const noun = kind === 'WORKOUT' ? 'Treino' : 'Dieta';
    if (days < 0) {
        return {
            key: kind === 'WORKOUT' ? 'WORKOUT_PLAN_ENDED' : 'DIET_PLAN_ENDED',
            category: 'PLANS',
            severity: 'WARNING',
            label: `${noun} venceu há ${plural(Math.abs(days), 'dia')}`,
            since: toIso(endDate),
        };
    }
    return {
        key: kind === 'WORKOUT' ? 'WORKOUT_PLAN_ENDING' : 'DIET_PLAN_ENDING',
        category: 'PLANS',
        severity: days <= 2 ? 'WARNING' : 'INFO',
        label: days === 0 ? `${noun} termina hoje` : `${noun} termina em ${plural(days, 'dia')}`,
        since: toIso(endDate),
    };
}

/** Every reason, most severe first. Empty when the student needs nothing today. */
export function attentionReasons(signals: AttentionSignals, options: AttentionOptions = {}): AttentionReason[] {
    const now = options.now ?? new Date();
    const reasons: AttentionReason[] = [];

    if (signals.unansweredMessageAt) {
        const sentAt = new Date(signals.unansweredMessageAt);
        const minutes = Math.floor((now.getTime() - sentAt.getTime()) / 60000);
        if (!Number.isNaN(minutes) && minutes <= UNANSWERED_LOOKBACK_DAYS * 24 * 60) {
            reasons.push({
                key: 'UNANSWERED_MESSAGE',
                category: 'MESSAGES',
                severity: minutes >= UNANSWERED_CRITICAL_HOURS * 60 ? 'CRITICAL' : 'WARNING',
                label: `Mensagem sem resposta há ${formatElapsed(minutes)}`,
                since: sentAt.toISOString(),
            });
        }
    }

    // A paused or inactive student writing is still work; nothing else is.
    if (signals.status !== 'ACTIVE') return reasons;

    const billing = billingFor(signals, { ...options, now });
    if (billing.status === 'OVERDUE') {
        reasons.push({ key: 'BILLING_OVERDUE', category: 'BILLING', severity: 'CRITICAL', label: billing.label, since: toIso(signals.planExpiresAt) });
    } else if (billing.status === 'EXPIRING') {
        reasons.push({ key: 'BILLING_EXPIRING', category: 'BILLING', severity: 'WARNING', label: billing.label, since: toIso(signals.planExpiresAt) });
    } else if (billing.status === 'PENDING') {
        reasons.push({ key: 'BILLING_PENDING', category: 'BILLING', severity: 'WARNING', label: billing.label });
    }

    reasons.push(...engagementReasons(signals, { ...options, now }));

    if (!signals.workoutPlan) {
        reasons.push({ key: 'NO_WORKOUT_PLAN', category: 'PLANS', severity: 'WARNING', label: 'Sem treino ativo' });
    } else {
        const reason = planEndReason('WORKOUT', signals.workoutPlan.endDate, { ...options, now });
        if (reason) reasons.push(reason);
    }

    if (signals.dietPlan) {
        const reason = planEndReason('DIET', signals.dietPlan.endDate, { ...options, now });
        if (reason) reasons.push(reason);
    } else if (signals.expectsDiet) {
        reasons.push({ key: 'NO_DIET_PLAN', category: 'PLANS', severity: 'INFO', label: 'Sem dieta ativa' });
    }

    return reasons.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

/** Sort key: one critical reason outweighs any number of warnings, and so on. */
export function attentionScore(reasons: AttentionReason[]): number {
    return reasons.reduce((sum, reason) => sum + SEVERITY_WEIGHT[reason.severity], 0);
}

export function highestSeverity(reasons: AttentionReason[]): AttentionSeverity {
    return SEVERITY_ORDER.find((severity) => reasons.some((reason) => reason.severity === severity)) ?? 'INFO';
}

/** Students a training/check-in reminder makes sense for. */
export function isAtRisk(reasons: AttentionReason[]): boolean {
    return reasons.some(
        (reason) =>
            reason.category === 'INACTIVITY' ||
            reason.key === 'CHECKIN_OVERDUE' ||
            reason.key === 'NO_CHECKIN'
    );
}
