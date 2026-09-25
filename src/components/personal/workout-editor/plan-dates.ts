/**
 * Plan start/end dates are calendar days. They reach the client as ISO timestamps stored in
 * three ways: 00:00 UTC (older web saves), 12:00 UTC (date-only saves) or a real local time
 * (iOS app). Reading the UTC day for the first two and the local day for the last avoids the
 * "one day earlier" bug in Brazil.
 */

const pad = (value: number) => String(value).padStart(2, '0');

export function toLocalYmd(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** ISO timestamp from the API → "YYYY-MM-DD" for <input type="date">. */
export function planDateToInput(value: string | null | undefined): string {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const isDateOnly =
        date.getUTCMinutes() === 0 &&
        date.getUTCSeconds() === 0 &&
        date.getUTCMilliseconds() === 0 &&
        (date.getUTCHours() === 0 || date.getUTCHours() === 12);
    return isDateOnly ? date.toISOString().slice(0, 10) : toLocalYmd(date);
}

/** "YYYY-MM-DD" → local Date at midnight (for display and day math). */
export function ymdToLocalDate(ymd: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function todayYmd(): string {
    return toLocalYmd(new Date());
}

export function addDaysYmd(ymd: string, days: number): string {
    const date = ymdToLocalDate(ymd) ?? new Date();
    date.setDate(date.getDate() + days);
    return toLocalYmd(date);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function diffDaysYmd(from: string, to: string): number | null {
    const start = ymdToLocalDate(from);
    const end = ymdToLocalDate(to);
    if (!start || !end) return null;
    return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/** Formats an API plan date for display, e.g. "25/09/2026" or with custom options. */
export function formatPlanDate(
    value: string | null | undefined,
    options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
): string {
    const date = ymdToLocalDate(planDateToInput(value));
    return date ? date.toLocaleDateString('pt-BR', options) : '';
}

/** Days until the plan ends (negative when it already ended). */
export function daysUntilPlanEnd(endDate: string | null | undefined): number | null {
    const end = planDateToInput(endDate);
    return end ? diffDaysYmd(todayYmd(), end) : null;
}

export const DEFAULT_PLAN_LENGTH_DAYS = 60;
