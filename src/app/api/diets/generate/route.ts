import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { generateDietWithOpenAI } from '@/lib/openai-diet-generator';

export const runtime = 'nodejs';

const requestSchema = z.object({
    mode: z.enum(['student', 'template']).default('student'),
    studentId: z.string().trim().optional(),
    studentInfo: z.string().trim().min(10, 'Descreva as necessidades do aluno').max(4000),
    requiredFoods: z.string().trim().min(2, 'Informe os alimentos que devem estar na dieta').max(2000),
    mealCount: z.number().int().min(2).max(8),
}).superRefine((data, context) => {
    if (data.mode === 'student' && !data.studentId) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['studentId'],
            message: 'Aluno é obrigatório',
        });
    }
});

function calculateAge(birthDate: Date | null): number | null {
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? age : null;
}

// POST /api/diets/generate - Gera um rascunho de dieta com a OpenAI para revisão do personal
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const parsedBody = requestSchema.safeParse(await request.json());
        if (!parsedBody.success) {
            return NextResponse.json(
                { success: false, error: parsedBody.error.issues[0]?.message || 'Dados inválidos' },
                { status: 400 }
            );
        }

        const { mode, studentId, studentInfo, requiredFoods, mealCount } = parsedBody.data;
        const student = mode === 'student' && studentId
            ? await prisma.student.findFirst({
                where: { id: studentId, personalId: session.user.personalId },
                include: {
                    user: { select: { name: true } },
                    anamnesis: true,
                },
            })
            : null;

        if (mode === 'student' && !student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const diet = await generateDietWithOpenAI({
            student: {
                name: student?.user.name || 'Modelo alimentar sem aluno atribuído',
                age: calculateAge(student?.birthDate || null),
                gender: student?.gender || null,
                height: student?.height || null,
                weight: student?.weight || null,
                goal: student?.goal || null,
                activityLevel: student?.anamnesis?.activityLevel || null,
                restrictions: student?.anamnesis?.restrictions || null,
                medications: student?.anamnesis?.medications || null,
                notes: student?.anamnesis?.notes || null,
            },
            trainerNotes: studentInfo,
            requiredFoods,
            mealCount,
        });

        return NextResponse.json({ success: true, data: diet });
    } catch (error) {
        console.error('Error generating diet with OpenAI:', error);

        if (error instanceof Error && error.message === 'OPENAI_API_KEY_NOT_CONFIGURED') {
            return NextResponse.json(
                { success: false, error: 'A integração com a OpenAI ainda não foi configurada.' },
                { status: 503 }
            );
        }

        if (error instanceof Error && error.name === 'TimeoutError') {
            return NextResponse.json(
                { success: false, error: 'A geração demorou mais que o esperado. Tente novamente.' },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Não foi possível gerar a dieta agora. Tente novamente.' },
            { status: 502 }
        );
    }
}
