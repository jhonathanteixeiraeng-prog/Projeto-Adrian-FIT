import type { BillingStatus } from '@/lib/student-status';
import type { AttentionReason, AttentionSeverity } from './attention-rules';

/** One student in the "Precisa da sua atenção hoje" queue (GET /api/dashboard → attentionQueue). */
export interface AttentionItem {
    studentId: string;
    userId: string;
    name: string;
    email: string;
    phone: string | null;
    avatar: string | null;
    status: string;
    severity: AttentionSeverity;
    score: number;
    reasons: AttentionReason[];
    /** Last message of the conversation when it came from the student. */
    unansweredMessage: { text: string; createdAt: string } | null;
    /** Null for paused/inactive students (they only appear with a message). */
    billing: {
        status: BillingStatus;
        label: string;
        daysToExpire: number | null;
        planType: string | null;
        planValue: number | null;
        planExpiresAt: string | null;
        paymentStatus: string | null;
    } | null;
    workoutPlan: { id: string; title: string; endDate: string | null } | null;
    dietPlan: { id: string; title: string; endDate: string | null } | null;
    lastWorkoutAt: string | null;
    lastCheckinAt: string | null;
}

export interface DashboardKpis {
    totalStudents: number;
    activeStudents: number;
    workoutsLast7Days: number;
    /** Days trained vs. prescribed in the last 7 days; null when no active plan has workout days. */
    workoutAdherence7d: number | null;
    workoutAdherenceStudents: number;
    /** Average of the latest self-reported check-ins (fallback when the real rate can't be computed). */
    reportedWorkoutAdherence: number | null;
    mrr: number;
    pendingCharges: number;
    expiringSoon: number;
    unansweredMessages: number;
    pendingCheckins: number;
}

export interface DashboardData {
    totalStudents: number;
    activeStudents: number;
    attentionQueue?: AttentionItem[];
    kpis?: DashboardKpis;
    generatedAt?: string;
}

export type ActivityType = 'WORKOUT_COMPLETED' | 'CHECKIN_SUBMITTED' | 'FOOD_SUBSTITUTED' | 'MESSAGE_RECEIVED';

export interface ActivityEvent {
    id: string;
    type: ActivityType;
    title: string;
    action?: string;
    description: string;
    timestamp: string;
    studentId: string;
    studentName: string;
    studentAvatar?: string | null;
}
