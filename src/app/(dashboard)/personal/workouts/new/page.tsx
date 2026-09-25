'use client';

import { useSearchParams } from 'next/navigation';
import { WorkoutEditorLoader, type EditorSource } from '@/components/personal/workout-editor/workout-editor-loader';

/**
 * /personal/workouts/new
 *   ?studentId=  preselects the student
 *   ?templateId= prefills from a library template
 *   ?fromPlanId= prefills a copy of an existing plan ("Duplicar para aluno…")
 *   ?kind=template creates a new library template instead of a plan
 */
export default function NewWorkoutPage() {
    const searchParams = useSearchParams();
    const source: EditorSource = {
        kind: 'new',
        studentId: searchParams.get('studentId'),
        templateId: searchParams.get('templateId'),
        fromPlanId: searchParams.get('fromPlanId'),
        template: searchParams.get('kind') === 'template',
    };
    return <WorkoutEditorLoader key={JSON.stringify(source)} source={source} />;
}
