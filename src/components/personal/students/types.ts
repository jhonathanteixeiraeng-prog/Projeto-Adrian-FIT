/** Shapes returned by /api/students and /api/students/[id] (dates arrive as ISO strings). */

export interface StudentUser {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
}

export interface StudentContractFields {
    planType?: string | null;
    planValue?: number | null;
    planExpiresAt?: string | null;
    paymentStatus?: string | null;
}

export interface Checkin {
    id: string;
    date: string;
    weight: number | null;
    sleepHours?: number | null;
    energyLevel?: number | null;
    hungerLevel?: number | null;
    stressLevel?: number | null;
    workoutAdherence: number;
    dietAdherence: number;
    notes?: string | null;
    chest?: number | null;
    waist?: number | null;
    abdomen?: number | null;
    hips?: number | null;
    armRight?: number | null;
    armLeft?: number | null;
    thighRight?: number | null;
    thighLeft?: number | null;
    calfRight?: number | null;
    calfLeft?: number | null;
    bodyFatPercentage?: number | null;
}

export interface ProgressPhoto {
    id: string;
    url: string;
    angle: string;
    weight?: number | null;
    notes?: string | null;
    createdAt: string;
    checkinId?: string | null;
}

/** Row of GET /api/students. */
export interface StudentListItem extends StudentContractFields {
    id: string;
    userId?: string;
    personalId?: string;
    status: string;
    goal?: string | null;
    weight?: number | null;
    height?: number | null;
    birthDate?: string | null;
    gender?: string | null;
    createdAt?: string;
    user?: StudentUser;
    workoutPlans?: Array<{
        id: string;
        title: string;
        startDate?: string | null;
        endDate?: string | null;
        active?: boolean;
        createdAt?: string;
        workoutDays?: Array<{ id: string; name: string }>;
    }>;
    dietPlans?: Array<{
        id: string;
        title: string;
        startDate?: string | null;
        endDate?: string | null;
        calories?: number | null;
        active?: boolean;
    }>;
    checkins?: Checkin[];
    workoutSessions?: Array<{ completedAt: string; dayName: string }>;
}

export interface Anamnesis {
    id?: string;
    restrictions?: string | null;
    injuries?: string | null;
    medications?: string | null;
    activityLevel?: string | null;
    notes?: string | null;
    updatedAt?: string;
}

export interface WorkoutItem {
    id: string;
    sets: number;
    reps: string;
    rest: number;
    restBySet?: string | null;
    /** Prescribed load in kg: "20" or per set "20/22.5/25". */
    load?: string | null;
    /** Prescribed RPE (1-10): "8" or "7-8". */
    rpe?: string | null;
    notes?: string | null;
    order: number;
    exercise?: {
        id: string;
        name: string;
        muscleGroup?: string | null;
        equipment?: string | null;
        videoUrl?: string | null;
    } | null;
}

export interface WorkoutDay {
    id: string;
    dayOfWeek: number;
    name: string;
    order?: number;
    items: WorkoutItem[];
}

export interface WorkoutPlanFull {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    active: boolean;
    createdAt?: string;
    workoutDays: WorkoutDay[];
}

export interface DietMeal {
    id: string;
    name: string;
    time: string;
    foods: string;
    notes?: string | null;
    order: number;
}

export interface DietPlanFull {
    id: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    active: boolean;
    createdAt?: string;
    meals: DietMeal[];
}

export interface WorkoutPlanSummary {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    active: boolean;
    createdAt: string;
    _count?: { workoutDays: number };
}

export interface DietPlanSummary {
    id: string;
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    active: boolean;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    createdAt: string;
}

export interface WorkoutSessionSummary {
    id: string;
    dayName: string;
    status: string;
    completedAt: string;
    percentage: number;
    durationSeconds: number;
    completedSets: number;
    totalSets: number;
}

/** GET /api/students/[id]?view=profile */
export interface StudentProfile extends StudentContractFields {
    id: string;
    status: string;
    goal: string | null;
    birthDate: string | null;
    gender: string | null;
    height: number | null;
    weight: number | null;
    createdAt: string;
    user: StudentUser;
    anamnesis: Anamnesis | null;
    workoutPlans: WorkoutPlanSummary[];
    dietPlans: DietPlanSummary[];
    activeWorkoutPlan: WorkoutPlanFull | null;
    activeDietPlan: DietPlanFull | null;
    checkins: Checkin[];
    firstCheckin: Checkin | null;
    progressPhotos: ProgressPhoto[];
    workoutSessions: WorkoutSessionSummary[];
    _count?: { checkins: number; progressPhotos: number; workoutSessions: number };
}

/** GET /api/students/[id]?view=report */
export interface StudentReport {
    id: string;
    status: string;
    goal: string | null;
    height: number | null;
    weight: number | null;
    gender: string | null;
    birthDate: string | null;
    createdAt: string;
    user: StudentUser;
    personal?: {
        id: string;
        brandName?: string | null;
        user: { name: string; email: string; phone: string | null };
    } | null;
    checkins: Checkin[];
    progressPhotos: ProgressPhoto[];
    firstCheckin: Checkin | null;
}

export interface AnamnesisInput {
    activityLevel?: string;
    injuries?: string | null;
    restrictions?: string | null;
    medications?: string | null;
    notes?: string | null;
}

/** Body accepted by PUT /api/students/[id]: absent keeps, null clears. */
export interface StudentPatch {
    name?: string;
    phone?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    height?: number | null;
    weight?: number | null;
    goal?: string | null;
    status?: string;
    planType?: string | null;
    planValue?: number | null;
    planExpiresAt?: string | null;
    paymentStatus?: string | null;
    anamnesis?: AnamnesisInput;
}

/** Scalars returned by PUT /api/students/[id] and POST /api/students/bulk. */
export interface StudentUpdateResult extends StudentContractFields {
    id: string;
    status?: string;
    goal?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    height?: number | null;
    weight?: number | null;
    user?: StudentUser;
    anamnesis?: Anamnesis | null;
}
