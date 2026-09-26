'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RotateCw } from 'lucide-react';
import { apiFetcher, useApi } from '@/hooks/use-api';
import { usePageMeta, type PageMeta } from '@/components/personal/page-meta';
import { rememberRecentStudent } from '@/components/personal/command-palette';
import { apiDaysToEditor, emptyState, type ApiPlan, type ApiTemplate, type EditorDay } from './editor-state';
import { takeEditorHandoff } from './editor-storage';
import { addDaysYmd, DEFAULT_PLAN_LENGTH_DAYS, diffDaysYmd, planDateToInput, todayYmd } from './plan-dates';
import type { StudentOption } from './student-picker';
import { WorkoutPlanEditor, type WorkoutPlanEditorProps } from './workout-plan-editor';

export type EditorSource =
    /** /personal/workouts/new — optional prefill from a template or a copy of a plan; `template` creates a library model. */
    | { kind: 'new'; studentId?: string | null; templateId?: string | null; fromPlanId?: string | null; template?: boolean }
    /** /personal/workouts/[id] */
    | { kind: 'plan'; planId: string }
    /** /personal/workouts/[id]?kind=template */
    | { kind: 'template'; templateId: string }
    /** /personal/students/[id]/workout — the active plan, a new plan for the student, or ?planId */
    | { kind: 'student'; studentId: string; planId?: string | null };

type LoadState =
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | { status: 'ready'; props: WorkoutPlanEditorProps };

function defaultPlanTitle() {
    const now = new Date();
    return `Treino ${now.toLocaleDateString('pt-BR', { month: 'long' })}/${now.getFullYear()}`;
}

function newPlanProps(options: {
    context: 'workouts' | 'student';
    studentId?: string | null;
    studentLocked: boolean;
    title?: string;
    days?: EditorDay[];
    lengthDays?: number | null;
    sourceNote?: string | null;
    draftKey: string;
}): WorkoutPlanEditorProps {
    const start = todayYmd();
    const length = options.lengthDays && options.lengthDays > 0 ? options.lengthDays : DEFAULT_PLAN_LENGTH_DAYS;
    return {
        mode: 'plan',
        context: options.context,
        initialState: emptyState({
            title: options.title ?? defaultPlanTitle(),
            studentId: options.studentId ?? '',
            startDate: start,
            endDate: addDaysYmd(start, length),
            days: options.days ?? [],
        }),
        entityId: null,
        version: null,
        active: false,
        updatedAt: null,
        studentLocked: options.studentLocked,
        studentName: null,
        draftKey: options.draftKey,
        sourceNote: options.sourceNote ?? null,
    };
}

async function loadPlan(planId: string, context: 'workouts' | 'student'): Promise<WorkoutPlanEditorProps> {
    const draftKey = `plan:${planId}`;
    const handoff = takeEditorHandoff(planId);
    if (handoff) {
        return {
            mode: 'plan',
            context,
            initialState: handoff.state,
            initialBaseline: handoff.baseline,
            entityId: planId,
            version: handoff.version,
            active: handoff.active,
            updatedAt: handoff.updatedAt,
            studentLocked: true,
            studentName: handoff.studentName,
            draftKey,
        };
    }
    const plan = await apiFetcher<ApiPlan>(`/api/workout-plans/${planId}`);
    return {
        mode: 'plan',
        context,
        initialState: emptyState({
            title: plan.title,
            studentId: plan.studentId,
            startDate: planDateToInput(plan.startDate),
            endDate: planDateToInput(plan.endDate),
            days: apiDaysToEditor(plan.workoutDays, true),
        }),
        entityId: plan.id,
        version: plan.version,
        active: plan.active,
        updatedAt: plan.updatedAt ?? null,
        studentLocked: true,
        studentName: plan.student?.user?.name ?? null,
        draftKey,
    };
}

async function loadTemplate(templateId: string): Promise<WorkoutPlanEditorProps> {
    const draftKey = `template:${templateId}`;
    const handoff = takeEditorHandoff(templateId);
    if (handoff) {
        return {
            mode: 'template',
            context: 'workouts',
            initialState: handoff.state,
            initialBaseline: handoff.baseline,
            entityId: templateId,
            version: null,
            active: false,
            updatedAt: handoff.updatedAt,
            studentLocked: true,
            studentName: null,
            draftKey,
        };
    }
    const template = await apiFetcher<ApiTemplate>(`/api/workout-templates/${templateId}`);
    return {
        mode: 'template',
        context: 'workouts',
        initialState: emptyState({
            title: template.title,
            description: template.description ?? '',
            days: apiDaysToEditor(template.templateDays, false),
        }),
        entityId: template.id,
        version: null,
        active: false,
        updatedAt: template.updatedAt ?? null,
        studentLocked: true,
        studentName: null,
        draftKey,
    };
}

