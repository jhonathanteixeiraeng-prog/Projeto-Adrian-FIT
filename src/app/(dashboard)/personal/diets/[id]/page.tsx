'use client';

import { useParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/{planId}: edita o plano pelo id.
export default function EditDietPage() {
    const { id: planId } = useParams<{ id: string }>();

    return <DietPlanEditor key={planId} route={{ type: 'edit-plan', planId }} />;
}
