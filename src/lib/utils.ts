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
