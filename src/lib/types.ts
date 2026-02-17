// Type definitions for Enerflux Fit Coach

// User and Auth Types
export type Role = 'PERSONAL' | 'STUDENT';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'PAUSED';
export type ActivityLevel = 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE';
export type PhotoAngle = 'FRONT' | 'SIDE' | 'BACK';
export type NotificationType = 'WORKOUT_REMINDER' | 'MEAL_REMINDER' | 'CHECKIN_REMINDER' | 'PLAN_UPDATED' | 'LOW_ADHERENCE' | 'NEW_MESSAGE';

export interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    phone?: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Personal {
    id: string;
    userId: string;
    user?: User;
    brandName?: string;
    bio?: string;
    createdAt: Date;
}

export interface Student {
    id: string;
    userId: string;
    user?: User;
    personalId: string;
    personal?: Personal;
    birthDate?: Date;
    gender?: Gender;
    height?: number;
    weight?: number;
    goal?: string;
    status: StudentStatus;
    createdAt: Date;
}

export interface Anamnesis {
    id: string;
    studentId: string;
    restrictions?: string;
    injuries?: string;
    medications?: string;
    activityLevel: ActivityLevel;
    notes?: string;
}

// Workout Types
export interface WorkoutPlan {
    id: string;
    studentId: string;
    personalId: string;
    title: string;
    startDate: Date;
    endDate: Date;
    version: number;
    active: boolean;
    workoutDays?: WorkoutDay[];
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkoutDay {
    id: string;
    planId: string;
    dayOfWeek: number;
    name: string;
    order: number;
    items?: WorkoutItem[];
    completions?: WorkoutCompletion[];
}

export interface Exercise {
    id: string;
    personalId: string;
    name: string;
    muscleGroup: string;
    videoUrl?: string;
    instructions?: string;
    createdAt: Date;
}

export interface WorkoutItem {
    id: string;
    workoutDayId: string;
    exerciseId: string;
    exercise?: Exercise;
    sets: number;
    reps: string;
    rest: number;
    notes?: string;
    order: number;
}

export interface WorkoutCompletion {
    id: string;
    workoutDayId: string;
    studentId: string;
    completedAt: Date;
}

// Diet Types
export interface DietPlan {
    id: string;
    studentId: string;
    personalId: string;
    title: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    version: number;
    active: boolean;
    meals?: DietMeal[];
    createdAt: Date;
    updatedAt: Date;
}

export interface DietMeal {
    id: string;
    dietPlanId: string;
    name: string;
    time: string;
    foods: FoodItem[];
    notes?: string;
    order: number;
    completions?: MealCompletion[];
}

export interface FoodItem {
    name: string;
    quantity: string;
    notes?: string;
}

export interface MealCompletion {
    id: string;
    mealId: string;
    studentId: string;
    completedAt: Date;
}

// Check-in Types
export interface Checkin {
    id: string;
    studentId: string;
    date: Date;
    weight: number;
    sleepHours: number;
    energyLevel: number;
    hungerLevel: number;
    stressLevel: number;
    workoutAdherence: number;
    dietAdherence: number;
    notes?: string;
}

export interface ProgressPhoto {
    id: string;
    studentId: string;
    url: string;
    angle: PhotoAngle;
    createdAt: Date;
}

// Messaging Types
export interface Message {
    id: string;
    fromUserId: string;
    fromUser?: User;
    toUserId: string;
    toUser?: User;
    text: string;
    read: boolean;
    createdAt: Date;
}

// Notification Types
export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    read: boolean;
    createdAt: Date;
}

// Dashboard Types
export interface DashboardStats {
    totalStudents: number;
    activeStudents: number;
    studentsWithoutWorkout72h: number;
    averageWorkoutAdherence: number;
    averageDietAdherence: number;
    pendingCheckins: number;
    lowAdherenceStudents: StudentWithAdherence[];
}

export interface StudentWithAdherence extends Student {
    lastWorkout?: Date;
    lastCheckin?: Date;
    workoutAdherence: number;
    dietAdherence: number;
}

// Form Types
export interface LoginFormData {
    email: string;
    password: string;
}

export interface RegisterFormData {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: Role;
    phone?: string;
}

export interface CheckinFormData {
    weight: number;
    sleepHours: number;
    energyLevel: number;
    hungerLevel: number;
    stressLevel: number;
    workoutAdherence: number;
    dietAdherence: number;
    notes?: string;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
