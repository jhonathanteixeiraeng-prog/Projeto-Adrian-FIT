'use client';

import { useParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/{planId}: edita o plano pelo id.
export default function EditDietPage() {
    const params = useParams();
    const planId = Array.isArray(params.id) ? params.id[0] : params.id;

    return <DietPlanEditor key={planId} route={{ type: 'edit-plan', planId }} />;
}
