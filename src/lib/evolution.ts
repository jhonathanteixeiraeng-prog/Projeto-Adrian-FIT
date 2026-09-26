import { ASSESSMENT_MEASURES, type AssessmentMeasureKey } from './assessments';

/**
 * Body measurements over time from both sources: assessments the trainer records and check-ins
 * students send from the app. Weight and circumferences read from this merged timeline; adherence,
 * sleep and wellbeing stay check-in only.
 */

export type EvolutionSource = 'ASSESSMENT' | 'CHECKIN';

export type EvolutionRecord = {
    id: string;
    date: string;
    source: EvolutionSource;
    notes: string | null;
} & Record<AssessmentMeasureKey, number | null>;

type Measured = { id: string; date: string; notes?: string | null } & Partial<Record<AssessmentMeasureKey, number | null>>;

const KEYS = ASSESSMENT_MEASURES.map((measure) => measure.key);

function toRecord(item: Measured, source: EvolutionSource): EvolutionRecord {
    const values = Object.fromEntries(KEYS.map((key) => [key, item[key] ?? null])) as Record<AssessmentMeasureKey, number | null>;
    return { id: item.id, date: item.date, source, notes: item.notes ?? null, ...values };
}

const time = (value: string) => new Date(value).getTime();

/** Newest first; on the same day the trainer's assessment comes before the student's check-in. */
export function evolutionRecords(checkins: Measured[], assessments: Measured[]): EvolutionRecord[] {
    return [...assessments.map((item) => toRecord(item, 'ASSESSMENT')), ...checkins.map((item) => toRecord(item, 'CHECKIN'))].sort(
        (a, b) => time(b.date) - time(a.date) || (a.source === b.source ? 0 : a.source === 'ASSESSMENT' ? -1 : 1)
    );
}

/** Latest and earliest records that have a weight (the earliest may come from an older check-in). */
export function weightRange(records: EvolutionRecord[], firstCheckin?: Measured | null) {
    const withWeight = records.filter((record) => record.weight != null);
    const candidates = firstCheckin?.weight != null ? [...withWeight, toRecord(firstCheckin, 'CHECKIN')] : withWeight;
    const earliest = candidates.reduce<EvolutionRecord | null>(
        (oldest, record) => (!oldest || time(record.date) < time(oldest.date) ? record : oldest),
        null
    );
    return { latest: withWeight[0] ?? null, earliest };
}
