'use client';

import { useSearchParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/templates/new[?fromPlanId=]: novo modelo de dieta (do zero ou a partir de um plano).
export default function NewDietTemplatePage() {
    const fromPlanId = useSearchParams().get('fromPlanId');

    return <DietPlanEditor key={fromPlanId ?? 'blank'} route={{ type: 'new-template', fromPlanId }} />;
}
