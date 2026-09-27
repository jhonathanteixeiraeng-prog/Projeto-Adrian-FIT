/**
 * Workout statistics from the student's sessions, by calendar day (YYYY-MM-DD, see student-day), shared by
 * the workout history and the student dashboard so both show the same numbers (audit A21). Weeks start on
 * Monday.
 */

export function parseLocalDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function weekStart(date: Date) {
    const result = new Date(date);
    const weekday = result.getUTCDay();
    result.setUTCDate(result.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
    return result;
}

export function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

/** Sessions (one per date and workout day) in the week of `todayKey`. */
export function workoutsThisWeek(localDates: string[], todayKey: string) {
    const current = weekStart(parseLocalDate(todayKey) ?? new Date());
    const next = addDays(current, 7);
    return localDates.filter((localDate) => {
        const date = parseLocalDate(localDate);
        return date !== null && date >= current && date < next;
    }).length;
}

/** Consecutive weeks with at least `weeklyGoal` training days. The current week counts once it reaches the goal. */
export function weeklyStreak(localDates: string[], weeklyGoal: number, todayKey: string) {
    const today = parseLocalDate(todayKey) ?? new Date();
    const counts = new Map<string, Set<string>>();
    for (const localDate of localDates) {
        const date = parseLocalDate(localDate);
        if (!date) continue;
        const key = dateKey(weekStart(date));
        if (!counts.has(key)) counts.set(key, new Set());
        counts.get(key)!.add(localDate);
    }

    const goal = Math.max(weeklyGoal, 1);
    let cursor = weekStart(today);
    if ((counts.get(dateKey(cursor))?.size ?? 0) < goal) cursor = addDays(cursor, -7);
    let streak = 0;
    while ((counts.get(dateKey(cursor))?.size ?? 0) >= goal) {
        streak += 1;
        cursor = addDays(cursor, -7);
    }
    return streak;
}

/** Consecutive days with a workout, ending today, or yesterday while today has none yet (as the iOS app counts). */
export function dayStreak(localDates: string[], todayKey: string) {
    const days = new Set(localDates);
    let cursor = parseLocalDate(todayKey) ?? new Date();
    if (!days.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    let streak = 0;
    while (days.has(dateKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** When the next weekly check-in is due: "Hoje" (never sent, or due), "Amanhã", or the weekday. */
export function nextCheckinLabel(lastCheckinLocalDate: string | null, todayKey: string) {
    const today = parseLocalDate(todayKey);
    const last = lastCheckinLocalDate ? parseLocalDate(lastCheckinLocalDate) : null;
    if (!today || !last) return 'Hoje';
    const due = addDays(last, 7);
    if (due <= today) return 'Hoje';
    if (dateKey(due) === dateKey(addDays(today, 1))) return 'Amanhã';
    return WEEKDAYS[due.getUTCDay()];
}
