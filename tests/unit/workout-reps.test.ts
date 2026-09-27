import { describe, expect, it } from 'vitest';
import {
    MAX_REST_SECONDS,
    REPS_PER_SET_SEPARATOR,
    buildRepsFromPerSet,
    formatRestInput,
    inferRepsMode,
    normalizePerSetReps,
    parsePerSetReps,
    parseRestBySetJson,
    parseRestInput,
} from '@/lib/workout-reps';

describe('workout reps: separators and limits', () => {
    it('defines standard separator and max rest seconds', () => {
        expect(REPS_PER_SET_SEPARATOR).toBe('/');
        expect(MAX_REST_SECONDS).toBe(600);
    });
});

describe('workout reps: parsePerSetReps', () => {
    it('parses reps split by /, commas, semicolons, or pipes', () => {
        expect(parsePerSetReps('10/12/14')).toEqual(['10', '12', '14']);
        expect(parsePerSetReps('10, 12, 14')).toEqual(['10', '12', '14']);
        expect(parsePerSetReps('10 ; 12 ; 14')).toEqual(['10', '12', '14']);
        expect(parsePerSetReps('10 | 12 | 14')).toEqual(['10', '12', '14']);
    });

    it('preserves single range string', () => {
        expect(parsePerSetReps('10-12')).toEqual(['10-12']);
        expect(parsePerSetReps('12 a 15')).toEqual(['12 a 15']);
    });

    it('returns empty array for empty or null input', () => {
        expect(parsePerSetReps('')).toEqual([]);
        expect(parsePerSetReps(null as unknown as string)).toEqual([]);
        expect(parsePerSetReps(undefined as unknown as string)).toEqual([]);
    });
});

describe('workout reps: normalizePerSetReps', () => {
    it('fits per-set reps to total sets repeating the last value', () => {
        expect(normalizePerSetReps(['12', '10'], 4, '8')).toEqual(['12', '10', '10', '10']);
    });

    it('uses fallback when input values are empty', () => {
        expect(normalizePerSetReps([], 3, '10')).toEqual(['10', '10', '10']);
    });

    it('fills internal empty slots from the last known non-empty value', () => {
        expect(normalizePerSetReps(['12', '', '8'], 4)).toEqual(['12', '8', '8', '8']);
    });

    it('returns empty array when sets is 0 or negative', () => {
        expect(normalizePerSetReps(['10'], 0)).toEqual([]);
        expect(normalizePerSetReps(['10'], -1)).toEqual([]);
    });
});

describe('workout reps: buildRepsFromPerSet', () => {
    it('joins non-empty values using the standard separator', () => {
        expect(buildRepsFromPerSet(['12', '10', '8'])).toBe('12/10/8');
        expect(buildRepsFromPerSet(['12', '  ', '8'])).toBe('12/8');
        expect(buildRepsFromPerSet([])).toBe('');
    });
});

describe('workout reps: inferRepsMode', () => {
    it('detects per-set mode when input has multiple values', () => {
        const mode = inferRepsMode('12/10/8', 3);
        expect(mode.usePerSetReps).toBe(true);
        expect(mode.repsBySet).toEqual(['12', '10', '8']);
    });

    it('detects single reps mode and repeats the value across sets', () => {
        const mode = inferRepsMode('10-12', 3);
        expect(mode.usePerSetReps).toBe(false);
        expect(mode.repsBySet).toEqual(['10-12', '10-12', '10-12']);
    });

    it('handles empty reps safely', () => {
        const mode = inferRepsMode('', 2);
        expect(mode.usePerSetReps).toBe(false);
        expect(mode.repsBySet).toEqual(['', '']);
    });
});

describe('workout reps: parseRestBySetJson', () => {
    it('parses valid JSON array of numbers and rounds values', () => {
        expect(parseRestBySetJson('[60, 60, 90]')).toEqual([60, 60, 90]);
        expect(parseRestBySetJson('[60.2, 89.8]')).toEqual([60, 90]);
    });

    it('returns null for empty, invalid JSON, or non-array JSON', () => {
        expect(parseRestBySetJson(null)).toBeNull();
        expect(parseRestBySetJson('')).toBeNull();
        expect(parseRestBySetJson('not json')).toBeNull();
        expect(parseRestBySetJson('{}')).toBeNull();
        expect(parseRestBySetJson('[]')).toBeNull();
    });

    it('returns null when any value is negative or exceeds MAX_REST_SECONDS', () => {
        expect(parseRestBySetJson('[-5, 60]')).toBeNull();
        expect(parseRestBySetJson(`[60, ${MAX_REST_SECONDS + 1}]`)).toBeNull();
        expect(parseRestBySetJson('[60, "abc"]')).toBeNull();
    });
});

describe('workout reps: formatRestInput', () => {
    it('formats rest string with / when sets have differing rests', () => {
        expect(formatRestInput(60, [60, 60, 90])).toBe('60/60/90');
    });

    it('collapses to single number when restBySet has identical values or is null', () => {
        expect(formatRestInput(60, [60, 60, 60])).toBe('60');
        expect(formatRestInput(60, null)).toBe('60');
        expect(formatRestInput(60, [90])).toBe('90');
    });
});

describe('workout reps: parseRestInput', () => {
    it('parses single rest value and strips unit suffixes', () => {
        expect(parseRestInput('60', 3)).toEqual({ rest: 60, restBySet: null });
        expect(parseRestInput('60s', 3)).toEqual({ rest: 60, restBySet: null });
        expect(parseRestInput('60 seg', 3)).toEqual({ rest: 60, restBySet: null });
        expect(parseRestInput('60 segundos', 3)).toEqual({ rest: 60, restBySet: null });
    });

    it('parses differing per-set rests fitted to sets count', () => {
        expect(parseRestInput('60/90/120', 3)).toEqual({ rest: 60, restBySet: [60, 90, 120] });
        expect(parseRestInput('60/90', 4)).toEqual({ rest: 60, restBySet: [60, 90, 90, 90] });
    });

    it('collapses identical per-set values to single rest', () => {
        expect(parseRestInput('60/60/60', 3)).toEqual({ rest: 60, restBySet: null });
    });

    it('returns null for empty, invalid, non-integer, or out-of-range inputs', () => {
        expect(parseRestInput('', 3)).toBeNull();
        expect(parseRestInput('abc', 3)).toBeNull();
        expect(parseRestInput('-10', 3)).toBeNull();
        expect(parseRestInput(`${MAX_REST_SECONDS + 1}`, 3)).toBeNull();
        expect(parseRestInput('60.5', 3)).toBeNull();
    });
});
