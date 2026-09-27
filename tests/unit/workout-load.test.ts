import { describe, expect, it } from 'vitest';
import {
    MAX_LOAD_KG,
    formatLoad,
    formatLoadInput,
    formatRpe,
    loadForSet,
    normalizeLoadInput,
    normalizeRpeInput,
    parseLoadInput,
} from '@/lib/workout-load';

describe('workout load: parseLoadInput', () => {
    it('parses single integer and decimal loads with dot or comma', () => {
        expect(parseLoadInput('20')).toEqual([20]);
        expect(parseLoadInput('12.5')).toEqual([12.5]);
        expect(parseLoadInput('12,5')).toEqual([12.5]);
        expect(parseLoadInput('0.25')).toEqual([0.25]);
        expect(parseLoadInput('0,5')).toEqual([0.5]);
    });

    it('strips kg / quilos suffixes', () => {
        expect(parseLoadInput('20 kg')).toEqual([20]);
        expect(parseLoadInput('20kg')).toEqual([20]);
        expect(parseLoadInput('25 quilos')).toEqual([25]);
        expect(parseLoadInput('15 quilo')).toEqual([15]);
    });

    it('parses multiple per-set loads separated by /, |, or ;', () => {
        expect(parseLoadInput('20/25/30')).toEqual([20, 25, 30]);
        expect(parseLoadInput('20 | 25 | 30')).toEqual([20, 25, 30]);
        expect(parseLoadInput('20 ; 25 ; 30')).toEqual([20, 25, 30]);
        expect(parseLoadInput('12,5 / 15 / 17,5 kg')).toEqual([12.5, 15, 17.5]);
        expect(parseLoadInput('20kg / 25kg / 30kg')).toEqual([20, 25, 30]);
    });

    it('returns empty array for empty, null, or whitespace input', () => {
        expect(parseLoadInput('')).toEqual([]);
        expect(parseLoadInput(null)).toEqual([]);
        expect(parseLoadInput(undefined)).toEqual([]);
        expect(parseLoadInput('   ')).toEqual([]);
    });

    it('returns null for invalid, negative, or out-of-range loads', () => {
        expect(parseLoadInput('abc')).toBeNull();
        expect(parseLoadInput('20/abc')).toBeNull();
        expect(parseLoadInput('-5')).toBeNull();
        expect(parseLoadInput(`${MAX_LOAD_KG + 1}`)).toBeNull();
        expect(parseLoadInput('1000')).toBeNull();
        expect(parseLoadInput('12.345')).toBeNull(); // More than 2 decimal places
    });
});

describe('workout load: normalizeLoadInput', () => {
    it('returns null value for empty input', () => {
        expect(normalizeLoadInput('', 3)).toEqual({ ok: true, value: null });
        expect(normalizeLoadInput(null, 3)).toEqual({ ok: true, value: null });
    });

    it('normalizes single load across sets and collapses identical values', () => {
        expect(normalizeLoadInput('20', 3)).toEqual({ ok: true, value: '20' });
        expect(normalizeLoadInput('20/20/20', 3)).toEqual({ ok: true, value: '20' });
        expect(normalizeLoadInput('20,0/20', 2)).toEqual({ ok: true, value: '20' });
    });

    it('normalizes distinct per-set loads with dot decimals', () => {
        expect(normalizeLoadInput('20/22,5/25', 3)).toEqual({ ok: true, value: '20/22.5/25' });
    });

    it('repeats the last load when fewer values than sets are provided', () => {
        expect(normalizeLoadInput('20/25', 4)).toEqual({ ok: true, value: '20/25/25/25' });
    });

    it('rejects input with more values than prescribed sets', () => {
        const result = normalizeLoadInput('20/25/30/35', 3);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('Carga: 4 valores para 3 séries');
        }
    });

    it('rejects invalid load values', () => {
        const result = normalizeLoadInput('abc', 3);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain(`Carga: use kg por série, ex.: 20 ou 20/22,5/25 (até ${MAX_LOAD_KG} kg)`);
        }
    });
});

