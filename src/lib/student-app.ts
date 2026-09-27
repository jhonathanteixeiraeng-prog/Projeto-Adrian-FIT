import { STUDENTS_USE_APP } from '@/lib/features';

/**
 * Phase 2 pilot: whether a student uses the student area / app. Everyone while STUDENTS_USE_APP is on;
 * otherwise only the students the trainer marked ("Usa a área do aluno", Student.usesApp). For them the
 * trainer sees app activity (workouts, check-ins, adherence, chat) and they are told about new plans; the
 * others keep receiving their plans as PDF over WhatsApp.
 */
export function usesStudentApp(student: { usesApp?: boolean | null } | null | undefined): boolean {
    return STUDENTS_USE_APP || Boolean(student?.usesApp);
}

/**
 * When the student's app activity starts counting for the activity alerts (never trained, days without
 * training, check-ins due): registration, or joining the student area when that came later
 * (Student.usesAppSince). A student who just joined isn't "inactive" for the time before.
 */
export function appClockStart(student: { createdAt: Date | string; usesAppSince?: Date | string | null }): Date {
    const created = new Date(student.createdAt);
    const joined = student.usesAppSince ? new Date(student.usesAppSince) : null;
    return joined && joined > created ? joined : created;
}

/** `date` when it came after the clock started (see appClockStart), else null: older activity doesn't count. */
export function sinceAppStart<T extends Date | string>(date: T | null | undefined, start: Date): T | null {
    return date && new Date(date) >= start ? date : null;
}

/**
 * Days without training as the activity alerts count them: since the last workout after the clock started
 * (appClockStart), or since the clock started when there was none (`trained` false).
 */
export function appIdleDays(
    student: { createdAt: Date | string; usesAppSince?: Date | string | null },
    lastWorkoutAt: Date | string | null | undefined,
    now: Date = new Date()
): { days: number; trained: boolean } {
    const start = appClockStart(student);
    const workout = sinceAppStart(lastWorkoutAt, start);
    return { days: Math.floor((now.getTime() - new Date(workout ?? start).getTime()) / 86_400_000), trained: workout !== null };
}
