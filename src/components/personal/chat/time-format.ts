/**
 * Date/time labels for the chat, the dashboard and the notifications page.
 * Always formatted in the browser, so times follow the viewer's timezone.
 */

const pad = (value: number) => String(value).padStart(2, '0');

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Local calendar day, e.g. "2026-09-25". */
export function dayKey(value: Date | string | number): string {
    const date = toDate(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole calendar days between the date and today (0 = today, 1 = yesterday). */
export function calendarDaysAgo(value: Date | string | number, now: Date = new Date()): number {
    return Math.round((startOfDay(now) - startOfDay(toDate(value))) / (24 * 60 * 60 * 1000));
}

/** "14:05". */
export function formatClock(value: Date | string | number): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "25/09" or "25/09/2025" when it's another year. */
export function formatShortDate(value: Date | string | number, now: Date = new Date()): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return '';
    const base = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
    return date.getFullYear() === now.getFullYear() ? base : `${base}/${date.getFullYear()}`;
}

/** "25/09/2026 às 14:05" (tooltips). */
export function formatFullDateTime(value: Date | string | number): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${formatClock(date)}`;
}

/** Compact relative time for lists: "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "12/08". */
export function formatRelativeShort(value: Date | string | number, now: Date = new Date()): string {
    const date = toDate(value);
    if (Number.isNaN(date.getTime())) return '';
    const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const days = calendarDaysAgo(date, now);
    if (days <= 0) return `há ${Math.floor(minutes / 60)} h`;
    if (days === 1) return 'ontem';
    if (days < 7) return `há ${days} dias`;
    return formatShortDate(date, now);
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Chat day separator: "Hoje", "Ontem", "segunda, 22/09", "12/08/2025". */
export function formatDayLabel(value: Date | string | number, now: Date = new Date()): string {
    const date = toDate(value);
    const days = calendarDaysAgo(date, now);
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days > 1 && days < 7) return `${WEEKDAYS[date.getDay()]}, ${formatShortDate(date, now)}`;
    return formatShortDate(date, now);
}

/** "quinta-feira, 25 de setembro". */
export function formatLongToday(now: Date = new Date()): string {
    return now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}
