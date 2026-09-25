/**
 * Prescribed load (kg) and intensity (RPE) of a workout item.
 *
 * Stored as text, like reps:
 * - load: "20" for every set, or one value per set "20/22.5/25" (dot decimals, kg);
 * - rpe:  "8", "8.5" or a range "7-8" (scale 1–10, steps of 0.5).
 * Both are optional. Separators and decimal commas typed in pt-BR are accepted on input.
 */

export const MAX_LOAD_KG = 500;

type Normalized = { ok: true; value: string | null } | { ok: false; error: string };

// Unlike reps, a comma is a decimal separator here ("12,5 kg"), so only "/", "|" and ";" split sets.
const LOAD_SPLIT = /\s*[\/|;]\s*/;
const KG_SUFFIX = /\s*(kg|quilos?)\s*$/i;

const formatNumber = (value: number) => String(Math.round(value * 100) / 100);

/** "20", "20 kg", "12,5/15/17,5" → [20] / [12.5, 15, 17.5]; [] when empty; null when not a list of loads. */
export function parseLoadInput(raw: string | null | undefined): number[] | null {
    const text = (raw ?? '').trim().replace(KG_SUFFIX, '');
    if (!text) return [];
    const parts = text
        .split(LOAD_SPLIT)
        .map((part) => part.trim().replace(KG_SUFFIX, ''))
        .filter(Boolean);
    if (parts.length === 0) return [];
    const values = parts.map((part) => (/^\d{1,3}([.,]\d{1,2})?$/.test(part) ? Number(part.replace(',', '.')) : NaN));
    return values.every((value) => Number.isFinite(value) && value >= 0 && value <= MAX_LOAD_KG) ? values : null;
}

/**
 * Validates and converts the typed load to its stored form, fitted to the number of sets:
 * fewer values than sets repeat the last one, identical values collapse to one ("20/20/20" → "20").
 */
export function normalizeLoadInput(raw: string | null | undefined, sets: number): Normalized {
    const values = parseLoadInput(raw);
    if (values === null) {
        return { ok: false, error: `Carga: use kg por série, ex.: 20 ou 20/22,5/25 (até ${MAX_LOAD_KG} kg)` };
    }
    if (values.length === 0) return { ok: true, value: null };
    const totalSets = Math.max(1, sets || 1);
    if (values.length > totalSets) {
        return { ok: false, error: `Carga: ${values.length} valores para ${totalSets} série${totalSets === 1 ? '' : 's'}` };
    }
    const fitted = Array.from({ length: totalSets }, (_, index) => values[Math.min(index, values.length - 1)]);
    const value = fitted.every((load) => load === fitted[0]) ? formatNumber(fitted[0]) : fitted.map(formatNumber).join('/');
    return { ok: true, value };
}

/** Prescribed load of one set (0-based), or null when there is none. */
export function loadForSet(stored: string | null | undefined, index: number): number | null {
    const values = parseLoadInput(stored);
    if (!values || values.length === 0) return null;
    return values[Math.min(index, values.length - 1)];
}

/** Text for inputs and read-only views in pt-BR: "20", "20/22,5/25". */
export function formatLoadInput(stored: string | null | undefined): string {
    const values = parseLoadInput(stored);
    if (!values || values.length === 0) return '';
    return values.map((value) => formatNumber(value).replace('.', ',')).join('/');
}

/** "20 kg", "20/22,5/25 kg" or "" when there is no prescribed load. */
export function formatLoad(stored: string | null | undefined): string {
    const text = formatLoadInput(stored);
    return text ? `${text} kg` : '';
}

const RPE_PREFIX = /^\s*(rpe|pse)\s*[:=]?\s*/i;

/** "8", "8,5", "7-8", "7 a 8", "RPE 8" → stored "8" / "8.5" / "7-8"; null when empty. */
export function normalizeRpeInput(raw: string | null | undefined): Normalized {
    const text = (raw ?? '').replace(RPE_PREFIX, '').trim();
    if (!text) return { ok: true, value: null };
    const parts = text.split(/\s*(?:-|–|até|a)\s*/i).filter(Boolean);
    const values = parts.map((part) => (/^\d{1,2}([.,]\d)?$/.test(part) ? Number(part.replace(',', '.')) : NaN));
    const valid =
        (values.length === 1 || values.length === 2) &&
        values.every((value) => Number.isFinite(value) && value >= 1 && value <= 10 && Number.isInteger(value * 2)) &&
        (values.length === 1 || values[0] < values[1]);
    if (!valid) return { ok: false, error: 'RPE: use de 1 a 10, ex.: 8, 8,5 ou 7-8' };
    return { ok: true, value: values.map(formatNumber).join('-') };
}

/** "RPE 8", "RPE 7-8" or "" when there is none. */
export function formatRpe(stored: string | null | undefined): string {
    return stored ? `RPE ${stored.replace(/\./g, ',')}` : '';
}
