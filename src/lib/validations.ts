import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const registerSchema = z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    confirmPassword: z.string(),
    role: z.enum(['PERSONAL', 'STUDENT']),
    phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
});

export const studentSchema = z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    phone: z.string().optional(),
    birthDate: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
    goal: z.string().optional(),
});

export const anamnesisSchema = z.object({
    restrictions: z.string().optional(),
    injuries: z.string().optional(),
    medications: z.string().optional(),
    activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']),
    notes: z.string().optional(),
});

export const workoutPlanSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    startDate: z.string(),
    endDate: z.string(),
    workoutDays: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        name: z.string().min(1, 'Nome do treino é obrigatório'),
        items: z.array(z.object({
            exerciseId: z.string(),
            sets: z.number().positive(),
            reps: z.string(),
            rest: z.number().positive(),
            notes: z.string().optional(),
        })),
    })),
});

export const dietPlanSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    calories: z.number().positive().optional(),
    protein: z.number().positive().optional(),
    carbs: z.number().positive().optional(),
    fat: z.number().positive().optional(),
    meals: z.array(z.object({
        name: z.string().min(1, 'Nome da refeição é obrigatório'),
        time: z.string(),
        foods: z.array(z.object({
            name: z.string(),
            quantity: z.string(),
            notes: z.string().optional(),
        })),
        notes: z.string().optional(),
    })),
});

export const exerciseSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    muscleGroup: z.string().min(1, 'Grupo muscular é obrigatório'),
    videoUrl: z.string().url().optional().or(z.literal('')),
    instructions: z.string().optional(),
});

export const checkinSchema = z.object({
    weight: z.number().positive('Peso deve ser positivo'),
    sleepHours: z.number().min(0).max(24, 'Horas de sono inválidas'),
    energyLevel: z.number().min(1).max(5),
    hungerLevel: z.number().min(1).max(5),
    stressLevel: z.number().min(1).max(5),
    workoutAdherence: z.number().min(0).max(100),
    dietAdherence: z.number().min(0).max(100),
    notes: z.string().optional(),
});

export const messageSchema = z.object({
    text: z.string().min(1, 'Mensagem não pode estar vazia'),
    toUserId: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type AnamnesisInput = z.infer<typeof anamnesisSchema>;
export type WorkoutPlanInput = z.infer<typeof workoutPlanSchema>;
export type DietPlanInput = z.infer<typeof dietPlanSchema>;
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
