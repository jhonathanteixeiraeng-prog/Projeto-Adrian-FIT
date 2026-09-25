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

export const MAX_REST_SECONDS = 600;

/** Parses a stored restBySet JSON ("[60,60,90]") into seconds per set; invalid values become null. */
export function parseRestBySetJson(raw: string | null | undefined): number[] | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const values = parsed.map((value) => Number(value));
        return values.every((value) => Number.isFinite(value) && value >= 0 && value <= MAX_REST_SECONDS) ? values.map(Math.round) : null;
    } catch {
        return null;
    }
}

/** Text shown in the editor's rest field: "60", or "60/60/90" when sets have different rests. */
export function formatRestInput(rest: number, restBySet?: number[] | null): string {
    if (restBySet && restBySet.length > 1 && restBySet.some((value) => value !== restBySet[0])) {
        return restBySet.join(REPS_PER_SET_SEPARATOR);
    }
    return String(restBySet?.[0] ?? rest);
}

/**
 * Parses the editor's rest field: "60", "60s" or per set "60/60/90" (separators like reps).
 * Per-set values are fitted to the number of sets (repeating the last one).
 * Returns null when the text is empty or not a list of whole seconds (0–3600).
 */
export function parseRestInput(raw: string, sets: number): { rest: number; restBySet: number[] | null } | null {
    const parts = parsePerSetReps(raw);
    if (parts.length === 0) return null;
    const values = parts.map((part) => Number(part.replace(/\s*(s|seg|segundos?)$/i, '')));
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > MAX_REST_SECONDS)) return null;
    if (values.length === 1) return { rest: values[0], restBySet: null };

    const totalSets = Math.max(1, sets || values.length);
    const fitted = Array.from({ length: totalSets }, (_, index) => values[Math.min(index, values.length - 1)]);
    if (fitted.every((value) => value === fitted[0])) return { rest: fitted[0], restBySet: null };
    return { rest: fitted[0], restBySet: fitted };
}
