import { NextRequest } from 'next/server';
import { markPlanSent } from '@/lib/plan-send-server';

export const dynamic = 'force-dynamic';

// POST /api/diets/[id]/sent - The trainer sent this diet's PDF ({ version } it showed).
export function POST(request: NextRequest, { params }: { params: { id: string } }) {
    return markPlanSent(request, 'diet', params.id);
}
