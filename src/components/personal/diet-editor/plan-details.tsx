'use client';

import React from 'react';
import Link from 'next/link';
import { Sigma, Target, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    ACTIVITY_LABELS,
    GOAL_OPTIONS,
    type EditorAction,
    type EditorIssues,
    type EditorKind,
    type EditorState,
    type EnergyEstimate,
    type MacroKey,
    type MacroTotals,
    type StudentProfile,
} from './model';
import { StudentPicker, type StudentOption } from './student-picker';
import { formatInteger } from './units';

const fieldClass =
    'h-10 w-full rounded-xl border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';

const TARGET_FIELDS: { key: MacroKey; label: string }[] = [
    { key: 'calories', label: 'Meta kcal' },
    { key: 'protein', label: 'Proteína (g)' },
    { key: 'carbs', label: 'Carboidrato (g)' },
    { key: 'fat', label: 'Gordura (g)' },
];

function Field({ label, htmlFor, error, children, className }: { label: string; htmlFor?: string; error?: string | false; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('min-w-0 space-y-1.5', className)}>
            <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    );
}

interface PlanDetailsProps {
    kind: EditorKind;
    state: EditorState;
    dispatch: React.Dispatch<EditorAction>;
    errors: EditorIssues | null;
    totals: MacroTotals;
    hasFoods: boolean;
    student: StudentProfile | null;
    energy: EnergyEstimate | null;
    studentId: string;
    studentName: string;
    /** Seletor de aluno (plano novo); null mostra o aluno fixo com link para a ficha. */
    studentPicker: { students: StudentOption[]; loading: boolean; onSelect: (studentId: string) => void } | null;
    datesSuggested: boolean;
    onTargetChange: (key: MacroKey, value: string) => void;
    onSuggestTargets: () => void;
    onUseCalculatedTotals: () => void;
}

