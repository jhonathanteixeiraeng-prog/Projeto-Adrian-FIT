'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Info, Loader2, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { personalLinks } from '@/lib/notifications';
import { StudentPicker, type StudentOption } from './student-picker';
import { addDaysYmd, diffDaysYmd, todayYmd } from './plan-dates';
import type { EditorMode, EditorState } from './editor-state';

type HeaderField = 'title' | 'description' | 'studentId' | 'startDate' | 'endDate';

interface PlanHeaderProps {
    mode: EditorMode;
    isNew: boolean;
    state: Pick<EditorState, HeaderField>;
    onField: (field: HeaderField, value: string) => void;
    studentLocked: boolean;
    studentName: string | null;
    students: StudentOption[] | undefined;
    studentsLoading: boolean;
    active: boolean;
    activating: boolean;
    onActivate: () => void;
    /** Messages keyed by title | student | startDate | endDate | days */
    issues: Partial<Record<string, string>>;
    stats: { days: number; exercises: number; sets: number };
    sourceNote: string | null;
    autoFocusStudent: boolean;
    titleRef: React.RefObject<HTMLInputElement>;
}

const DURATIONS = [30, 45, 60, 90];

/** Inline-labelled field ("Início | 25/09/2026") to keep the header to two short rows. */
function InlineField({ label, htmlFor, invalid, children, className }: { label: string; htmlFor?: string; invalid?: boolean; children: React.ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                'flex h-9 items-center overflow-hidden rounded-lg border bg-background focus-within:border-[#F88022] focus-within:ring-2 focus-within:ring-[#F88022]/25',
                invalid ? 'border-red-500' : 'border-border',
                className
            )}
        >
            <label htmlFor={htmlFor} className="shrink-0 border-r border-border px-2.5 text-xs font-medium text-muted-foreground">
                {label}
            </label>
            {children}
        </div>
    );
}

