'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { WorkoutEditorLoader, type EditorSource } from '@/components/personal/workout-editor/workout-editor-loader';

/**
 * /personal/students/{studentId}/workout edits the student's ACTIVE plan; without one it starts a
 * new plan for the student (it never reopens an old inactive plan). ?planId= edits that plan.
 */
export default function StudentWorkoutPage() {
    const params = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const source: EditorSource = { kind: 'student', studentId: params.id, planId: searchParams.get('planId') };
    return <WorkoutEditorLoader key={JSON.stringify(source)} source={source} />;
}
