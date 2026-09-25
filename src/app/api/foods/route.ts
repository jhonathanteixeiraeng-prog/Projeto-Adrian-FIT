import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getVisibleCreatorIds } from '@/lib/food-database';

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
        } else {
            // Alimentos próprios só aparecem para o personal que os criou (e seus alunos).
            const session = await getServerSession(authOptions);
            const creatorIds = await getVisibleCreatorIds(session?.user);
            where.OR = [
                { isSystem: true },
                ...(creatorIds.length > 0 ? [{ createdById: { in: creatorIds } }] : []),
            ];
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

function toMacro(value: unknown): number {
    const parsed = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await request.json();
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const portion = typeof body?.portion === 'string' && body.portion.trim() ? body.portion.trim() : '100g';
        const calories = toMacro(body?.calories);
        const protein = toMacro(body?.protein);
        const carbs = toMacro(body?.carbs);
        const fat = toMacro(body?.fat);

        if (!name || [calories, protein, carbs, fat].some((value) => Number.isNaN(value) || value < 0)) {
            return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }

        const newFood = await prisma.food.create({
            data: {
                name: name.slice(0, 200),
                portion: portion.slice(0, 120),
                calories,
                protein,
                carbs,
                fat,
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
