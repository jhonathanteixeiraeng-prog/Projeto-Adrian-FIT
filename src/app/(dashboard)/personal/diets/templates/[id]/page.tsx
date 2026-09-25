'use client';

import { useParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/diets/templates/{templateId}: edita um modelo da biblioteca.
export default function EditDietTemplatePage() {
    const params = useParams();
    const templateId = Array.isArray(params.id) ? params.id[0] : params.id;

    return <DietPlanEditor key={templateId} route={{ type: 'edit-template', templateId }} />;
}
