import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST - Seed exercises (for initial setup)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.personalId) {
            return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
        }

        const exercises = [
            // Peito
            { name: 'Supino Reto', muscleGroup: 'Peito', equipment: 'Barra e Banco', difficulty: 'INTERMEDIARIO' },
            { name: 'Supino Inclinado', muscleGroup: 'Peito', equipment: 'Halteres', difficulty: 'INTERMEDIARIO' },
            { name: 'Crucifixo', muscleGroup: 'Peito', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Crossover', muscleGroup: 'Peito', equipment: 'Cabo', difficulty: 'INTERMEDIARIO' },
            { name: 'Flexão de Braço', muscleGroup: 'Peito', equipment: 'Peso Corporal', difficulty: 'INICIANTE' },

            // Costas
            { name: 'Puxada Frontal', muscleGroup: 'Costas', equipment: 'Máquina', difficulty: 'INICIANTE' },
            { name: 'Remada Curvada', muscleGroup: 'Costas', equipment: 'Barra', difficulty: 'INTERMEDIARIO' },
            { name: 'Remada Unilateral', muscleGroup: 'Costas', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Pulldown', muscleGroup: 'Costas', equipment: 'Cabo', difficulty: 'INICIANTE' },
            { name: 'Barra Fixa', muscleGroup: 'Costas', equipment: 'Peso Corporal', difficulty: 'AVANCADO' },

            // Pernas
            { name: 'Agachamento Livre', muscleGroup: 'Pernas', equipment: 'Barra', difficulty: 'AVANCADO' },
            { name: 'Leg Press 45°', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INTERMEDIARIO' },
            { name: 'Extensora', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INICIANTE' },
            { name: 'Flexora', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INICIANTE' },
            { name: 'Stiff', muscleGroup: 'Pernas', equipment: 'Barra', difficulty: 'INTERMEDIARIO' },
            { name: 'Panturrilha', muscleGroup: 'Pernas', equipment: 'Máquina', difficulty: 'INICIANTE' },
            { name: 'Afundo', muscleGroup: 'Pernas', equipment: 'Halteres', difficulty: 'INTERMEDIARIO' },

            // Ombros
            { name: 'Desenvolvimento', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INTERMEDIARIO' },
            { name: 'Elevação Lateral', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Elevação Frontal', muscleGroup: 'Ombro', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Remada Alta', muscleGroup: 'Ombro', equipment: 'Barra', difficulty: 'INTERMEDIARIO' },

            // Bíceps
            { name: 'Rosca Direta', muscleGroup: 'Bíceps', equipment: 'Barra', difficulty: 'INICIANTE' },
            { name: 'Rosca Alternada', muscleGroup: 'Bíceps', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Rosca Martelo', muscleGroup: 'Bíceps', equipment: 'Halteres', difficulty: 'INICIANTE' },
            { name: 'Rosca Scott', muscleGroup: 'Bíceps', equipment: 'Barra', difficulty: 'INTERMEDIARIO' },

            // Tríceps
            { name: 'Tríceps Pulley', muscleGroup: 'Tríceps', equipment: 'Cabo', difficulty: 'INICIANTE' },
            { name: 'Tríceps Francês', muscleGroup: 'Tríceps', equipment: 'Halteres', difficulty: 'INTERMEDIARIO' },
            { name: 'Mergulho', muscleGroup: 'Tríceps', equipment: 'Peso Corporal', difficulty: 'INTERMEDIARIO' },
            { name: 'Tríceps Testa', muscleGroup: 'Tríceps', equipment: 'Barra', difficulty: 'INTERMEDIARIO' },

            // Core
            { name: 'Prancha', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INICIANTE' },
            { name: 'Abdominal Crunch', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INICIANTE' },
            { name: 'Abdominal Infra', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INTERMEDIARIO' },
            { name: 'Russian Twist', muscleGroup: 'Core', equipment: 'Peso Corporal', difficulty: 'INTERMEDIARIO' },
        ];

        let created = 0;
        for (const exercise of exercises) {
            const existing = await prisma.exercise.findUnique({
                where: { name: exercise.name },
            });

            if (!existing) {
                await prisma.exercise.create({
                    data: {
                        name: exercise.name,
                        muscleGroup: exercise.muscleGroup,
                        equipment: exercise.equipment,
                        difficulty: exercise.difficulty,
                        instructions: '',
                        tips: '',
                    },
                });
                created++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `${created} exercícios criados com sucesso!`,
            total: exercises.length,
        });
    } catch (error) {
        console.error('Error seeding exercises:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao criar exercícios' },
            { status: 500 }
        );
    }
}
