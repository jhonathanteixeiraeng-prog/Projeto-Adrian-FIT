import { describe, expect, it } from 'vitest';
import {
    CHECKIN_EXPECTED_DAYS,
    EXPIRING_WINDOW_DAYS,
    INACTIVITY_ALERT_DAYS,
    PLAN_TYPE_LABELS,
    PLAN_TYPE_MONTHS,
    daysSince,
    getBillingInfo,
    monthlyValue,
    renewedExpiry,
} from '@/lib/student-status';

describe('student status: constants', () => {
    it('defines expected threshold windows', () => {
        expect(EXPIRING_WINDOW_DAYS).toBe(7);
        expect(INACTIVITY_ALERT_DAYS).toBe(3);
        expect(CHECKIN_EXPECTED_DAYS).toBe(7);
    });

    it('maps plan types to months and display labels', () => {
        expect(PLAN_TYPE_MONTHS.MENSAL).toBe(1);
        expect(PLAN_TYPE_MONTHS.TRIMESTRAL).toBe(3);
        expect(PLAN_TYPE_MONTHS.SEMESTRAL).toBe(6);
        expect(PLAN_TYPE_MONTHS.ANUAL).toBe(12);

        expect(PLAN_TYPE_LABELS.MENSAL).toBe('Mensal');
        expect(PLAN_TYPE_LABELS.TRIMESTRAL).toBe('Trimestral');
        expect(PLAN_TYPE_LABELS.SEMESTRAL).toBe('Semestral');
        expect(PLAN_TYPE_LABELS.ANUAL).toBe('Anual');
        expect(PLAN_TYPE_LABELS.PERSONALIZADO).toBe('Personalizado');
    });
});

describe('student status: monthlyValue', () => {
    it('calculates monthly revenue from multi-month plans', () => {
        expect(monthlyValue('ANUAL', 1200)).toBe(100);
        expect(monthlyValue('SEMESTRAL', 600)).toBe(100);
        expect(monthlyValue('TRIMESTRAL', 300)).toBe(100);
        expect(monthlyValue('MENSAL', 150)).toBe(150);
    });

    it('is case-insensitive for known plan types', () => {
        expect(monthlyValue('anual', 1200)).toBe(100);
        expect(monthlyValue('trimestral', 300)).toBe(100);
    });

    it('defaults unknown or null plan types to 1 month', () => {
        expect(monthlyValue(null, 150)).toBe(150);
        expect(monthlyValue(undefined, 150)).toBe(150);
        expect(monthlyValue('PERSONALIZADO', 250)).toBe(250);
        expect(monthlyValue('CUSTOM', 200)).toBe(200);
    });

    it('returns null when plan value is null, undefined, or invalid', () => {
        expect(monthlyValue('MENSAL', null)).toBeNull();
        expect(monthlyValue('MENSAL', undefined)).toBeNull();
        expect(monthlyValue('MENSAL', Number.NaN)).toBeNull();
    });

    it('handles zero or decimal values correctly', () => {
        expect(monthlyValue('MENSAL', 0)).toBe(0);
        expect(monthlyValue('TRIMESTRAL', 350.55)).toBeCloseTo(116.85, 2);
    });
});

describe('student status: getBillingInfo', () => {
    const fixedNow = new Date('2026-09-27T12:00:00Z');

    it('flags explicit OVERDUE payment status regardless of dates', () => {
        const info = getBillingInfo({ paymentStatus: 'OVERDUE', planExpiresAt: '2026-10-30T00:00:00Z' }, fixedNow);
        expect(info.status).toBe('OVERDUE');
        expect(info.label).toBe('Pagamento atrasado');
    });

    it('detects expired plan in the past (singular and plural days)', () => {
        // Expired yesterday (1 day ago)
        const info1 = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-09-26T00:00:00Z' }, fixedNow);
        expect(info1.status).toBe('OVERDUE');
        expect(info1.daysToExpire).toBe(-1);
        expect(info1.label).toBe('Vencido há 1 dia');

        // Expired 5 days ago
        const info5 = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-09-22T00:00:00Z' }, fixedNow);
        expect(info5.status).toBe('OVERDUE');
        expect(info5.daysToExpire).toBe(-5);
        expect(info5.label).toBe('Vencido há 5 dias');
    });

    it('detects plans expiring today or within the 7-day window', () => {
        // Expiring today
        const infoToday = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-09-27T00:00:00Z' }, fixedNow);
        expect(infoToday.status).toBe('EXPIRING');
        expect(infoToday.daysToExpire).toBe(0);
        expect(infoToday.label).toBe('Vence hoje');

        // Expiring in 1 day
        const info1 = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-09-28T00:00:00Z' }, fixedNow);
        expect(info1.status).toBe('EXPIRING');
        expect(info1.daysToExpire).toBe(1);
        expect(info1.label).toBe('Vence em 1 dia');

        // Expiring in 7 days (exact window boundary)
        const info7 = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-10-04T00:00:00Z' }, fixedNow);
        expect(info7.status).toBe('EXPIRING');
        expect(info7.daysToExpire).toBe(7);
        expect(info7.label).toBe('Vence em 7 dias');
    });

    it('reports pending payment when beyond the expiring window', () => {
        const info = getBillingInfo({ paymentStatus: 'PENDING', planExpiresAt: '2026-10-20T00:00:00Z' }, fixedNow);
        expect(info.status).toBe('PENDING');
        expect(info.label).toBe('Pagamento pendente');

        const infoPt = getBillingInfo({ paymentStatus: 'PENDENTE', planExpiresAt: '2026-10-20T00:00:00Z' }, fixedNow);
        expect(infoPt.status).toBe('PENDING');
        expect(infoPt.label).toBe('Pagamento pendente');
    });

    it('reports NO_PLAN when there is no expiry date and no payment status', () => {
        const info = getBillingInfo({ paymentStatus: null, planExpiresAt: null }, fixedNow);
        expect(info.status).toBe('NO_PLAN');
        expect(info.daysToExpire).toBeNull();
        expect(info.label).toBe('Sem contrato');
    });

    it('reports OK (Em dia) when plan is active and far from expiring', () => {
        const info = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: '2026-10-15T00:00:00Z' }, fixedNow);
        expect(info.status).toBe('OK');
        expect(info.daysToExpire).toBe(18);
        expect(info.label).toBe('Em dia');
    });

    it('handles Date objects as planExpiresAt', () => {
        const info = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: new Date('2026-10-15T12:00:00Z') }, fixedNow);
        expect(info.status).toBe('OK');
        expect(info.daysToExpire).toBe(18);
    });

    it('handles invalid date string gracefully', () => {
        const info = getBillingInfo({ paymentStatus: 'PAID', planExpiresAt: 'invalid-date' }, fixedNow);
        expect(info.status).toBe('OK');
        expect(info.daysToExpire).toBeNull();
        expect(info.label).toBe('Em dia');
    });
});

