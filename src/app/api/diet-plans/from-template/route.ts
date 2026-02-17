import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const cloneTemplateSchema = z.object({
    templateId: z.string().min(1, 'Template ID é obrigatório'),
    studentId: z.string().min(1, 'Aluno é obrigatório'),
    startDate: z.string(),
    endDate: z.string(),
});

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.user.role !== 'PERSONAL') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await request.json();
        const validatedData = cloneTemplateSchema.parse(body);

        // Fetch template
        const template = await prisma.dietTemplate.findUnique({
            where: { id: validatedData.templateId },
            include: { meals: true },
        });

        if (!template) {
            return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 });
        }

        if (template.personalId !== session.user.personalId) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
        }

        // Create Diet Plan from Template
        const dietPlan = await prisma.dietPlan.create({
            data: {
                title: template.title,
                studentId: validatedData.studentId,
                personalId: session.user.personalId!,
                startDate: new Date(validatedData.startDate),
                endDate: new Date(validatedData.endDate),
                active: true,
                version: 1,
                calories: template.calories,
                protein: template.protein,
                carbs: template.carbs,
                fat: template.fat,
                meals: {
                    create: template.meals.map((meal) => ({
                        name: meal.name,
                        time: meal.time,
                        order: meal.order,
                        notes: meal.notes,
                        foods: meal.foods, // JSON copy
                    })),
                },
            },
            include: {
                meals: true,
            },
        });

        return NextResponse.json(dietPlan, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
        }
        console.error('Error cloning diet template:', error);
        return NextResponse.json({ error: 'Erro ao criar plano a partir do modelo' }, { status: 500 });
    }
}
