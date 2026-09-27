/**
 * The student's calendar day (audit A07). Clients send their date as YYYY-MM-DD (`localDate`) and their
 * offset from UTC in minutes, east positive (Manaus: -240) — the convention of the iOS app and of
 * POST /api/student/workout/complete. Without an offset (older clients) the day is the server's, as before
 * (UTC on Vercel).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OFFSET_MINUTES = 14 * 60;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface StudentDay {
    /** YYYY-MM-DD in the student's calendar. */
    localDate: string;
    /** Instants where that day starts and ends. */
    start: Date;
    end: Date;
}

export function isLocalDate(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const match = LOCAL_DATE.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value;
}

/** Minutes east of UTC, or null when missing or out of range. */
export function parseOffsetMinutes(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const offset = Number(value);
    return Number.isFinite(offset) && Math.abs(offset) <= MAX_OFFSET_MINUTES ? Math.round(offset) : null;
}

export function localDayRange(localDate: string, offsetMinutes: number): { start: Date; end: Date } {
    const [year, month, day] = localDate.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day) - offsetMinutes * 60_000);
    return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** YYYY-MM-DD of `instant` for someone at `offsetMinutes`. */
export function localDateAt(instant: Date, offsetMinutes: number): string {
    return new Date(instant.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** The server's own day (local time of the process), for requests without an offset. */
function serverDay(now: Date): StudentDay {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const localDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return { localDate, start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * The day a request refers to: its `localDate` and offset when given, "today" at that offset when only the
 * offset is given, and the server's day otherwise (a `localDate` alone keeps the server's range).
 */
export function studentDay(input: { localDate?: unknown; timezoneOffsetMinutes?: unknown }, now = new Date()): StudentDay {
    const offset = parseOffsetMinutes(input.timezoneOffsetMinutes);
    if (offset === null) {
        const day = serverDay(now);
        return isLocalDate(input.localDate) ? { ...day, localDate: input.localDate } : day;
    }
    const localDate = isLocalDate(input.localDate) ? input.localDate : localDateAt(now, offset);
    return { localDate, ...localDayRange(localDate, offset) };
}

/** Same, from a query string: `localDate` and `tz` (or `timezoneOffsetMinutes`). */
export function studentDayFromQuery(params: URLSearchParams, now = new Date()): StudentDay {
    return studentDay(
        { localDate: params.get('localDate'), timezoneOffsetMinutes: params.get('tz') ?? params.get('timezoneOffsetMinutes') },
        now
    );
}

/** What the web pages send: the browser's date and offset (getTimezoneOffset counts west-positive). */
export function browserDay(now = new Date()): { localDate: string; timezoneOffsetMinutes: number } {
    const offset = -now.getTimezoneOffset();
    return { localDate: localDateAt(now, offset), timezoneOffsetMinutes: offset };
}

/** `localDate=YYYY-MM-DD&tz=-240`, for the web pages' GET requests. */
export function browserDayQuery(now = new Date()): string {
    const { localDate, timezoneOffsetMinutes } = browserDay(now);
    return `localDate=${localDate}&tz=${timezoneOffsetMinutes}`;
}