/** Título, aluno, período, status e metas diárias do plano (ou do modelo). */
export function PlanDetails({
    kind,
    state,
    dispatch,
    errors,
    totals,
    hasFoods,
    student,
    energy,
    studentId,
    studentName,
    studentPicker,
    datesSuggested,
    onTargetChange,
    onSuggestTargets,
    onUseCalculatedTotals,
}: PlanDetailsProps) {
    return (
        <section aria-label="Dados do plano" className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className={cn('grid gap-3', kind === 'plan' ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_9.5rem_9.5rem_auto]' : 'md:grid-cols-2')}>
                <Field label={kind === 'template' ? 'Nome do modelo' : 'Título do plano'} htmlFor="diet-editor-title" error={errors?.title}>
                    <input
                        id="diet-editor-title"
                        value={state.title}
                        onChange={(event) => dispatch({ type: 'set', patch: { title: event.target.value } })}
                        placeholder={kind === 'template' ? 'Ex.: Emagrecimento 1.800 kcal' : 'Ex.: Cutting 2.000 kcal'}
                        aria-invalid={Boolean(errors?.title) || undefined}
                        className={cn(fieldClass, errors?.title ? 'border-red-500' : 'border-border')}
                    />
                </Field>

                {kind === 'plan' && (
                    <>
                        <Field label="Aluno" htmlFor="diet-editor-student" error={errors?.student}>
                            {studentPicker ? (
                                <StudentPicker
                                    id="diet-editor-student"
                                    students={studentPicker.students}
                                    value={state.studentId}
                                    onChange={studentPicker.onSelect}
                                    loading={studentPicker.loading}
                                    invalid={Boolean(errors?.student)}
                                />
                            ) : (
                                <Link
                                    href={`/personal/students/${studentId}?tab=diet`}
                                    className="flex h-10 items-center gap-2 truncate rounded-xl border border-border bg-muted/40 px-3 text-sm font-medium text-foreground hover:border-[#F88022]/60"
                                >
                                    <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{studentName || 'Aluno'}</span>
                                </Link>
                            )}
                        </Field>
                        <Field label="Início" htmlFor="diet-editor-start" error={errors?.startDate}>
                            <input
                                id="diet-editor-start"
                                type="date"
                                value={state.startDate}
                                onChange={(event) => dispatch({ type: 'set', patch: { startDate: event.target.value } })}
                                aria-invalid={Boolean(errors?.startDate) || undefined}
                                className={cn(fieldClass, 'tabular-nums', errors?.startDate ? 'border-red-500' : 'border-border')}
                            />
                        </Field>
                        <Field label="Término" htmlFor="diet-editor-end" error={errors?.endDate}>
                            <input
                                id="diet-editor-end"
                                type="date"
                                value={state.endDate}
                                min={state.startDate || undefined}
                                onChange={(event) => dispatch({ type: 'set', patch: { endDate: event.target.value } })}
                                aria-invalid={Boolean(errors?.endDate) || undefined}
                                className={cn(fieldClass, 'tabular-nums', errors?.endDate ? 'border-red-500' : 'border-border')}
                            />
                        </Field>
                        <Field label="Status">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={state.active}
                                onClick={() => dispatch({ type: 'set', patch: { active: !state.active } })}
                                title={state.active ? 'Visível no app do aluno' : 'Não aparece no app do aluno'}
                                className={cn(
                                    'flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                                    state.active
                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'border-border bg-muted/40 text-muted-foreground'
                                )}
                            >
                                <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', state.active ? 'bg-emerald-500' : 'bg-muted-foreground/40')}>
                                    <span
                                        className={cn(
                                            'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                                            state.active ? 'translate-x-4' : 'translate-x-0'
                                        )}
                                    />
                                </span>
                                {state.active ? 'Ativa no app' : 'Inativa'}
                            </button>
                        </Field>
                    </>
                )}
            </div>

            {kind === 'plan' && datesSuggested && (
                <p className="-mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Este plano não tinha período definido: sugerimos início na data de criação e 30 dias de duração. Ajuste se precisar e salve.
                </p>
            )}

            <div className="flex flex-wrap items-end gap-3 border-t border-border/70 pt-3">
                <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-2xl">
                    {TARGET_FIELDS.map((target) => (
                        <Field key={target.key} label={target.label} htmlFor={`diet-editor-target-${target.key}`}>
                            <input
                                id={`diet-editor-target-${target.key}`}
                                inputMode="numeric"
                                value={state.targets[target.key]}
                                placeholder={formatInteger(totals[target.key])}
                                onChange={(event) => onTargetChange(target.key, event.target.value)}
                                className={cn(fieldClass, 'border-border text-right tabular-nums')}
                            />
                        </Field>
                    ))}
                </div>
                <div className="flex flex-wrap gap-2 pb-0.5">
                    {energy && (
                        <button
                            type="button"
                            onClick={onSuggestTargets}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
                            title="Metas pelo gasto energético estimado e pelo objetivo do aluno"
                        >
                            <Target className="h-4 w-4 text-[#F88022]" />
                            Sugerir pelo gasto ({formatInteger(energy.targetCalories)} kcal)
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onUseCalculatedTotals}
                        disabled={!hasFoods}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
                        title="Copia para as metas a soma atual dos alimentos"
                    >
                        <Sigma className="h-4 w-4 text-muted-foreground" />
                        Igualar à soma dos alimentos
                    </button>
                </div>
                <p className="basis-full text-xs text-muted-foreground">
                    {kind === 'plan' ? 'As metas aparecem para o aluno como objetivo diário. ' : ''}Em branco, vale a soma dos alimentos.
                    {energy && student && (
                        <>
                            {' '}
                            Gasto estimado de {student.name.split(' ')[0]}: <strong className="text-foreground">{formatInteger(energy.tdee)} kcal/dia</strong> (
                            {energy.age} anos, {ACTIVITY_LABELS[energy.activityLevel]}
                            {energy.activityAssumed ? ' — assumida, sem anamnese' : ''}) · objetivo{' '}
                            {GOAL_OPTIONS.find((option) => option.value === energy.goal)?.label.toLowerCase()}.
                        </>
                    )}
                    {!energy && student && (
                        <>
                            {' '}
                            Cadastre peso, altura e data de nascimento na{' '}
                            <Link href={`/personal/students/${student.id}`} className="font-medium text-[#F88022] hover:underline">
                                ficha do aluno
                            </Link>{' '}
                            para estimar o gasto energético.
                        </>
                    )}
                </p>
            </div>
        </section>
    );
}
