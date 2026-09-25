'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, Dumbbell, Pencil, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { cn } from '@/lib/utils';
import { describeGroups } from '@/lib/workout-groups';
import { formatLoad, formatRpe } from '@/lib/workout-load';
import { WEEKDAY_OPTIONS, type ApiPlanDay } from './editor-state';
import { groupChipLabel, groupPositionLabel, groupRestHint, groupTone } from './group-ui';

export interface TemplateSummary {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    templateDays: ApiPlanDay[];
}

interface TemplatePreviewDialogProps {
    template: TemplateSummary | null;
    onOpenChange: (open: boolean) => void;
    onAssign: (template: TemplateSummary) => void;
}

const weekday = (value: number) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? '';

/** Exercises of a day; supersets get a bracket, A1/A2 before the names and their rest after the round. */
function DayItems({ items }: { items: ApiPlanDay['items'] }) {
    const groups = describeGroups(items.map((item) => ({ groupId: item.groupId, sets: item.sets })));
    // Room for "após a volta" only on days with groups.
    const restWidth = groups.some(Boolean) ? 'w-20' : 'w-14';
    return (
        <ol className="divide-y divide-border/60">
            {items.map((item, itemIndex) => {
                const intensity = [formatLoad(item.load), formatRpe(item.rpe)].filter(Boolean).join(' · ');
                const group = groups[itemIndex];
                const tone = group ? groupTone(group) : null;
                return (
                    <li key={item.id} className="relative flex items-center gap-3 px-3 py-1.5 text-sm">
                        {group && tone && (
                            <span
                                aria-hidden
                                className={cn(
                                    'pointer-events-none absolute left-1 w-1 border-l-2',
                                    tone.border,
                                    group.isFirst ? 'top-2 rounded-tl border-t-2' : '-top-px',
                                    group.isLast ? 'bottom-2 rounded-bl border-b-2' : 'bottom-0'
                                )}
                            />
                        )}
                        <span className="w-5 text-right text-xs font-semibold text-muted-foreground">{itemIndex + 1}</span>
                        <span className="flex min-w-0 flex-1 items-baseline gap-1.5 font-medium text-foreground">
                            {group && tone && (
                                <span className={cn('shrink-0 rounded px-1 text-xs font-bold tabular-nums', tone.pill)}>
                                    {groupPositionLabel(group)}
                                </span>
                            )}
                            <span className="min-w-0 truncate">
                                {item.exercise?.name ?? 'Exercício'}
                                {item.exercise?.muscleGroup && (
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">{item.exercise.muscleGroup}</span>
                                )}
                            </span>
                            {group?.isFirst && tone && (
                                <span className={cn('shrink-0 whitespace-nowrap rounded-full border px-1.5 text-xs font-semibold', tone.chip)}>
                                    {groupChipLabel(group)}
                                </span>
                            )}
                        </span>
                        {/* "3 × 10-12 · 20 kg · RPE 8"; on phones carga/RPE go under séries × reps. */}
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">
                                {item.sets} × {item.reps}
                            </span>
                            {intensity && (
                                <span className="block whitespace-nowrap sm:inline">
                                    <span className="hidden sm:inline"> · </span>
                                    {intensity}
                                </span>
                            )}
                        </span>
                        {group && !group.isLast ? (
                            <span className={cn(restWidth, 'shrink-0 cursor-help text-right text-xs text-muted-foreground')} title={groupRestHint(group)}>
                                <span aria-hidden>—</span>
                                <span className="sr-only">{groupRestHint(group)}</span>
                            </span>
                        ) : (
                            <span className={cn(restWidth, 'shrink-0 text-right text-xs text-muted-foreground')}>
                                <span className="inline-flex items-center justify-end gap-1">
                                    <Clock className="h-3 w-3" />
                                    {item.rest}s
                                </span>
                                {group && <span className="block whitespace-nowrap">após a volta</span>}
                            </span>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

export function TemplatePreviewDialog({ template, onOpenChange, onAssign }: TemplatePreviewDialogProps) {
    return (
        <Dialog open={Boolean(template)} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[88dvh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0">
                <DialogHeader className="border-b border-border px-5 py-4 text-left">
                    <DialogTitle className="flex items-center gap-2 pr-6 text-base font-bold">
                        <Dumbbell className="h-5 w-5 shrink-0 text-[#F88022]" />
                        {template?.title}
                    </DialogTitle>
                    <DialogDescription>{template?.description || 'Estrutura completa do modelo de treino'}</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {template?.templateDays.length ? (
                        template.templateDays.map((day, index) => (
                            <div key={day.id} className="rounded-xl border border-border">
                                <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F88022]/15 text-xs font-bold text-[#F88022]">
                                            {String.fromCharCode(65 + index)}
                                        </span>
                                        {day.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {weekday(day.dayOfWeek)} · {day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'}
                                    </span>
                                </div>
                                {day.items.length ? (
                                    <DayItems items={day.items} />
                                ) : (
                                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum exercício neste dia.</p>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum dia configurado neste modelo.</p>
                    )}
                </div>
                {template && (
                    <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
                        <Link
                            href={`/personal/workouts/${template.id}?kind=template`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                            <Pencil className="h-4 w-4" /> Editar modelo
                        </Link>
                        <Link
                            href={`/personal/workouts/new?templateId=${template.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                            Usar modelo
                        </Link>
                        <button
                            type="button"
                            onClick={() => onAssign(template)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F88022] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#F88022]/90"
                        >
                            <UserPlus className="h-4 w-4" /> Atribuir a aluno
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
