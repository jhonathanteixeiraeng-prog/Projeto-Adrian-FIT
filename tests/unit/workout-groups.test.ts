import { describe, expect, it } from 'vitest';
import {
    describeGroups,
    findGroupIssues,
    groupLabel,
    normalizedGroupIds,
    sessionSequence,
    type GroupableItem,
} from '@/lib/workout-groups';

describe('workout groups: groupLabel', () => {
    it('returns Bi-set for 2 or fewer exercises', () => {
        expect(groupLabel(1)).toBe('Bi-set');
        expect(groupLabel(2)).toBe('Bi-set');
    });

    it('returns Tri-set for exactly 3 exercises', () => {
        expect(groupLabel(3)).toBe('Tri-set');
    });

    it('returns Circuito for 4 or more exercises', () => {
        expect(groupLabel(4)).toBe('Circuito');
        expect(groupLabel(5)).toBe('Circuito');
        expect(groupLabel(10)).toBe('Circuito');
    });
});

describe('workout groups: findGroupIssues', () => {
    it('finds no issues in valid contiguous groups with equal sets', () => {
        const items: GroupableItem[] = [
            { groupId: 'g1', sets: 3 },
            { groupId: 'g1', sets: 3 },
            { groupId: null, sets: 4 },
            { groupId: 'g2', sets: 4 },
            { groupId: 'g2', sets: 4 },
            { groupId: 'g2', sets: 4 },
        ];
        expect(findGroupIssues(items)).toEqual([]);
    });

    it('ignores single-member groups (they are simply ungrouped, not invalid)', () => {
        const items: GroupableItem[] = [
            { groupId: 'alone', sets: 3 },
            { groupId: null, sets: 4 },
        ];
        expect(findGroupIssues(items)).toEqual([]);
    });

    it('flags non-contiguous exercises in a group', () => {
        const items: GroupableItem[] = [
            { groupId: 'g1', sets: 3 },
            { groupId: null, sets: 3 }, // Interruption
            { groupId: 'g1', sets: 3 },
        ];
        const issues = findGroupIssues(items);
        expect(issues).toHaveLength(1);
        expect(issues[0].index).toBe(2);
        expect(issues[0].message).toContain('Bi-set: os exercícios do grupo precisam ficar em sequência');
    });

    it('flags exercises in the same group with different sets count', () => {
        const items: GroupableItem[] = [
            { groupId: 'g1', sets: 3 },
            { groupId: 'g1', sets: 4 }, // Mismatch: 4 !== 3
        ];
        const issues = findGroupIssues(items);
        expect(issues).toHaveLength(1);
        expect(issues[0].index).toBe(1);
        expect(issues[0].message).toContain('Bi-set: os exercícios do grupo precisam ter o mesmo número de séries');
    });

    it('flags both non-contiguous and sets mismatch when both occur in a circuit', () => {
        const items: GroupableItem[] = [
            { groupId: 'c1', sets: 3 },
            { groupId: null, sets: 2 },
            { groupId: 'c1', sets: 4 },
            { groupId: 'c1', sets: 3 },
            { groupId: 'c1', sets: 3 },
        ];
        const issues = findGroupIssues(items);
        expect(issues.length).toBeGreaterThanOrEqual(2);
        expect(issues.some((i) => i.message.includes('Circuito: os exercícios do grupo precisam ficar em sequência'))).toBe(true);
        expect(issues.some((i) => i.message.includes('Circuito: os exercícios do grupo precisam ter o mesmo número de séries'))).toBe(true);
    });
});

describe('workout groups: normalizedGroupIds', () => {
    it('cleans whitespace and nullifies single-member groups', () => {
        const items: GroupableItem[] = [
            { groupId: ' g1 ', sets: 3 },
            { groupId: 'g1', sets: 3 },
            { groupId: 'alone', sets: 3 },
            { groupId: '   ', sets: 3 },
            { groupId: null, sets: 3 },
        ];
        expect(normalizedGroupIds(items)).toEqual(['g1', 'g1', null, null, null]);
    });

    it('retains invalid groups when repairInvalid is false or omitted', () => {
        const items: GroupableItem[] = [
            { groupId: 'split', sets: 3 },
            { groupId: null, sets: 3 },
            { groupId: 'split', sets: 4 },
        ];
        expect(normalizedGroupIds(items)).toEqual(['split', null, 'split']);
        expect(normalizedGroupIds(items, { repairInvalid: false })).toEqual(['split', null, 'split']);
    });

    it('clears invalid groups to null when repairInvalid is true', () => {
        const nonContiguous: GroupableItem[] = [
            { groupId: 'split', sets: 3 },
            { groupId: null, sets: 3 },
            { groupId: 'split', sets: 3 },
        ];
        expect(normalizedGroupIds(nonContiguous, { repairInvalid: true })).toEqual([null, null, null]);

        const setsMismatch: GroupableItem[] = [
            { groupId: 'mismatch', sets: 3 },
            { groupId: 'mismatch', sets: 4 },
        ];
        expect(normalizedGroupIds(setsMismatch, { repairInvalid: true })).toEqual([null, null]);

        const valid: GroupableItem[] = [
            { groupId: 'valid', sets: 3 },
            { groupId: 'valid', sets: 3 },
        ];
        expect(normalizedGroupIds(valid, { repairInvalid: true })).toEqual(['valid', 'valid']);
    });
});

