/**
 * Notification types and the in-app routes they open.
 * `Notification.link` is optional: older rows and iOS clients simply ignore it.
 */

export type NotificationType =
    | 'WORKOUT_REMINDER'
    | 'MEAL_REMINDER'
    | 'CHECKIN_REMINDER'
    | 'WATER_REMINDER'
    | 'PLAN_UPDATED'
    | 'LOW_ADHERENCE'
    | 'NEW_MESSAGE';

export type StudentProfileTab = 'overview' | 'workout' | 'diet' | 'progress';

export const personalLinks = {
    student: (studentId: string, tab: StudentProfileTab = 'overview') =>
        tab === 'overview' ? `/personal/students/${studentId}` : `/personal/students/${studentId}?tab=${tab}`,
    chat: (studentId: string) => `/personal/chat/${studentId}`,
};

const STUDENT_LINK_BY_TYPE: Record<string, string> = {
    WORKOUT_REMINDER: '/student/workout',
    PLAN_UPDATED: '/student/workout',
    MEAL_REMINDER: '/student/diet',
    CHECKIN_REMINDER: '/student/checkin',
    WATER_REMINDER: '/student/home',
    NEW_MESSAGE: '/student/chat',
};

/** Default route in the student web area for a notification type. */
export function studentLinkFor(type: string): string | null {
    return STUDENT_LINK_BY_TYPE[type] ?? null;
}

export const NOTIFY_STUDENT_STORAGE_KEY = 'personal:notify-student';

export function getStoredNotifyStudent(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        const raw = window.localStorage.getItem(NOTIFY_STUDENT_STORAGE_KEY);
        if (raw === null) return true;
        return JSON.parse(raw) === true;
    } catch {
        return true;
    }
}

export function setStoredNotifyStudent(value: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(NOTIFY_STUDENT_STORAGE_KEY, JSON.stringify(value));
    } catch {
        // ignore
    }
}
