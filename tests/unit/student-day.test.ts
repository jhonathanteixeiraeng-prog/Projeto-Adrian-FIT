import { describe, expect, it } from 'vitest';
import { browserDayQuery, isLocalDate, localDateAt, localDayRange, studentDay } from '@/lib/student-day';
import { dayStreak, nextCheckinLabel, weeklyStreak, workoutsThisWeek } from '@/lib/workout-stats';

describe("the student's day (A07)", () => {
    it('follows the offset the client sends (east positive, Manaus -240)', () => {
        const { start, end } = localDayRange('2026-09-25', -240);
        expect(start.toISOString()).toBe('2026-09-25T04:00:00.000Z');
        expect(end.toISOString()).toBe('2026-09-26T04:00:00.000Z');

        // 01:00 UTC on the 26th is still the evening of the 25th in Manaus.
        const lateEvening = new Date('2026-09-26T01:00:00Z');
        expect(localDateAt(lateEvening, -240)).toBe('2026-09-25');
        expect(studentDay({ timezoneOffsetMinutes: -240 }, lateEvening)).toMatchObject({ localDate: '2026-09-25', start });
        expect(studentDay({ timezoneOffsetMinutes: '-240', localDate: '2026-09-24' }, lateEvening).localDate).toBe('2026-09-24');
    });

    it('keeps the server day for older clients and ignores values out of range', () => {
        const now = new Date('2026-09-26T15:00:00Z');
        const serverDay = studentDay({}, now);
        const local = new Date(now);
        local.setHours(0, 0, 0, 0);
        expect(serverDay.start.getTime()).toBe(local.getTime());
        expect(studentDay({ timezoneOffsetMinutes: 5000 }, now).start.getTime()).toBe(local.getTime());
        expect(studentDay({ localDate: '2026-09-20' }, now)).toMatchObject({ localDate: '2026-09-20', start: local });
    });

    it('accepts only real calendar dates', () => {
        expect(isLocalDate('2026-02-28')).toBe(true);
        for (const bad of ['2026-02-30', '2026-13-01', '26-09-2026', '2026-9-1', '', null]) expect(isLocalDate(bad), String(bad)).toBe(false);
    });

    it("the browser's query carries its date and offset", () => {
        expect(browserDayQuery()).toMatch(/^localDate=\d{4}-\d{2}-\d{2}&tz=-?\d+$/);
    });
});

describe('workout stats (A21)', () => {
    const today = '2026-09-26'; // a Saturday

    it('counts sessions of the current week (Monday to Sunday)', () => {
        expect(workoutsThisWeek(['2026-09-21', '2026-09-24', '2026-09-26', '2026-09-20', '2026-09-28'], today)).toBe(3);
    });

    it('counts consecutive days with a workout, not broken until today ends', () => {
        expect(dayStreak(['2026-09-26', '2026-09-25', '2026-09-24', '2026-09-22'], today)).toBe(3);
        expect(dayStreak(['2026-09-25', '2026-09-24'], today)).toBe(2);
        expect(dayStreak(['2026-09-23'], today)).toBe(0);
        expect(dayStreak([], today)).toBe(0);
    });

    it('counts consecutive weeks reaching the goal', () => {
        const dates = ['2026-09-21', '2026-09-23', '2026-09-14', '2026-09-16', '2026-09-08'];
        expect(weeklyStreak(dates, 2, today)).toBe(2);
        expect(weeklyStreak(dates, 3, today)).toBe(0);
    });

    it('says when the next weekly check-in is due', () => {
        expect(nextCheckinLabel(null, today)).toBe('Hoje');
        expect(nextCheckinLabel('2026-09-19', today)).toBe('Hoje');
        expect(nextCheckinLabel('2026-09-20', today)).toBe('Amanhã');
        expect(nextCheckinLabel('2026-09-24', today)).toBe('Quinta');
    });
});
