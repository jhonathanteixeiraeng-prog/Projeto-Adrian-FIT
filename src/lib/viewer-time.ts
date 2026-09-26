/**
 * Clock and calendar of the person using the app. The API runs on a UTC server (Vercel), so "today" and
 * "afternoon" come from the client: web pages send `Date#getTimezoneOffset()` as `?tz=`. Requests without it
 * (app versions that don't send it) use Brasília time.
 */

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

/** `?tz=` in minutes with the sign of `Date#getTimezoneOffset()` (UTC-3 → 180); null when missing or invalid. */
export function parseTzOffset(value: string | null | undefined): number | null {
    const minutes = Number.parseInt(value || '', 10);
    return Number.isFinite(minutes) && Math.abs(minutes) <= 14 * 60 ? minutes : null;
}

/** Offset of an IANA time zone at `date`, with the sign of `Date#getTimezoneOffset()`. */
export function timeZoneOffset(date: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
    const wallClockAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    return Math.round((date.getTime() - wallClockAsUtc) / 60_000);
}

export interface ViewerClock {
    /** Hour of the day for the viewer (0–23). */
    hour: number;
    /** Viewer's calendar day, "2026-09-25". */
    day: string;
    /** Instant the viewer's day started. */
    startOfDay: Date;
}

/** Hour and day for the viewer at `now` (`tzOffset` from `?tz=`; Brasília time when null). */
export function viewerClock(now: Date, tzOffset: number | null): ViewerClock {
    const offset = tzOffset ?? timeZoneOffset(now);
    // The viewer's wall clock, read with the getUTC* methods.
    const wall = new Date(now.getTime() - offset * 60_000);
    const midnight = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
    return {
        hour: wall.getUTCHours(),
        day: wall.toISOString().slice(0, 10),
        startOfDay: new Date(midnight + offset * 60_000),
    };
}
