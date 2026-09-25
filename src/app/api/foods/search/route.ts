import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getVisibleCreatorIds, searchFoods } from '@/lib/food-database';

export const dynamic = 'force-dynamic';

// GET /api/foods/search?q=arroz[&limit=20] - busca sem acento; usada pelo painel, iOS e troca de alimentos do aluno.
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = (searchParams.get('q') || '').trim();

    if (!query || query.length < 2) {
        return NextResponse.json({ success: true, data: [] });
    }

    try {
        const session = await getServerSession(authOptions);
        const creatorIds = await getVisibleCreatorIds(session?.user);
        const limitParam = Number(searchParams.get('limit') || '20');
        const limit = Number.isFinite(limitParam) ? limitParam : 20;

        const data = await searchFoods(query, creatorIds, limit);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Search Error:', error);
        return NextResponse.json({ success: false, error: 'Erro ao buscar alimentos' }, { status: 500 });
    }
}
