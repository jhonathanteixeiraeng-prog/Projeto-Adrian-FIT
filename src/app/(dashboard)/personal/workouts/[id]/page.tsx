'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { WorkoutEditorLoader, type EditorSource } from '@/components/personal/workout-editor/workout-editor-loader';

/** /personal/workouts/{planId} edits any plan; /personal/workouts/{templateId}?kind=template edits a library template. */
export default function EditWorkoutPage() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const source: EditorSource =
        searchParams.get('kind') === 'template' ? { kind: 'template', templateId: params.id } : { kind: 'plan', planId: params.id };
    return <WorkoutEditorLoader key={JSON.stringify(source)} source={source} />;
}