describe('workout load: loadForSet', () => {
    it('returns prescribed load for a given set index', () => {
        expect(loadForSet('20', 0)).toBe(20);
        expect(loadForSet('20', 2)).toBe(20);

        expect(loadForSet('20/25/30', 0)).toBe(20);
        expect(loadForSet('20/25/30', 1)).toBe(25);
        expect(loadForSet('20/25/30', 2)).toBe(30);
    });

    it('repeats the last load when index is out of bounds', () => {
        expect(loadForSet('20/25/30', 5)).toBe(30);
    });

    it('returns null when stored load is empty or invalid', () => {
        expect(loadForSet(null, 0)).toBeNull();
        expect(loadForSet('', 0)).toBeNull();
        expect(loadForSet('invalid', 0)).toBeNull();
    });
});

describe('workout load: formatLoadInput and formatLoad', () => {
    it('formats loads for display with pt-BR decimal comma', () => {
        expect(formatLoadInput('20')).toBe('20');
        expect(formatLoadInput('12.5')).toBe('12,5');
        expect(formatLoadInput('20/22.5/25')).toBe('20/22,5/25');
        expect(formatLoadInput(null)).toBe('');
        expect(formatLoadInput('')).toBe('');
    });

    it('formats loads with kg unit for cards and badges', () => {
        expect(formatLoad('20')).toBe('20 kg');
        expect(formatLoad('20/22.5/25')).toBe('20/22,5/25 kg');
        expect(formatLoad(null)).toBe('');
        expect(formatLoad('')).toBe('');
    });
});

describe('workout load: normalizeRpeInput', () => {
    it('returns null value for empty input', () => {
        expect(normalizeRpeInput('')).toEqual({ ok: true, value: null });
        expect(normalizeRpeInput(null)).toEqual({ ok: true, value: null });
    });

    it('normalizes single RPE value with half-step precision and strips prefix', () => {
        expect(normalizeRpeInput('8')).toEqual({ ok: true, value: '8' });
        expect(normalizeRpeInput('8.5')).toEqual({ ok: true, value: '8.5' });
        expect(normalizeRpeInput('8,5')).toEqual({ ok: true, value: '8.5' });
        expect(normalizeRpeInput('RPE 8')).toEqual({ ok: true, value: '8' });
        expect(normalizeRpeInput('PSE: 8,5')).toEqual({ ok: true, value: '8.5' });
    });

    it('normalizes RPE ranges with various separators', () => {
        expect(normalizeRpeInput('7-8')).toEqual({ ok: true, value: '7-8' });
        expect(normalizeRpeInput('7 a 8')).toEqual({ ok: true, value: '7-8' });
        expect(normalizeRpeInput('7 até 8')).toEqual({ ok: true, value: '7-8' });
        expect(normalizeRpeInput('7 – 8')).toEqual({ ok: true, value: '7-8' });
        expect(normalizeRpeInput('7,5 - 8,5')).toEqual({ ok: true, value: '7.5-8.5' });
    });

    it('rejects values outside scale 1–10 or not divisible by 0.5', () => {
        expect(normalizeRpeInput('0').ok).toBe(false);
        expect(normalizeRpeInput('10.5').ok).toBe(false);
        expect(normalizeRpeInput('11').ok).toBe(false);
        expect(normalizeRpeInput('8.2').ok).toBe(false);
        expect(normalizeRpeInput('8,7').ok).toBe(false);
    });

    it('rejects descending or equal ranges and non-numeric inputs', () => {
        expect(normalizeRpeInput('8-7').ok).toBe(false);
        expect(normalizeRpeInput('7-7').ok).toBe(false);
        expect(normalizeRpeInput('moderado').ok).toBe(false);
    });
});

describe('workout load: formatRpe', () => {
    it('formats RPE stored string for UI with comma decimal', () => {
        expect(formatRpe('8')).toBe('RPE 8');
        expect(formatRpe('8.5')).toBe('RPE 8,5');
        expect(formatRpe('7-8')).toBe('RPE 7-8');
        expect(formatRpe('7.5-8.5')).toBe('RPE 7,5-8,5');
        expect(formatRpe(null)).toBe('');
        expect(formatRpe('')).toBe('');
    });
});
