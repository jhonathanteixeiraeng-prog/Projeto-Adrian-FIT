'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { DietPlanEditor } from '@/components/personal/diet-editor/diet-plan-editor';

// /personal/students/{studentId}/diet[?planId=]: edita a dieta ativa do aluno (ou inicia uma nova).
export default function StudentDietPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const studentId = Array.isArray(params.id) ? params.id[0] : params.id;
    const planId = searchParams.get('planId');

    return <DietPlanEditor key={studentId} route={{ type: 'student', studentId, planId }} />;
}
