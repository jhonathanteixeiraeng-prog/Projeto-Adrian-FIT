import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { matchesSearch } from '@/lib/utils';
import {
    DUPLICATE_EXERCISE_NAME,
    exerciseCreateSchema,
    isExerciseNameTaken,
    validationErrorResponse,
} from '@/lib/workout-plans';

export const dynamic = 'force-dynamic';

// GET - List exercises: the global library plus the signed-in personal's own exercises.
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const personalId = session?.user?.role === 'PERSONAL' ? session.user.personalId : undefined;

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const muscleGroup = searchParams.get('muscleGroup') || '';
        const difficulty = searchParams.get('difficulty') || '';

        const where: Prisma.ExerciseWhereInput = {
            OR: personalId ? [{ personalId: null }, { personalId }] : [{ personalId: null }],
        };
        if (muscleGroup) where.muscleGroup = muscleGroup;
        if (difficulty) where.difficulty = difficulty;

        const exercises = await prisma.exercise.findMany({
            where,
            orderBy: { name: 'asc' },
        });

        // Accent/case-insensitive search ("triceps" finds "Tríceps Francês") done in memory: the library is small.
        const data = search
            ? exercises.filter((exercise) => matchesSearch(search, exercise.name, exercise.muscleGroup, exercise.equipment))
            : exercises;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching exercises:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar exercícios' }, { status: 500 });
    }
}

// POST - Create exercise (owned by the personal who creates it)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: 'Corpo da requisição inválido' }, { status: 400 });
        }

        const parsed = exerciseCreateSchema.safeParse(body);
        if (!parsed.success) {
            return validationErrorResponse(parsed.error, body);
        }
        const validatedData = parsed.data;

        if (await isExerciseNameTaken(prisma, validatedData.name, undefined, session.user.personalId)) {
            return NextResponse.json({ success: false, error: DUPLICATE_EXERCISE_NAME }, { status: 409 });
        }

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
                personalId: session.user.personalId || null,
            },
        });

        return NextResponse.json(exercise, { status: 201 });
    } catch (error) {
        if ((error as { code?: string } | null)?.code === 'P2002') {
            return NextResponse.json({ success: false, error: DUPLICATE_EXERCISE_NAME }, { status: 409 });
        }
        console.error('Error creating exercise:', error);
        return NextResponse.json({ error: 'Erro ao criar exercício' }, { status: 500 });
    }
}
