'use client';

import { useSearchParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/new[?studentId=][&templateId=][&fromPlanId=]
export default function NewDietPage() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get('studentId');
    const templateId = searchParams.get('templateId');
    const fromPlanId = searchParams.get('fromPlanId');

    return (
        <DietPlanEditor
            key={`${studentId ?? ''}:${templateId ?? ''}:${fromPlanId ?? ''}`}
            route={{ type: 'new-plan', studentId, templateId, fromPlanId }}
        />
    );
}
