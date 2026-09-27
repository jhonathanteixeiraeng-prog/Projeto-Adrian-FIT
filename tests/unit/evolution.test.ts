import { describe, expect, it } from 'vitest';
import {
    evolutionRecords,
    weightRange,
    type EvolutionRecord,
} from '@/lib/evolution';

describe('evolution: evolutionRecords', () => {
    it('combines assessments and check-ins in descending date order (newest first)', () => {
        const checkins = [
            { id: 'c1', date: '2026-09-15T10:00:00Z', weight: 75.0, notes: 'Semana 1' },
            { id: 'c2', date: '2026-09-25T10:00:00Z', weight: 74.2, notes: 'Semana 2' },
        ];
        const assessments = [
            { id: 'a1', date: '2026-09-20T14:00:00Z', weight: 74.8, chest: 98, notes: 'Avaliação mensal' },
        ];

        const timeline = evolutionRecords(checkins, assessments);
        expect(timeline).toHaveLength(3);

        // Newest first: c2 (25/09) -> a1 (20/09) -> c1 (15/09)
        expect(timeline[0].id).toBe('c2');
        expect(timeline[0].source).toBe('CHECKIN');
        expect(timeline[0].weight).toBe(74.2);

        expect(timeline[1].id).toBe('a1');
        expect(timeline[1].source).toBe('ASSESSMENT');
        expect(timeline[1].weight).toBe(74.8);
        expect(timeline[1].chest).toBe(98);

        expect(timeline[2].id).toBe('c1');
        expect(timeline[2].source).toBe('CHECKIN');
        expect(timeline[2].weight).toBe(75.0);
    });

    it('orders assessment before check-in on timestamp tie', () => {
        const checkins = [{ id: 'c1', date: '2026-09-20T10:00:00Z', weight: 75 }];
        const assessments = [{ id: 'a1', date: '2026-09-20T10:00:00Z', weight: 75 }];

        const timeline = evolutionRecords(checkins, assessments);
        expect(timeline[0].source).toBe('ASSESSMENT');
        expect(timeline[1].source).toBe('CHECKIN');
    });

    it('fills all assessment measure keys with null when omitted', () => {
        const checkins = [{ id: 'c1', date: '2026-09-20T10:00:00Z', weight: 75 }];
        const timeline = evolutionRecords(checkins, []);
        expect(timeline[0].chest).toBeNull();
        expect(timeline[0].waist).toBeNull();
        expect(timeline[0].armRight).toBeNull();
        expect(timeline[0].armLeft).toBeNull();
        expect(timeline[0].bodyFatPercentage).toBeNull();
    });

    it('returns empty array when both inputs are empty', () => {
        expect(evolutionRecords([], [])).toEqual([]);
    });
});

describe('evolution: weightRange', () => {
    it('finds latest and earliest records with weight from newest-first records', () => {
        const records: EvolutionRecord[] = [
            { id: '1', date: '2026-09-25T00:00:00Z', source: 'CHECKIN', notes: null, weight: 73.5 } as EvolutionRecord,
            { id: '2', date: '2026-09-20T00:00:00Z', source: 'ASSESSMENT', notes: null, weight: 74.0 } as EvolutionRecord,
            { id: '3', date: '2026-09-15T00:00:00Z', source: 'CHECKIN', notes: null, weight: 75.0 } as EvolutionRecord,
        ];

        const range = weightRange(records);
        expect(range.latest?.id).toBe('1');
        expect(range.latest?.weight).toBe(73.5);

        expect(range.earliest?.id).toBe('3');
        expect(range.earliest?.weight).toBe(75.0);
    });

    it('ignores records without weight', () => {
        const records: EvolutionRecord[] = [
            { id: '1', date: '2026-09-25T00:00:00Z', source: 'CHECKIN', notes: null, weight: null } as EvolutionRecord,
            { id: '2', date: '2026-09-20T00:00:00Z', source: 'ASSESSMENT', notes: null, weight: 74.0 } as EvolutionRecord,
        ];

        const range = weightRange(records);
        expect(range.latest?.id).toBe('2');
        expect(range.earliest?.id).toBe('2');
    });

    it('uses firstCheckin when it is older than timeline records', () => {
        const records: EvolutionRecord[] = [
            { id: '1', date: '2026-09-25T00:00:00Z', source: 'CHECKIN', notes: null, weight: 73.5 } as EvolutionRecord,
        ];
        const initialCheckin = {
            id: 'c0',
            date: '2026-08-01T00:00:00Z',
            weight: 78.0,
            notes: 'Checkin inicial de onboarding',
        };

        const range = weightRange(records, initialCheckin);
        expect(range.latest?.id).toBe('1');
        expect(range.latest?.weight).toBe(73.5);

        expect(range.earliest?.id).toBe('c0');
        expect(range.earliest?.weight).toBe(78.0);
        expect(range.earliest?.source).toBe('CHECKIN');
    });

    it('returns nulls when no record has a weight', () => {
        expect(weightRange([])).toEqual({ latest: null, earliest: null });

        const recordsNoWeight: EvolutionRecord[] = [
            { id: '1', date: '2026-09-25T00:00:00Z', source: 'CHECKIN', notes: null, weight: null } as EvolutionRecord,
        ];
        expect(weightRange(recordsNoWeight)).toEqual({ latest: null, earliest: null });
    });
});
