import { describe, expect, it } from 'vitest';
import { buildRow } from '@/components/personal/students/crm';
import { STUDENTS_USE_APP } from '@/lib/features';
import { appClockStart, appIdleDays, sinceAppStart } from '@/lib/student-app';

const now = new Date('2026-09-27T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('student area clock (phase 2 pilot)', () => {
    it('starts at registration, or when the student joined the student area if later', () => {
        expect(appClockStart({ createdAt: daysAgo(90) }).toISOString()).toBe(daysAgo(90));
        expect(appClockStart({ createdAt: daysAgo(90), usesAppSince: daysAgo(2) }).toISOString()).toBe(daysAgo(2));
        // A join date before registration never moves the clock back.
        expect(appClockStart({ createdAt: daysAgo(5), usesAppSince: daysAgo(9) }).toISOString()).toBe(daysAgo(5));
    });

    it('ignores activity from before the clock started', () => {
        const start = new Date(daysAgo(2));
        expect(sinceAppStart(daysAgo(10), start)).toBeNull();
        expect(sinceAppStart(daysAgo(1), start)).toBe(daysAgo(1));
        expect(sinceAppStart(null, start)).toBeNull();
    });

    it('counts idle days from the last workout since joining, or from joining', () => {
        const joinedTwoDaysAgo = { createdAt: daysAgo(90), usesAppSince: daysAgo(2) };
        expect(appIdleDays(joinedTwoDaysAgo, daysAgo(30), now)).toEqual({ days: 2, trained: false });
        expect(appIdleDays(joinedTwoDaysAgo, daysAgo(1), now)).toEqual({ days: 1, trained: true });
        expect(appIdleDays({ createdAt: daysAgo(90) }, null, now)).toEqual({ days: 90, trained: false });
    });
});

describe.skipIf(STUDENTS_USE_APP)('students list: training rhythm', () => {
    const row = (student: object) =>
        buildRow({ id: 's1', status: 'ACTIVE', createdAt: daysAgo(90), user: { name: 'Ana' }, ...student } as never, now);

    it('only for students in the pilot, counted from when they joined', () => {
        // On PDF: no rhythm at all.
        expect(row({ usesApp: false })).toMatchObject({ app: false, onTrack: false, atRisk: false });
        // Just joined and hasn't trained in the app yet: not at risk yet.
        expect(row({ usesApp: true, usesAppSince: daysAgo(1) })).toMatchObject({ app: true, onTrack: false, atRisk: false });
        // Joined 5 days ago and hasn't trained since (a workout from before doesn't help).
        expect(row({ usesApp: true, usesAppSince: daysAgo(5), workoutSessions: [{ completedAt: daysAgo(40) }] })).toMatchObject({
            onTrack: false,
            atRisk: true,
        });
        expect(row({ usesApp: true, usesAppSince: daysAgo(5), workoutSessions: [{ completedAt: daysAgo(1) }] })).toMatchObject({
            onTrack: true,
            atRisk: false,
        });
    });
});