describe('student status: renewedExpiry', () => {
    const fixedNow = new Date('2026-09-27T12:00:00Z');

    it('extends from current expiry when current expiry is in the future', () => {
        const current = new Date('2026-10-15T00:00:00Z');
        const renewed = renewedExpiry('MENSAL', current, fixedNow);
        expect(renewed.getFullYear()).toBe(2026);
        expect(renewed.getMonth()).toBe(10); // November (0-based 10)
        expect(renewed.getDate()).toBe(15);
    });

    it('renews for 3, 6, and 12 months for longer plans', () => {
        const current = new Date('2026-10-15T00:00:00Z');
        const trimestral = renewedExpiry('TRIMESTRAL', current, fixedNow);
        expect(trimestral.getMonth()).toBe(0); // January 2027
        expect(trimestral.getFullYear()).toBe(2027);

        const semestral = renewedExpiry('SEMESTRAL', current, fixedNow);
        expect(semestral.getMonth()).toBe(3); // April 2027
        expect(semestral.getFullYear()).toBe(2027);

        const anual = renewedExpiry('ANUAL', current, fixedNow);
        expect(anual.getMonth()).toBe(9); // October 2027
        expect(anual.getFullYear()).toBe(2027);
    });

    it('renews from today when plan is already expired in the past', () => {
        const expired = new Date('2026-08-01T00:00:00Z');
        const renewed = renewedExpiry('MENSAL', expired, fixedNow);
        expect(renewed.getFullYear()).toBe(2026);
        expect(renewed.getMonth()).toBe(9); // October (0-based 9)
        expect(renewed.getDate()).toBe(27);
    });

    it('renews from today when current expiry is null or undefined', () => {
        const renewed = renewedExpiry('MENSAL', null, fixedNow);
        expect(renewed.getFullYear()).toBe(2026);
        expect(renewed.getMonth()).toBe(9); // October
        expect(renewed.getDate()).toBe(27);
    });

    it('clamps to the last day of month on day 31 renewal', () => {
        // 31 Jan 2026 + 1 month = 28 Feb 2026 (non-leap year)
        const jan31 = new Date('2026-01-31T00:00:00Z');
        const feb2026 = renewedExpiry('MENSAL', jan31, new Date('2026-01-01T00:00:00Z'));
        expect(feb2026.getMonth()).toBe(1); // February
        expect(feb2026.getDate()).toBe(28);

        // 31 Jan 2024 + 1 month = 29 Feb 2024 (leap year)
        const jan31Leap = new Date('2024-01-31T00:00:00Z');
        const feb2024 = renewedExpiry('MENSAL', jan31Leap, new Date('2024-01-01T00:00:00Z'));
        expect(feb2024.getMonth()).toBe(1);
        expect(feb2024.getDate()).toBe(29);

        // 31 Mar + 1 month = 30 Apr
        const mar31 = new Date('2026-03-31T00:00:00Z');
        const apr = renewedExpiry('MENSAL', mar31, new Date('2026-03-01T00:00:00Z'));
        expect(apr.getMonth()).toBe(3); // April
        expect(apr.getDate()).toBe(30);
    });
});

describe('student status: daysSince', () => {
    const fixedNow = new Date('2026-09-27T12:00:00Z');

    it('returns whole elapsed days since a date', () => {
        expect(daysSince('2026-09-24T12:00:00Z', fixedNow)).toBe(3);
        expect(daysSince(new Date('2026-09-20T12:00:00Z'), fixedNow)).toBe(7);
        expect(daysSince(fixedNow, fixedNow)).toBe(0);
    });

    it('returns negative number for future dates', () => {
        expect(daysSince('2026-09-29T12:00:00Z', fixedNow)).toBe(-2);
    });

    it('returns null for null, undefined, empty, or invalid date string', () => {
        expect(daysSince(null, fixedNow)).toBeNull();
        expect(daysSince(undefined, fixedNow)).toBeNull();
        expect(daysSince('', fixedNow)).toBeNull();
        expect(daysSince('not-a-date', fixedNow)).toBeNull();
    });
});
