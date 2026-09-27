/**
 * The student's check-in, validated on the server (audit A11): every number is a whole value in its range
 * ("72,5" and 72.5 both work; "72kg" doesn't), 0 hours of sleep is a value and not a missing field, and
 * nothing out of range is saved.
 */

const MEASURES = ['chest', 'waist', 'abdomen', 'hips', 'armRight', 'armLeft', 'thighRight', 'thighLeft', 'calfRight', 'calfLeft'] as const;
const PHOTO_ANGLES = ['FRONT', 'SIDE', 'BACK', 'OTHER'] as const;
const MAX_PHOTOS = 6;
const MAX_NOTES = 2000;

export interface CheckinInput {
    weight: number;
    sleepHours: number;
    energyLevel: number;
    hungerLevel: number;
    stressLevel: number;
    workoutAdherence: number;
    dietAdherence: number;
    notes: string | null;
    measures: Partial<Record<(typeof MEASURES)[number], number | null>>;
    bodyFatPercentage: number | null;
    photos: Array<{ url: string; angle: (typeof PHOTO_ANGLES)[number] }>;
}

export type CheckinParse = { ok: true; value: CheckinInput } | { ok: false; error: string };

const missing = (value: unknown) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** A finite number from a number or a decimal string (comma or dot); null when it isn't one. */
function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const text = value.trim().replace(',', '.');
    return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
}

export function parseCheckinBody(body: unknown): CheckinParse {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Dados do check-in inválidos' };
    const data = body as Record<string, unknown>;

    const number = (field: string, label: string, min: number, max: number, options: { required?: boolean; fallback?: number; integer?: boolean } = {}) => {
        const raw = data[field];
        if (missing(raw)) {
            if (options.required) throw new CheckinError(`${label}: campo obrigatório`);
            return options.fallback ?? null;
        }
        const value = toNumber(raw);
        if (value === null || value < min || value > max || (options.integer && !Number.isInteger(value))) {
            throw new CheckinError(`${label}: informe ${options.integer ? 'um número inteiro' : 'um valor'} entre ${min} e ${max}`);
        }
        return value;
    };

    try {
        const weight = number('weight', 'Peso', 20, 400, { required: true })!;
        const sleepHours = number('sleepHours', 'Horas de sono', 0, 24, { required: true })!;
        const energyLevel = number('energyLevel', 'Energia', 1, 5, { fallback: 3, integer: true })!;
        const hungerLevel = number('hungerLevel', 'Fome', 1, 5, { fallback: 3, integer: true })!;
        const stressLevel = number('stressLevel', 'Estresse', 1, 5, { fallback: 3, integer: true })!;
        const workoutAdherence = number('workoutAdherence', 'Adesão ao treino', 0, 100, { fallback: 0, integer: true })!;
        const dietAdherence = number('dietAdherence', 'Adesão à dieta', 0, 100, { fallback: 0, integer: true })!;

        const measures: CheckinInput['measures'] = {};
        for (const field of MEASURES) measures[field] = number(field, 'Medida', 10, 300);
        const bodyFatPercentage = number('bodyFatPercentage', '% de gordura', 1, 75);

        const notes = missing(data.notes) ? null : String(data.notes).trim();
        if (notes && notes.length > MAX_NOTES) throw new CheckinError(`Observações: use no máximo ${MAX_NOTES} caracteres`);

        const photos = Array.isArray(data.photos) ? data.photos.filter((photo) => photo && typeof photo === 'object' && (photo as { url?: unknown }).url) : [];
        if (photos.length > MAX_PHOTOS) throw new CheckinError(`Envie no máximo ${MAX_PHOTOS} fotos`);

        return {
            ok: true,
            value: {
                weight,
                sleepHours,
                energyLevel,
                hungerLevel,
                stressLevel,
                workoutAdherence,
                dietAdherence,
                notes,
                measures,
                bodyFatPercentage,
                photos: photos.map((photo) => {
                    const { url, angle } = photo as { url: unknown; angle?: unknown };
                    const upper = String(angle ?? 'FRONT').toUpperCase();
                    return {
                        url: String(url).trim(),
                        angle: (PHOTO_ANGLES as readonly string[]).includes(upper) ? (upper as CheckinInput['photos'][number]['angle']) : 'FRONT',
                    };
                }),
            },
        };
    } catch (error) {
        if (error instanceof CheckinError) return { ok: false, error: error.message };
        throw error;
    }
}

class CheckinError extends Error {}

/** A repeat of this check-in (a retry, a double tap) within this window returns the one already saved (audit A12). */
export const CHECKIN_REPEAT_WINDOW_MS = 10 * 60 * 1000;

/** The fields that make two check-ins the same submission. */
export function checkinFingerprint(input: Pick<CheckinInput, 'weight' | 'sleepHours' | 'energyLevel' | 'hungerLevel' | 'stressLevel' | 'workoutAdherence' | 'dietAdherence' | 'notes'>) {
    return JSON.stringify([
        input.weight,
        input.sleepHours,
        input.energyLevel,
        input.hungerLevel,
        input.stressLevel,
        input.workoutAdherence,
        input.dietAdherence,
        input.notes ?? null,
    ]);
}
