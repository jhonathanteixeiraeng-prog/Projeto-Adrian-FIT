'use client';

import { useParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/templates/{templateId}: edita um modelo da biblioteca.
export default function EditDietTemplatePage() {
    const { id: templateId } = useParams<{ id: string }>();

    return <DietPlanEditor key={templateId} route={{ type: 'edit-template', templateId }} />;
}
