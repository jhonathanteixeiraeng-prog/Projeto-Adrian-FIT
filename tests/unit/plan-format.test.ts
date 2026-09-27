import { describe, expect, it } from 'vitest';
import {
    formatIntensity,
    formatReps,
    formatRest,
    formatSubstitution,
    formatVolume,
} from '@/lib/plan-format';

describe('plan format: formatRest', () => {
    it('formats seconds below 1 minute', () => {
        expect(formatRest({ rest: 45 })).toBe('45 s');
        expect(formatRest({ rest: 30 })).toBe('30 s');
    });

    it('formats exact minutes without trailing seconds', () => {
        expect(formatRest({ rest: 60 })).toBe('1 min');
        expect(formatRest({ rest: 120 })).toBe('2 min');
    });

    it('formats minutes and remaining seconds', () => {
        expect(formatRest({ rest: 90 })).toBe('1 min 30 s');
        expect(formatRest({ rest: 125 })).toBe('2 min 5 s');
    });

    it('returns an em-dash when rest is null, undefined, or 0', () => {
        expect(formatRest({ rest: null })).toBe('—');
        expect(formatRest({ rest: undefined })).toBe('—');
        expect(formatRest({ rest: 0 })).toBe('—');
    });

    it('formats differing per-set rests from restBySet JSON', () => {
        expect(formatRest({ rest: 60, restBySet: '[60, 90, 120]' })).toBe('60/90/120 s');
    });

    it('falls back to single rest format when restBySet has identical values', () => {
        expect(formatRest({ rest: 60, restBySet: '[60, 60, 60]' })).toBe('1 min');
    });
});

describe('plan format: formatReps', () => {
    it('preserves single rep count or range', () => {
        expect(formatReps('10-12')).toBe('10-12');
        expect(formatReps('15')).toBe('15');
        expect(formatReps('até a falha')).toBe('até a falha');
    });

    it('joins multiple per-set values with /', () => {
        expect(formatReps('12/10/8')).toBe('12/10/8');
        expect(formatReps('12, 10, 8')).toBe('12/10/8');
    });

    it('returns an em-dash for empty or null reps', () => {
        expect(formatReps(null)).toBe('—');
        expect(formatReps(undefined)).toBe('—');
        expect(formatReps('')).toBe('—');
        expect(formatReps('   ')).toBe('—');
    });
});

describe('plan format: formatVolume', () => {
    it('formats single reps volume as sets × reps', () => {
        expect(formatVolume({ sets: 3, reps: '10-12' })).toBe('3 × 10-12');
        expect(formatVolume({ sets: 4, reps: '15' })).toBe('4 × 15');
    });

    it('formats per-set reps volume in parentheses with spaced slashes', () => {
        expect(formatVolume({ sets: 3, reps: '12/10/8' })).toBe('3 × (12 / 10 / 8)');
        expect(formatVolume({ sets: 4, reps: '15, 12, 10, 8' })).toBe('4 × (15 / 12 / 10 / 8)');
    });

    it('handles empty or null reps with an em-dash', () => {
        expect(formatVolume({ sets: 3, reps: null })).toBe('3 × —');
        expect(formatVolume({ sets: 3, reps: '' })).toBe('3 × —');
    });
});

describe('plan format: formatIntensity', () => {
    it('combines load and RPE with middle dot separator', () => {
        expect(formatIntensity({ load: '20', rpe: '8' })).toBe('20 kg · RPE 8');
        expect(formatIntensity({ load: '20/22.5/25', rpe: '8.5' })).toBe('20/22,5/25 kg · RPE 8,5');
        expect(formatIntensity({ load: '30', rpe: '7-8' })).toBe('30 kg · RPE 7-8');
    });

    it('formats load only when RPE is missing', () => {
        expect(formatIntensity({ load: '20' })).toBe('20 kg');
        expect(formatIntensity({ load: '20/25' })).toBe('20/25 kg');
    });

    it('formats RPE only when load is missing', () => {
        expect(formatIntensity({ rpe: '8' })).toBe('RPE 8');
        expect(formatIntensity({ rpe: '7-8' })).toBe('RPE 7-8');
    });

    it('returns empty string when neither load nor RPE is prescribed', () => {
        expect(formatIntensity({})).toBe('');
        expect(formatIntensity({ load: null, rpe: null })).toBe('');
    });
});

describe('plan format: formatSubstitution', () => {
    it('prefixes substitution note when prefix is absent', () => {
        expect(formatSubstitution('Iogurte natural desnatado 150g')).toBe('Pode trocar por: Iogurte natural desnatado 150g');
    });

    it('avoids duplicate prefix when note already starts with "Pode trocar por"', () => {
        expect(formatSubstitution('Pode trocar por: Iogurte natural desnatado 150g')).toBe('Pode trocar por: Iogurte natural desnatado 150g');
        expect(formatSubstitution('pode trocar por aveia')).toBe('pode trocar por aveia');
    });

    it('returns null for empty, whitespace, null, or undefined notes', () => {
        expect(formatSubstitution(null)).toBeNull();
        expect(formatSubstitution(undefined)).toBeNull();
        expect(formatSubstitution('')).toBeNull();
        expect(formatSubstitution('   ')).toBeNull();
    });
});
