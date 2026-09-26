/**
 * Physical assessments the trainer records (Assessment model): weight, body fat, circumferences,
 * notes and photos. Pure helpers shared by the API (validation) and the screens (labels, ranges).
 */
import { isOwnPhotoUrl } from './photo-url';

export const ASSESSMENT_MEASURES = [
    { key: 'weight', label: 'Peso', unit: 'kg', min: 20, max: 400 },
    { key: 'bodyFatPercentage', label: '% de gordura', unit: '%', min: 2, max: 75 },
    { key: 'chest', label: 'Tórax / peitoral', unit: 'cm', min: 30, max: 250 },
    { key: 'waist', label: 'Cintura', unit: 'cm', min: 30, max: 250 },
    { key: 'abdomen', label: 'Abdômen', unit: 'cm', min: 30, max: 250 },
    { key: 'hips', label: 'Quadril', unit: 'cm', min: 30, max: 250 },
    { key: 'armRight', label: 'Braço direito', unit: 'cm', min: 10, max: 90 },
    { key: 'armLeft', label: 'Braço esquerdo', unit: 'cm', min: 10, max: 90 },
    { key: 'thighRight', label: 'Coxa direita', unit: 'cm', min: 20, max: 150 },
    { key: 'thighLeft', label: 'Coxa esquerda', unit: 'cm', min: 20, max: 150 },
    { key: 'calfRight', label: 'Panturrilha direita', unit: 'cm', min: 15, max: 80 },
    { key: 'calfLeft', label: 'Panturrilha esquerda', unit: 'cm', min: 15, max: 80 },
] as const;

export type AssessmentMeasureKey = (typeof ASSESSMENT_MEASURES)[number]['key'];
export type AssessmentMeasures = Record<AssessmentMeasureKey, number | null>;

export const PHOTO_ANGLES = ['FRONT', 'SIDE', 'BACK', 'OTHER'] as const;
export type PhotoAngle = (typeof PHOTO_ANGLES)[number];

export interface AssessmentPhotoInput {
    url: string;
    angle: PhotoAngle;
}

export interface AssessmentPayload {
    /** Calendar day ("2026-09-26"); stored at 12:00 UTC like the other date-only fields. */
    date?: Date;
    measures: Partial<AssessmentMeasures>;
    notes?: string | null;
    addPhotos: AssessmentPhotoInput[];
    removePhotoIds: string[];
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_NOTES = 2000;
const MAX_PHOTOS = 8;

type Parsed = { ok: true; data: AssessmentPayload } | { ok: false; error: string };

function parseDate(value: unknown, now: Date): Date | 'invalid' | null {
    if (value === undefined) return null;
    const match = typeof value === 'string' ? value.trim().match(DATE_ONLY) : null;
    if (!match) return 'invalid';
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
    if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(match[3])) return 'invalid';
    // One day of slack for time zones west of UTC; anything later is a typo.
    if (date.getTime() > now.getTime() + 36 * 60 * 60 * 1000) return 'invalid';
    return date;
}

function parseNumber(value: unknown): number | null | 'invalid' {
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? Math.round(number * 10) / 10 : 'invalid';
}

/**
 * Validates a create (`partial: false`) or update body. Unknown keys are ignored; on update, a
 * missing key keeps the stored value and null clears it.
 */
/** `uploaderId`: new photos must be files this user sent to POST /api/upload (see src/lib/photo-url.ts). */
export function parseAssessmentBody(body: unknown, options: { partial: boolean; uploaderId: string; now?: Date }): Parsed {
    if (!body || typeof body !== 'object') return { ok: false, error: 'Dados da avaliação inválidos' };
    const input = body as Record<string, unknown>;
    const now = options.now ?? new Date();

    const date = parseDate(input.date, now);
    if (date === 'invalid') return { ok: false, error: 'Data da avaliação inválida (não pode ser futura)' };
    if (!date && !options.partial) return { ok: false, error: 'Informe a data da avaliação' };

    const measures: Partial<AssessmentMeasures> = {};
    for (const measure of ASSESSMENT_MEASURES) {
        if (!(measure.key in input)) continue;
        const value = parseNumber(input[measure.key]);
        if (value === 'invalid' || (value !== null && (value < measure.min || value > measure.max))) {
            return { ok: false, error: `${measure.label}: use um valor entre ${measure.min} e ${measure.max} ${measure.unit}` };
        }
        measures[measure.key] = value;
    }

    let notes: string | null | undefined;
    if ('notes' in input) {
        if (input.notes !== null && typeof input.notes !== 'string') return { ok: false, error: 'Observações inválidas' };
        notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, MAX_NOTES) || null : null;
    }

    const rawPhotos = input.photos ?? input.addPhotos ?? [];
    if (!Array.isArray(rawPhotos) || rawPhotos.length > MAX_PHOTOS) return { ok: false, error: 'Fotos inválidas' };
    const addPhotos: AssessmentPhotoInput[] = [];
    for (const raw of rawPhotos) {
        const url = typeof raw?.url === 'string' ? raw.url.trim() : '';
        const angle = String(raw?.angle ?? '').toUpperCase() as PhotoAngle;
        if (!isOwnPhotoUrl(url, options.uploaderId) || !PHOTO_ANGLES.includes(angle)) {
            return { ok: false, error: 'Foto inválida: envie a imagem de novo' };
        }
        addPhotos.push({ url, angle });
    }

    const rawRemove = input.removePhotoIds ?? [];
    if (!Array.isArray(rawRemove) || rawRemove.some((id) => typeof id !== 'string')) return { ok: false, error: 'Fotos inválidas' };

    if (!options.partial) {
        const hasContent = Object.values(measures).some((value) => value !== null) || addPhotos.length > 0 || Boolean(notes);
        if (!hasContent) return { ok: false, error: 'Registre pelo menos uma medida, uma foto ou uma observação' };
    }

    return { ok: true, data: { date: date ?? undefined, measures, notes, addPhotos, removePhotoIds: rawRemove as string[] } };
}
