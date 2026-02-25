export const REPS_PER_SET_SEPARATOR = '/';

const REP_SPLIT_REGEX = /[\/|;,]+/;

export function parsePerSetReps(rawReps: string): string[] {
    if (!rawReps) {
        return [];
    }

    return rawReps
        .split(REP_SPLIT_REGEX)
        .map((value) => value.trim())
        .filter(Boolean);
}

export function normalizePerSetReps(values: string[], sets: number, fallback = ''): string[] {
    const totalSets = Math.max(0, sets || 0);
    if (totalSets === 0) {
        return [];
    }

    const sanitizedValues = values.map((value) => value.trim());
    let lastKnownValue = fallback;
    for (let index = sanitizedValues.length - 1; index >= 0; index--) {
        if (sanitizedValues[index].length > 0) {
            lastKnownValue = sanitizedValues[index];
            break;
        }
    }

    return Array.from({ length: totalSets }, (_, index) => {
        const current = sanitizedValues[index];
        if (current && current.length > 0) {
            return current;
        }
        return lastKnownValue;
    });
}

export function buildRepsFromPerSet(values: string[]): string {
    return values
        .map((value) => value.trim())
        .filter(Boolean)
        .join(REPS_PER_SET_SEPARATOR);
}

export function inferRepsMode(rawReps: string, sets: number): {
    usePerSetReps: boolean;
    repsBySet: string[];
} {
    const parsed = parsePerSetReps(rawReps);
    const usePerSetReps = parsed.length > 1;
    const fallback = parsed[0] || rawReps?.trim() || '';

    return {
        usePerSetReps,
        repsBySet: normalizePerSetReps(parsed.length ? parsed : [fallback], sets, fallback),
    };
}
