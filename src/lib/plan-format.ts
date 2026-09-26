import { formatLoad, formatRpe } from './workout-load';
import { parsePerSetReps, parseRestBySetJson } from './workout-reps';

/**
 * Read-only texts of a prescribed exercise, shared by the student profile and the PDF export so the
 * trainer sees exactly what the student gets.
 */

interface RestFields {
    rest: number | null | undefined;
    restBySet?: string | null;
}

/** "45 s", "1 min 30 s", or the rest of each set ("60/90/120 s") when they differ; "—" when there is none. */
export function formatRest(item: RestFields): string {
    const perSet = parseRestBySetJson(item.restBySet);
    if (perSet && perSet.some((value) => value !== perSet[0])) return `${perSet.join('/')} s`;
    const seconds = item.rest ?? 0;
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/** Reps as prescribed: "10-12", or one value per set joined with "/" ("12/10/8"); "—" when empty. */
export function formatReps(reps: string | null | undefined): string {
    const perSet = parsePerSetReps(reps ?? '');
    if (perSet.length > 1) return perSet.join('/');
    return (reps ?? '').trim() || '—';
}

/** "3 × 10-12", or "3 × (12 / 10 / 8)" when each set has its own reps. */
export function formatVolume(item: { sets: number; reps: string | null | undefined }): string {
    const perSet = parsePerSetReps(item.reps ?? '');
    if (perSet.length > 1) return `${item.sets} × (${perSet.join(' / ')})`;
    return `${item.sets} × ${(item.reps ?? '').trim() || '—'}`;
}

/** Prescribed carga/RPE ("20 kg · RPE 8", "20/22,5/25 kg"); '' when the item has none. */
export function formatIntensity(item: { load?: string | null; rpe?: string | null }): string {
    return [formatLoad(item.load), formatRpe(item.rpe)].filter(Boolean).join(' · ');
}

/** A food's substitution as the student reads it: "Pode trocar por: …" (unless the note already says so). */
export function formatSubstitution(note: string | null | undefined): string | null {
    const text = (note ?? '').trim();
    if (!text) return null;
    return /^pode trocar por/i.test(text) ? text : `Pode trocar por: ${text}`;
}