async function loadEditor(source: EditorSource): Promise<WorkoutPlanEditorProps> {
    switch (source.kind) {
        case 'plan':
            return loadPlan(source.planId, 'workouts');

        case 'template':
            return loadTemplate(source.templateId);

        case 'student': {
            if (source.planId) {
                const props = await loadPlan(source.planId, 'student');
                if (props.initialState.studentId !== source.studentId) {
                    throw new Error('Esta ficha não pertence a este aluno.');
                }
                return props;
            }
            // The student's ACTIVE plan; without one, a new plan (never an old inactive one).
            const plans = await apiFetcher<Array<{ id: string }>>(
                `/api/workout-plans?studentId=${encodeURIComponent(source.studentId)}&active=true`
            );
            if (plans[0]) return loadPlan(plans[0].id, 'student');
            return newPlanProps({
                context: 'student',
                studentId: source.studentId,
                studentLocked: true,
                draftKey: `new:${source.studentId}`,
            });
        }

        case 'new': {
            if (source.template) {
                return {
                    mode: 'template',
                    context: 'workouts',
                    initialState: emptyState(),
                    entityId: null,
                    version: null,
                    active: false,
                    updatedAt: null,
                    studentLocked: true,
                    studentName: null,
                    draftKey: 'new-template',
                };
            }
            const studentId = source.studentId ?? '';
            if (source.templateId) {
                const template = await apiFetcher<ApiTemplate>(`/api/workout-templates/${source.templateId}`);
                return newPlanProps({
                    context: 'workouts',
                    studentId,
                    studentLocked: false,
                    title: template.title,
                    days: apiDaysToEditor(template.templateDays, false),
                    sourceNote: `Baseada no modelo “${template.title}”.`,
                    draftKey: `new:${studentId}:template:${source.templateId}`,
                });
            }
            if (source.fromPlanId) {
                const plan = await apiFetcher<ApiPlan>(`/api/workout-plans/${source.fromPlanId}`);
                const owner = plan.student?.user?.name;
                return newPlanProps({
                    context: 'workouts',
                    studentId,
                    studentLocked: false,
                    title: `${plan.title} (cópia)`,
                    days: apiDaysToEditor(plan.workoutDays, false),
                    lengthDays: diffDaysYmd(planDateToInput(plan.startDate), planDateToInput(plan.endDate)),
                    sourceNote: `Cópia da ficha “${plan.title}”${owner ? ` de ${owner}` : ''}.`,
                    draftKey: `new:${studentId}:plan:${source.fromPlanId}`,
                });
            }
            return newPlanProps({ context: 'workouts', studentId, studentLocked: false, draftKey: `new:${studentId}` });
        }
    }
}

function LoaderMeta({ meta }: { meta: PageMeta }) {
    usePageMeta(meta);
    return null;
}

function EditorSkeleton() {
    return (
        <div className="flex flex-col gap-3 lg:h-[calc(100dvh-8rem)]" aria-busy="true" aria-label="Carregando ficha">
            <div className="skeleton-shimmer h-[52px] rounded-2xl" />
            <div className="flex min-h-0 flex-1 gap-4">
                <div className="hidden w-[340px] shrink-0 flex-col gap-2 rounded-2xl border border-border bg-card p-3 lg:flex">
                    <div className="skeleton-shimmer h-9" />
                    <div className="skeleton-shimmer h-7" />
                    {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className="skeleton-shimmer h-10" />
                    ))}
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                    <div className="skeleton-shimmer h-[92px] rounded-2xl" />
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="space-y-2 rounded-2xl border border-border bg-card p-3">
                            <div className="skeleton-shimmer h-8 w-1/2" />
                            {Array.from({ length: 4 }).map((__, row) => (
                                <div key={row} className="skeleton-shimmer h-8" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** Loads whatever the route points to and renders the unified workout editor. */
export function WorkoutEditorLoader({ source }: { source: EditorSource }) {
    const [state, setState] = useState<LoadState>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const studentId = source.kind === 'student' ? source.studentId : null;
    const studentsApi = useApi<StudentOption[]>(studentId ? '/api/students' : null);
    const studentName = studentId ? studentsApi.data?.find((student) => student.id === studentId)?.user.name : undefined;
    const sourceKey = JSON.stringify(source);

    useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading' });
        loadEditor(JSON.parse(sourceKey) as EditorSource)
            .then((props) => {
                if (!cancelled) setState({ status: 'ready', props });
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setState({ status: 'error', message: error instanceof Error ? error.message : 'Erro ao carregar a ficha' });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [sourceKey, attempt]);

    useEffect(() => {
        if (studentId) rememberRecentStudent(studentId);
    }, [studentId]);

    if (state.status === 'ready') {
        return <WorkoutPlanEditor {...state.props} />;
    }

    const meta: PageMeta = studentId
        ? {
              title: studentName ? `${studentName} · Treino` : 'Treino',
              breadcrumbs: [
                  { label: 'Alunos', href: '/personal/students' },
                  { label: studentName ?? 'Aluno', href: `/personal/students/${studentId}` },
                  { label: 'Treino' },
              ],
          }
        : {
              title: source.kind === 'new' ? 'Nova ficha' : 'Ficha de treino',
              breadcrumbs: [{ label: 'Fichas de treino', href: '/personal/workouts' }, { label: source.kind === 'new' ? 'Nova ficha' : 'Ficha' }],
          };

    if (state.status === 'loading') {
        return (
            <>
                <LoaderMeta meta={meta} />
                <EditorSkeleton />
            </>
        );
    }

    const backHref = studentId ? `/personal/students/${studentId}?tab=workout` : '/personal/workouts';
    return (
        <>
            <LoaderMeta meta={meta} />
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
                <h1 className="mt-3 text-base font-semibold text-foreground">Não foi possível abrir a ficha</h1>
                <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
                <div className="mt-5 flex justify-center gap-2">
                    <Link
                        href={backHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                        <ArrowLeft className="h-4 w-4" /> Voltar
                    </Link>
                    <button
                        type="button"
                        onClick={() => setAttempt((current) => current + 1)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                        <RotateCw className="h-4 w-4" /> Tentar novamente
                    </button>
                </div>
            </div>
        </>
    );
}
