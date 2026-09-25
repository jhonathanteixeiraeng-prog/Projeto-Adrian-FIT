import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

export function formatTime(time: string): string {
    return time.substring(0, 5);
}

export function formatDateTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function getDayOfWeekName(day: number): string {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[day] || '';
}

export function getShortDayOfWeekName(day: number): string {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[day] || '';
}

export function calculateAge(birthDate: Date | string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

export function calculateAdherenceColor(adherence: number): string {
    if (adherence >= 80) return 'text-green-500';
    if (adherence >= 60) return 'text-yellow-500';
    return 'text-red-500';
}

export function calculateAdherenceBadge(adherence: number): 'success' | 'warning' | 'danger' {
    if (adherence >= 80) return 'success';
    if (adherence >= 60) return 'warning';
    return 'danger';
}

export function hoursAgo(date: Date | string): number {
    const now = new Date();
    const then = new Date(date);
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
}

export function daysAgo(date: Date | string): number {
    return Math.floor(hoursAgo(date) / 24);
}

/** Lowercase, trim and strip accents so "Tríceps" and "triceps" compare equal. */
export function normalizeText(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Accent- and case-insensitive search: every word typed in `query`
 * must appear in at least one of the given fields.
 */
export function matchesSearch(query: string, ...fields: Array<string | null | undefined>): boolean {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const haystack = fields.map(normalizeText).join(' ');
    return terms.every((term) => haystack.includes(term));
}

/**
 * Parses a number typed the Brazilian way: "1.200" → 1200, "1.234,56" → 1234.56, "149,90" → 149.9,
 * "72.5" → 72.5, "0.250" → 0.25. Returns null for empty input and NaN for anything that isn't a number
 * (e.g. "R$ 150"), so forms can show an error instead of silently dropping the value.
 */
export function parseDecimalInput(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const text = String(value).trim().replace(/\s/g, '');
    if (!text) return null;
    let normalized: string;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(text)) {
        normalized = text.replace(/\./g, '').replace(',', '.');
    } else if (text.includes(',')) {
        normalized = text.replace(/\./g, '').replace(',', '.');
    } else {
        normalized = text;
    }
    return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
