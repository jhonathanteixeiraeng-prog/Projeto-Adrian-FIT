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
        const { studentId, goal, calories, protein, carbs, fat } = body as {
            studentId?: string; goal?: string; calories?: number; protein?: number; carbs?: number; fat?: number;
        };

        if (!studentId) {
            return NextResponse.json(
                { success: false, error: 'Aluno é obrigatório' },
                { status: 400 }
            );
        }

        const ranges = [
            ['calorias', calories, 800, 6000], ['proteínas', protein, 20, 400],
            ['carboidratos', carbs, 20, 800], ['gorduras', fat, 10, 300],
        ] as const;
        for (const [label, value, min, max] of ranges) {
            if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
                return NextResponse.json({ success: false, error: `Meta de ${label} inválida` }, { status: 400 });
            }
        }
        if (calories && protein && carbs && fat) {
            const macroCalories = protein * 4 + carbs * 4 + fat * 9;
            if (Math.abs(macroCalories - calories) / calories > 0.15) {
                return NextResponse.json({ success: false, error: 'Os macronutrientes precisam ser compatíveis com a meta calórica (tolerância de 15%).' }, { status: 400 });
            }
        }

        const student = await prisma.student.findFirst({
            where: { id: studentId, personalId: session.user.personalId },
            include: {
                anamnesis: true,
            },
        });

        if (!student) {
            return NextResponse.json(
                { success: false, error: 'Aluno não encontrado' },
                { status: 404 }
            );
        }

        const birthDate = student.birthDate;
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
            targetCalories: calories,
            targetProtein: protein,
            targetCarbs: carbs,
            targetFat: fat,
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
