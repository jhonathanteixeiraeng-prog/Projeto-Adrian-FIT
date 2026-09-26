import { STUDENTS_USE_APP } from '@/lib/features';
import prisma from '@/lib/prisma';

export interface NotifyStudentAboutPlanInput {
    studentId: string;
    kind: 'workout' | 'diet';
    title: string;
}

/**
 * Server only. Notifies the student (in-app notification) that a new workout or diet plan was created or activated.
 * Best effort: failures are logged and never break the plan request. Nothing is sent while students
 * don't use the app (STUDENTS_USE_APP): the trainer sends the plan as PDF over WhatsApp.
 */
export async function notifyStudentAboutPlan(input: NotifyStudentAboutPlanInput): Promise<void> {
    if (!STUDENTS_USE_APP) return;
    try {
        const student = await prisma.student.findUnique({
            where: { id: input.studentId },
            select: { userId: true },
        });
        if (!student?.userId) return;

        const isWorkout = input.kind === 'workout';
        await prisma.notification.create({
            data: {
                userId: student.userId,
                type: 'PLAN_UPDATED',
                title: isWorkout ? 'Nova ficha de treino disponível 🏋️' : 'Novo plano alimentar disponível 🍽️',
                body: isWorkout
                    ? `Seu personal preparou a ficha "${input.title}". Confira no app!`
                    : `Seu personal preparou o plano alimentar "${input.title}". Confira no app!`,
                link: isWorkout ? '/student/workout' : '/student/diet',
            },
        });
    } catch (error) {
        console.error('Failed to notify student about plan:', error);
    }
}