export function PlanHeader({
    mode,
    isNew,
    state,
    onField,
    studentLocked,
    studentName,
    students,
    studentsLoading,
    active,
    activating,
    onActivate,
    issues,
    stats,
    sourceNote,
    autoFocusStudent,
    titleRef,
}: PlanHeaderProps) {
    const duration = state.startDate && state.endDate ? diffDaysYmd(state.startDate, state.endDate) : null;
    const selectedStudent = students?.find((student) => student.id === state.studentId);
    const currentActivePlan = isNew ? selectedStudent?.workoutPlans?.[0] : undefined;
    const statsText = `${stats.days} ${stats.days === 1 ? 'treino' : 'treinos'} · ${stats.exercises} ${stats.exercises === 1 ? 'exercício' : 'exercícios'} · ${stats.sets} séries`;
    const bareInput = 'h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-foreground focus:outline-none';

    return (
        <section className="space-y-2 rounded-2xl border border-border bg-card px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <input
                    ref={titleRef}
                    id="editor-title"
                    aria-label={mode === 'template' ? 'Nome do modelo' : 'Título da ficha'}
                    value={state.title}
                    maxLength={120}
                    onChange={(event) => onField('title', event.target.value)}
                    placeholder={mode === 'template' ? 'Nome do modelo (ex.: Hipertrofia ABC — iniciante)' : 'Título da ficha (ex.: Hipertrofia — fase 1)'}
                    aria-invalid={Boolean(issues.title) || undefined}
                    title={issues.title ?? (mode === 'template' ? 'Nome do modelo' : 'Título da ficha')}
                    className={cn(
                        'h-9 min-w-[220px] flex-1 rounded-lg border bg-transparent px-2.5 text-base font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground hover:border-border focus:border-[#F88022] focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#F88022]/25',
                        issues.title ? 'border-red-500' : 'border-transparent'
                    )}
                />
                <span className="hidden text-xs text-muted-foreground xl:inline">{statsText}</span>
                {mode === 'plan' &&
                    (isNew ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            <Info className="h-3.5 w-3.5" /> Fica ativa ao salvar
                        </span>
                    ) : active ? (
                        <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                            title="É a ficha que o aluno vê no app"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ativa
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-2">
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">Inativa</span>
                            <button
                                type="button"
                                onClick={onActivate}
                                disabled={activating}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#F88022]/40 px-2.5 py-1 text-xs font-semibold text-[#F88022] hover:bg-[#F88022]/10 disabled:opacity-60"
                            >
                                {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                                Ativar esta ficha
                            </button>
                        </span>
                    ))}
            </div>

            {mode === 'template' ? (
                <InlineField label="Descrição" htmlFor="editor-description">
                    <input
                        id="editor-description"
                        value={state.description}
                        maxLength={500}
                        onChange={(event) => onField('description', event.target.value)}
                        placeholder="Objetivo, nível, observações para quem for usar (opcional)"
                        className={bareInput}
                    />
                </InlineField>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full min-w-[200px] sm:w-[220px]">
                        {studentLocked ? (
                            <InlineField label="Aluno">
                                {state.studentId ? (
                                    <Link
                                        href={personalLinks.student(state.studentId, 'workout')}
                                        className="min-h-0 truncate px-2.5 text-sm font-semibold text-foreground hover:text-[#F88022]"
                                        title="Abrir a ficha do aluno"
                                    >
                                        {studentName ?? 'Aluno'}
                                    </Link>
                                ) : (
                                    <span className="px-2.5 text-sm text-muted-foreground">—</span>
                                )}
                            </InlineField>
                        ) : (
                            <StudentPicker
                                id="editor-student"
                                students={students}
                                loading={studentsLoading}
                                value={state.studentId}
                                onChange={(studentId) => onField('studentId', studentId)}
                                invalid={Boolean(issues.student)}
                                autoFocus={autoFocusStudent}
                                placeholder="Aluno: buscar pelo nome…"
                            />
                        )}
                    </div>
                    <InlineField label="Início" htmlFor="editor-startDate" invalid={Boolean(issues.startDate)}>
                        <input
                            id="editor-startDate"
                            type="date"
                            value={state.startDate}
                            onChange={(event) => onField('startDate', event.target.value)}
                            aria-invalid={Boolean(issues.startDate) || undefined}
                            title={issues.startDate}
                            className={cn(bareInput, 'w-[128px] flex-none px-2')}
                        />
                    </InlineField>
                    <InlineField label="Término" htmlFor="editor-endDate" invalid={Boolean(issues.endDate)}>
                        <input
                            id="editor-endDate"
                            type="date"
                            value={state.endDate}
                            min={state.startDate || undefined}
                            onChange={(event) => onField('endDate', event.target.value)}
                            aria-invalid={Boolean(issues.endDate) || undefined}
                            title={issues.endDate}
                            className={cn(bareInput, 'w-[128px] flex-none px-2')}
                        />
                        <select
                            aria-label="Duração"
                            tabIndex={-1}
                            value={duration !== null && DURATIONS.includes(duration) ? String(duration) : ''}
                            onChange={(event) => {
                                const days = Number(event.target.value);
                                if (days) onField('endDate', addDaysYmd(state.startDate || todayYmd(), days));
                            }}
                            title="Duração: define o término a partir do início"
                            className="h-full border-l border-border bg-muted/40 pl-2 pr-1 text-xs text-muted-foreground focus:outline-none"
                        >
                            <option value="" disabled>
                                {duration !== null && duration >= 0 ? `${duration} dias` : 'Duração'}
                            </option>
                            {DURATIONS.map((days) => (
                                <option key={days} value={days}>
                                    {days} dias
                                </option>
                            ))}
                        </select>
                    </InlineField>
                </div>
            )}

            {(sourceNote || issues.student || issues.days) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {sourceNote && <span className="text-muted-foreground">{sourceNote}</span>}
                    {issues.student && <span className="text-red-500">{issues.student}</span>}
                    {issues.days && <span className="text-red-500">{issues.days}</span>}
                </div>
            )}
            <p className="text-xs text-muted-foreground xl:hidden">{statsText}</p>

            {currentActivePlan && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        {selectedStudent?.user.name} já tem a ficha ativa “{currentActivePlan.title}”. Ao salvar, esta nova ficha passa a ser a
                        ativa e a anterior fica inativa (continua no histórico).
                    </span>
                </p>
            )}
        </section>
    );
}
