import { describe, expect, it } from 'vitest';
import { attentionReasons } from '@/components/personal/dashboard/attention-rules';
import { sendFieldsOf, sendState, sendStatus } from '@/lib/plan-send';

describe('plan send status', () => {
    it('needs both the date and the version to count as sent', () => {
        expect(sendState({ version: 1, sentAt: null, sentVersion: null })).toBe('NOT_SENT');
        expect(sendState({ version: 3, sentAt: '2026-09-26T15:00:00Z', sentVersion: null })).toBe('NOT_SENT');
        expect(sendState({ version: 3, sentAt: null, sentVersion: 3 })).toBe('NOT_SENT');
        expect(sendState({})).toBe('NOT_SENT');
    });

    it('is sent until the plan gets a newer version', () => {
        expect(sendState({ version: 3, sentAt: '2026-09-26T15:00:00Z', sentVersion: 3 })).toBe('SENT');
        expect(sendState({ version: 4, sentAt: '2026-09-26T15:00:00Z', sentVersion: 3 })).toBe('CHANGED');
        expect(sendState({ sentAt: '2026-09-26T15:00:00Z', sentVersion: 1 })).toBe('SENT');
    });

    it('labels each state', () => {
        expect(sendStatus({ version: 2, sentAt: '2026-09-26T15:00:00', sentVersion: 2 })).toMatchObject({ label: 'PDF enviado em 26/09', short: 'Enviado 26/09' });
        expect(sendStatus({ version: 3, sentAt: '2026-09-26T15:00:00', sentVersion: 2 })).toMatchObject({
            label: 'Alterado depois do envio (26/09)',
            short: 'Alterado após envio',
        });
        expect(sendStatus({ version: 1 })).toMatchObject({ label: 'PDF ainda não enviado', short: 'Não enviado' });
    });

    it('keeps only the send fields', () => {
        expect(sendFieldsOf(null)).toEqual({ version: null, sentAt: null, sentVersion: null });
        expect(sendFieldsOf({ version: 2, sentAt: 'x', sentVersion: 1, title: 'a' } as never)).toEqual({ version: 2, sentAt: 'x', sentVersion: 1 });
    });
});

describe('dashboard reasons for plans not sent (no app)', () => {
    const now = new Date(2026, 8, 26, 12, 0);
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
    const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);
    const base = { status: 'ACTIVE', createdAt: daysAgo(60), planExpiresAt: inDays(30), paymentStatus: 'PAID', expectsDiet: true };
    const keys = (list: Array<{ key: string }>) => list.map((reason) => reason.key).sort();
    const noApp = { now, appSignals: false };

    it('flags plans never sent, only without the app', () => {
        const signals = {
            ...base,
            workoutPlan: { endDate: inDays(30), version: 1, sentAt: null, sentVersion: null },
            dietPlan: { endDate: inDays(30), version: 2, sentAt: null, sentVersion: null },
        };
        const reasons = attentionReasons(signals, noApp);
        expect(keys(reasons)).toEqual(['DIET_NOT_SENT', 'WORKOUT_NOT_SENT']);
        expect(reasons.every((reason) => reason.category === 'PLANS' && reason.severity === 'WARNING')).toBe(true);
        expect(keys(attentionReasons(signals, { now })).some((key) => key.includes('SENT'))).toBe(false);
    });

    it('flags a plan changed after the PDF, not one still current', () => {
        const signals = {
            ...base,
            workoutPlan: { endDate: inDays(30), version: 3, sentAt: daysAgo(2), sentVersion: 3 },
            dietPlan: { endDate: null, version: 5, sentAt: daysAgo(3), sentVersion: 4 },
        };
        const reasons = attentionReasons(signals, noApp);
        expect(keys(reasons)).toEqual(['DIET_CHANGED_SINCE_SENT']);
        expect(reasons[0].since).toBe(daysAgo(3).toISOString());
    });

    it('asks to renew an ended plan instead of sending it', () => {
        const signals = { ...base, workoutPlan: { endDate: daysAgo(2), version: 1, sentAt: null, sentVersion: null }, dietPlan: null };
        expect(keys(attentionReasons(signals, noApp))).toEqual(['NO_DIET_PLAN', 'WORKOUT_PLAN_ENDED']);
    });

    it('ignores students who are not active', () => {
        const signals = { ...base, status: 'PAUSED', workoutPlan: { endDate: inDays(30), version: 1 } };
        expect(attentionReasons(signals, noApp)).toEqual([]);
    });
});
