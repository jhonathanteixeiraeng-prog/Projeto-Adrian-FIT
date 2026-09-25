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

const ACTIVITY_LEVELS = ['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE'] as const;
const longText = z.string().max(2000, 'Use no máximo 2000 caracteres');

// Number fields come from inputs registered with setValueAs (empty → undefined), so NaN means "not a number".
export const studentSchema = z.object({
    name: z.string().trim().min(2, 'Informe o nome completo do aluno'),
    email: z.string().trim().min(1, 'Informe o e-mail de acesso').email('E-mail inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    phone: z.string().trim().optional(),
    birthDate: z.string().optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    height: z
        .number({ invalid_type_error: 'Informe a altura em centímetros (ex.: 175)' })
        .min(50, 'Informe a altura em centímetros (ex.: 175)')
        .max(260, 'Informe a altura em centímetros (ex.: 175)')
        .optional(),
    weight: z
        .number({ invalid_type_error: 'Informe o peso em quilos (ex.: 72,5)' })
        .min(20, 'Informe o peso em quilos (ex.: 72,5)')
        .max(400, 'Informe o peso em quilos (ex.: 72,5)')
        .optional(),
    goal: longText.optional(),
    planType: z.enum(['MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO']).optional(),
    planValue: z
        .number({ invalid_type_error: 'Informe o valor em reais (ex.: 150 ou 149,90)' })
        .min(0, 'O valor não pode ser negativo')
        .optional(),
    planExpiresAt: z.string().optional(),
    paymentStatus: z.enum(['PAID', 'PENDENTE', 'OVERDUE']).optional(),
    anamnesis: z
        .object({
            activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
            injuries: longText.optional(),
            restrictions: longText.optional(),
            medications: longText.optional(),
            notes: longText.optional(),
        })
        .optional(),
});

export const anamnesisSchema = z.object({
    restrictions: longText.optional(),
    injuries: longText.optional(),
    medications: longText.optional(),
    activityLevel: z.enum(ACTIVITY_LEVELS, { errorMap: () => ({ message: 'Selecione o nível de atividade' }) }),
    notes: longText.optional(),
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
