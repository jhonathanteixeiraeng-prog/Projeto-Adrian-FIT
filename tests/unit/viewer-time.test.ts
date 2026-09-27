import { describe, expect, it } from 'vitest';
import {
    DEFAULT_TIME_ZONE,
    parseTzOffset,
    timeZoneOffset,
    viewerClock,
} from '@/lib/viewer-time';

describe('viewer time: default timezone', () => {
    it('uses America/Sao_Paulo as default time zone', () => {
        expect(DEFAULT_TIME_ZONE).toBe('America/Sao_Paulo');
    });
});

describe('viewer time: parseTzOffset', () => {
    it('parses valid positive and negative minute strings', () => {
        // Sign of Date#getTimezoneOffset(): positive for west of UTC
        expect(parseTzOffset('180')).toBe(180);   // Brasília (UTC-3)
        expect(parseTzOffset('240')).toBe(240);   // Manaus (UTC-4)
        expect(parseTzOffset('120')).toBe(120);   // Fernando de Noronha (UTC-2)
        expect(parseTzOffset('300')).toBe(300);   // Acre / Rio Branco (UTC-5)
        expect(parseTzOffset('0')).toBe(0);       // UTC
        expect(parseTzOffset('-540')).toBe(-540); // Tokyo (UTC+9)
    });

    it('enforces maximum offset boundary of 14 hours (840 minutes)', () => {
        expect(parseTzOffset('840')).toBe(840);
        expect(parseTzOffset('-840')).toBe(-840);
        expect(parseTzOffset('841')).toBeNull();
        expect(parseTzOffset('-841')).toBeNull();
        expect(parseTzOffset('10000')).toBeNull();
    });

    it('returns null for empty, null, undefined, or invalid strings', () => {
        expect(parseTzOffset(null)).toBeNull();
        expect(parseTzOffset(undefined)).toBeNull();
        expect(parseTzOffset('')).toBeNull();
        expect(parseTzOffset('   ')).toBeNull();
        expect(parseTzOffset('not-a-number')).toBeNull();
    });
});

describe('viewer time: timeZoneOffset', () => {
    const fixedDate = new Date('2026-09-27T12:00:00Z');

    it('computes expected minute offsets for Brazilian and world timezones', () => {
        expect(timeZoneOffset(fixedDate, 'America/Sao_Paulo')).toBe(180);
        expect(timeZoneOffset(fixedDate, 'America/Manaus')).toBe(240);
        expect(timeZoneOffset(fixedDate, 'America/Noronha')).toBe(120);
        expect(timeZoneOffset(fixedDate, 'America/Rio_Branco')).toBe(300);
        expect(timeZoneOffset(fixedDate, 'UTC')).toBe(0);
        expect(timeZoneOffset(fixedDate, 'Asia/Tokyo')).toBe(-540);
    });

    it('defaults to America/Sao_Paulo when timeZone argument is omitted', () => {
        expect(timeZoneOffset(fixedDate)).toBe(180);
    });
});

describe('viewer time: viewerClock', () => {
    it('calculates viewer hour and calendar day for daytime hours', () => {
        // 15:30 UTC
        const now = new Date('2026-09-27T15:30:00Z');

        // Brasília (UTC-3: 180 offset) -> 12:30 on 2026-09-27
        const brasilia = viewerClock(now, 180);
        expect(brasilia.hour).toBe(12);
        expect(brasilia.day).toBe('2026-09-27');
        expect(brasilia.startOfDay.toISOString()).toBe('2026-09-27T03:00:00.000Z');

        // Manaus (UTC-4: 240 offset) -> 11:30 on 2026-09-27
        const manaus = viewerClock(now, 240);
        expect(manaus.hour).toBe(11);
        expect(manaus.day).toBe('2026-09-27');
        expect(manaus.startOfDay.toISOString()).toBe('2026-09-27T04:00:00.000Z');
    });

    it('defaults to Brasília time when tzOffset is null', () => {
        const now = new Date('2026-09-27T15:30:00Z');
        const defaultClock = viewerClock(now, null);
        expect(defaultClock.hour).toBe(12);
        expect(defaultClock.day).toBe('2026-09-27');
    });

    it('handles midnight boundary crossover correctly', () => {
        // 02:00 UTC on 2026-09-27
        const lateNightUtc = new Date('2026-09-27T02:00:00Z');

        // In Brasília (UTC-3): 02:00 - 3h = 23:00 of previous day (2026-09-26)
        const brasilia = viewerClock(lateNightUtc, 180);
        expect(brasilia.hour).toBe(23);
        expect(brasilia.day).toBe('2026-09-26');
        expect(brasilia.startOfDay.toISOString()).toBe('2026-09-26T03:00:00.000Z');

        // In Tokyo (UTC+9: -540 offset): 02:00 + 9h = 11:00 on 2026-09-27
        const tokyo = viewerClock(lateNightUtc, -540);
        expect(tokyo.hour).toBe(11);
        expect(tokyo.day).toBe('2026-09-27');
        expect(tokyo.startOfDay.toISOString()).toBe('2026-09-26T15:00:00.000Z');
    });
});