describe('workout groups: describeGroups', () => {
    it('returns null for ungrouped exercises and assigns letters A, B in order', () => {
        const items: GroupableItem[] = [
            { groupId: null, sets: 3 },
            { groupId: 'g1', sets: 3 },
            { groupId: 'g1', sets: 3 },
            { groupId: null, sets: 3 },
            { groupId: 'g2', sets: 4 },
            { groupId: 'g2', sets: 4 },
            { groupId: 'g2', sets: 4 },
        ];

        const described = describeGroups(items);
        expect(described[0]).toBeNull();
        expect(described[3]).toBeNull();

        // Group A (bi-set)
        expect(described[1]).toEqual({
            groupId: 'g1',
            letter: 'A',
            position: 1,
            size: 2,
            label: 'Bi-set',
            isFirst: true,
            isLast: false,
        });
        expect(described[2]).toEqual({
            groupId: 'g1',
            letter: 'A',
            position: 2,
            size: 2,
            label: 'Bi-set',
            isFirst: false,
            isLast: true,
        });

        // Group B (tri-set)
        expect(described[4]).toEqual({
            groupId: 'g2',
            letter: 'B',
            position: 1,
            size: 3,
            label: 'Tri-set',
            isFirst: true,
            isLast: false,
        });
        expect(described[5]).toEqual({
            groupId: 'g2',
            letter: 'B',
            position: 2,
            size: 3,
            label: 'Tri-set',
            isFirst: false,
            isLast: false,
        });
        expect(described[6]).toEqual({
            groupId: 'g2',
            letter: 'B',
            position: 3,
            size: 3,
            label: 'Tri-set',
            isFirst: false,
            isLast: true,
        });
    });
});

describe('workout groups: sessionSequence', () => {
    it('sequences ungrouped exercises set by set, resting after every set', () => {
        const items: GroupableItem[] = [
            { groupId: null, sets: 2 },
            { groupId: null, sets: 1 },
        ];
        const steps = sessionSequence(items);
        expect(steps).toEqual([
            { itemIndex: 0, setIndex: 0, restAfter: true },
            { itemIndex: 0, setIndex: 1, restAfter: true },
            { itemIndex: 1, setIndex: 0, restAfter: true },
        ]);
    });

    it('sequences bi-set round by round, resting only on the last exercise of each round', () => {
        const items: GroupableItem[] = [
            { groupId: 'biset', sets: 2 },
            { groupId: 'biset', sets: 2 },
        ];
        const steps = sessionSequence(items);
        expect(steps).toEqual([
            // Round 1
            { itemIndex: 0, setIndex: 0, restAfter: false },
            { itemIndex: 1, setIndex: 0, restAfter: true },
            // Round 2
            { itemIndex: 0, setIndex: 1, restAfter: false },
            { itemIndex: 1, setIndex: 1, restAfter: true },
        ]);
    });

    it('sequences a mixed workout day accurately', () => {
        const items: GroupableItem[] = [
            { groupId: null, sets: 1 }, // Ungrouped warm-up
            { groupId: 'superset', sets: 2 }, // Bi-set A1
            { groupId: 'superset', sets: 2 }, // Bi-set A2
            { groupId: null, sets: 1 }, // Finisher
        ];
        const steps = sessionSequence(items);
        expect(steps).toEqual([
            { itemIndex: 0, setIndex: 0, restAfter: true },
            // Bi-set Round 1
            { itemIndex: 1, setIndex: 0, restAfter: false },
            { itemIndex: 2, setIndex: 0, restAfter: true },
            // Bi-set Round 2
            { itemIndex: 1, setIndex: 1, restAfter: false },
            { itemIndex: 2, setIndex: 1, restAfter: true },
            // Finisher
            { itemIndex: 3, setIndex: 0, restAfter: true },
        ]);
    });

    it('handles items with 0 sets without generating invalid steps', () => {
        const items: GroupableItem[] = [
            { groupId: null, sets: 0 },
            { groupId: null, sets: 1 },
        ];
        const steps = sessionSequence(items);
        expect(steps).toEqual([
            { itemIndex: 1, setIndex: 0, restAfter: true },
        ]);
    });
});
