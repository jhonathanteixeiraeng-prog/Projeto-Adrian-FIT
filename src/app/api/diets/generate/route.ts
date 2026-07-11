import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { generateDietPlan } from '@/lib/diet-generator';

// POST /api/diets/generate - Generate an automatic diet plan preview for a student
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { studentId, goal } = body as { studentId?: string; goal?: string };

        if (!studentId) {
            return NextResponse.json(
                { success: false, error: 'Aluno é obrigatório' },
                { status: 400 }
            );
        }

        const student = await prisma.student.findFirst({
            where: { id: studentId, personalId: session.user.personalId },
            include: {
                user: { select: { birthDate: true } },
                anamnesis: true,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const birthDate = student.birthDate || student.user?.birthDate;
        if (!student.weight || !student.height || !birthDate) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'O aluno precisa ter peso, altura e data de nascimento cadastrados para gerar a dieta.',
                },
                { status: 400 }
            );
        }

        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

        const allowedGoals = ['WEIGHT_LOSS', 'MAINTENANCE', 'MUSCLE_GAIN'];
        const resolvedGoal = allowedGoals.includes(goal || '')
            ? (goal as 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN')
            : allowedGoals.includes(student.goal || '')
                ? (student.goal as 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN')
                : 'MAINTENANCE';

        const plan = generateDietPlan({
            weight: student.weight,
            height: student.height,
            age,
            gender: (student.gender === 'FEMALE' ? 'FEMALE' : 'MALE'),
            activityLevel: (student.anamnesis?.activityLevel as
                | 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE') || 'MODERATE',
            goal: resolvedGoal,
            restrictions: student.anamnesis?.restrictions || '',
        });

        return NextResponse.json({ success: true, data: plan });
    } catch (error) {
        console.error('Error generating diet plan:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao gerar dieta automática' },
            { status: 500 }
        );
    }
}
