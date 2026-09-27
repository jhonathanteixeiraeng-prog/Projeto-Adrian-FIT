import { NextRequest } from 'next/server';
import { markPlanSent } from '@/lib/plan-send-server';

export const dynamic = 'force-dynamic';

// POST /api/workout-plans/[id]/sent - The trainer sent this plan's PDF ({ version } it showed).
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    return markPlanSent(request, 'workout', params.id);
}
