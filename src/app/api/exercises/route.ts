import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const exerciseSchema = z.object({
    name: z.string().min(1, 'Nome é obrigatório'),
    muscleGroup: z.string().min(1, 'Grupo muscular é obrigatório'),
    equipment: z.string().optional(),
    difficulty: z.enum(['INICIANTE', 'INTERMEDIARIO', 'AVANCADO']).optional(),
    videoUrl: z.string().url().optional().or(z.literal('')),
    thumbnailUrl: z.string().url().optional().or(z.literal('')),
    instructions: z.string().optional(),
    tips: z.string().optional(),
});

// GET - List exercises (public - no auth required)
export async function GET(request: NextRequest) {
    try {
        // Get query params for filtering
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const muscleGroup = searchParams.get('muscleGroup') || '';
        const difficulty = searchParams.get('difficulty') || '';

        // Build where clause
        const where: any = {};

        if (search) {
            where.name = { contains: search };
        }

        if (muscleGroup) {
            where.muscleGroup = muscleGroup;
        }

        if (difficulty) {
            where.difficulty = difficulty;
        }

        // Return all exercises (global library)
        const exercises = await prisma.exercise.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, data: exercises });
    } catch (error) {
        console.error('Error fetching exercises:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar exercícios' }, { status: 500 });
    }
}

// POST - Create exercise
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = exerciseSchema.parse(body);

        const exercise = await prisma.exercise.create({
            data: {
                name: validatedData.name,
                muscleGroup: validatedData.muscleGroup,
                equipment: validatedData.equipment || '',
                difficulty: validatedData.difficulty || 'INICIANTE',
                videoUrl: validatedData.videoUrl || null,
                thumbnailUrl: validatedData.thumbnailUrl || null,
                instructions: validatedData.instructions || '',
                tips: validatedData.tips || '',
            },
        });

        return NextResponse.json(exercise, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error creating exercise:', error);
        return NextResponse.json({ error: 'Erro ao criar exercício' }, { status: 500 });
    }
}
