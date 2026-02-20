import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get('q') || '').trim();
        const systemOnly = searchParams.get('systemOnly') === 'true';
        const limitParam = Number(searchParams.get('limit') || '300');
        const take = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 300;

        const where: any = {};

        if (query) {
            where.name = {
                contains: query,
            };
        }

        if (systemOnly) {
            where.isSystem = true;
        }

        const foods = await prisma.food.findMany({
            where,
            orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
            take,
        });

        return NextResponse.json({ success: true, data: foods });
    } catch (error) {
        console.error('Get Foods Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar alimentos' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json();
        const { name, portion, calories, protein, carbs, fat } = body;

        if (!name || isNaN(calories) || isNaN(protein) || isNaN(carbs) || isNaN(fat)) {
            return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }

        const newFood = await prisma.food.create({
            data: {
                name,
                portion: portion || '100g',
                calories: Number(calories),
                protein: Number(protein),
                carbs: Number(carbs),
                fat: Number(fat),
                isSystem: false, // User created / Imported
                createdById: session.user.id
            }
        });

        return NextResponse.json({ success: true, data: newFood });

    } catch (error) {
        console.error('Create Food Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao salvar alimento' }, { status: 500 });
    }
}
