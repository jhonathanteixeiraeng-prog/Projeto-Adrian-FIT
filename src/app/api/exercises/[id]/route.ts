import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateExerciseSchema = z.object({
    name: z.string().min(1).optional(),
    muscleGroup: z.string().min(1).optional(),
    equipment: z.string().optional(),
    difficulty: z.enum(['INICIANTE', 'INTERMEDIARIO', 'AVANCADO']).optional(),
    videoUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
    thumbnailUrl: z.string().url().optional().or(z.literal('')).or(z.null()),
    instructions: z.string().optional(),
    tips: z.string().optional(),
});

// GET - Get single exercise
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const exercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        if (!exercise) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }

        return NextResponse.json(exercise);
    } catch (error) {
        console.error('Error fetching exercise:', error);
        return NextResponse.json({ error: 'Erro ao buscar exercício' }, { status: 500 });
    }
}

// PUT - Update exercise
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = updateExerciseSchema.parse(body);

        // Check if exercise exists
        const existingExercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        if (!existingExercise) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }

        const exercise = await prisma.exercise.update({
            where: { id: params.id },
            data: {
                ...validatedData,
                videoUrl: validatedData.videoUrl === '' ? null : validatedData.videoUrl,
                thumbnailUrl: validatedData.thumbnailUrl === '' ? null : validatedData.thumbnailUrl,
            },
        });

        return NextResponse.json(exercise);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error updating exercise:', error);
        return NextResponse.json({ error: 'Erro ao atualizar exercício' }, { status: 500 });
    }
}

// DELETE - Delete exercise
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // Check if exercise exists
        const existingExercise = await prisma.exercise.findUnique({
            where: { id: params.id },
        });

        if (!existingExercise) {
            return NextResponse.json({ error: 'Exercício não encontrado' }, { status: 404 });
        }

        await prisma.exercise.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting exercise:', error);
        return NextResponse.json({ error: 'Erro ao excluir exercício' }, { status: 500 });
    }
}
