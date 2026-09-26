'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardList, Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { cn, matchesSearch } from '@/lib/utils';
import { describeGroups } from '@/lib/workout-groups';
import { WEEKDAY_OPTIONS, type ApiPlan, type ApiPlanDay, type ApiTemplate } from './editor-state';
import { groupPositionLabel } from './group-ui';

interface PlanListItem {
    id: string;
    title: string;
    active: boolean;
    student?: { user?: { name?: string | null } | null } | null;
}

type Source = { kind: 'plan' | 'template'; id: string };

interface ImportDayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targetDayName: string;
    /** The plan being edited (not offered as a source). */
    excludePlanId?: string | null;
    onImport: (days: ApiPlanDay[], mode: 'append' | 'new-days') => void;
}

const weekdayLabel = (value: number) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.short ?? '';

/** "Supino · A1 Crucifixo · A2 Tríceps" (grouped exercises keep their group position). */
function exerciseSummary(day: ApiPlanDay): string {
    const groups = describeGroups(day.items.map((item) => ({ groupId: item.groupId, sets: item.sets })));
    return day.items
        .map((item, index) => {
            const name = item.exercise?.name ?? 'Exercício';
            const group = groups[index];
            return group ? `${groupPositionLabel(group)} ${name}` : name;
        })
        .join(' · ');
}

/** Copies the exercises of a day from another plan or template of this personal. */
export function ImportDayDialog({ open, onOpenChange, targetDayName, excludePlanId, onImport }: ImportDayDialogProps) {
    const [tab, setTab] = useState<'plans' | 'templates'>('plans');
    const [query, setQuery] = useState('');
    const [source, setSource] = useState<Source | null>(null);
    const [dayId, setDayId] = useState<string | null>(null);

    const plans = useApi<PlanListItem[]>(open ? '/api/workout-plans' : null);
    const templates = useApi<ApiTemplate[]>(open ? '/api/workout-templates' : null);
    const planDetail = useApi<ApiPlan>(open && source?.kind === 'plan' ? `/api/workout-plans/${source.id}` : null, {
        revalidateOnFocus: false,
    });

    useEffect(() => {
        if (open) {
            setQuery('');
            setSource(null);
            setDayId(null);
        }
    }, [open]);

    const planOptions = useMemo(
        () =>
            (plans.data ?? [])
                .filter((plan) => plan.id !== excludePlanId)
                .filter((plan) => matchesSearch(query, plan.title, plan.student?.user?.name))
                .sort((a, b) => Number(b.active) - Number(a.active)),
        [plans.data, excludePlanId, query]
    );
    const templateOptions = useMemo(
        () => (templates.data ?? []).filter((template) => matchesSearch(query, template.title, template.description)),
        [templates.data, query]
    );

    const sourceDays: ApiPlanDay[] | null =
        source?.kind === 'template'
            ? (templates.data?.find((template) => template.id === source.id)?.templateDays ?? null)
            : source?.kind === 'plan'
              ? (planDetail.data?.workoutDays ?? null)
              : null;
    const loadingDays = source?.kind === 'plan' && planDetail.isLoading;
    const selectedDay = sourceDays?.find((day) => day.id === dayId) ?? null;

    const choose = (next: Source) => {
        setSource(next);
        setDayId(null);
    };

    const finish = (days: ApiPlanDay[], mode: 'append' | 'new-days') => {
        onImport(days, mode);
        onOpenChange(false);
    };

    const listLoading = tab === 'plans' ? plans.isLoading : templates.isLoading;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[88dvh] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0">
                <DialogHeader className="border-b border-border px-5 py-4 text-left">
                    <DialogTitle className="text-base font-bold">Importar exercícios</DialogTitle>
                    <DialogDescription>
                        Escolha uma ficha ou modelo e o dia a copiar para <strong className="text-foreground">{targetDayName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 sm:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="flex min-h-0 flex-col border-b border-border sm:border-b-0 sm:border-r">
                        <div className="space-y-2 p-3">
                            <div className="flex rounded-lg bg-muted p-0.5">
                                {(['plans', 'templates'] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setTab(value)}
                                        className={cn(
                                            'flex-1 rounded-md px-2 py-1 text-xs font-semibold',
                                            tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        {value === 'plans' ? 'Fichas' : 'Modelos'}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    placeholder={tab === 'plans' ? 'Buscar ficha ou aluno…' : 'Buscar modelo…'}
                                    className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                                />
                            </div>
                        </div>
                        <div className="max-h-56 min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:max-h-none">
                            {listLoading ? (
                                <div className="space-y-1.5 p-1">
                                    {Array.from({ length: 5 }).map((_, index) => (
                                        <div key={index} className="skeleton-shimmer h-11" />
                                    ))}
                                </div>
                            ) : tab === 'plans' ? (
                                planOptions.length === 0 ? (
                                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhuma ficha encontrada.</p>
                                ) : (
                                    planOptions.map((plan) => (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            onClick={() => choose({ kind: 'plan', id: plan.id })}
                                            className={cn(
                                                'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted',
                                                source?.id === plan.id && 'bg-primary/10'
                                            )}
                                        >
                                            <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-medium text-foreground">{plan.title}</span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {plan.student?.user?.name ?? 'Aluno'} · {plan.active ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </span>
                                        </button>
                                    ))
                                )
                            ) : templateOptions.length === 0 ? (
                                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum modelo encontrado.</p>
                            ) : (
                                templateOptions.map((template) => (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => choose({ kind: 'template', id: template.id })}
                                        className={cn(
                                            'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted',
                                            source?.id === template.id && 'bg-primary/10'
                                        )}
                                    >
                                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-medium text-foreground">{template.title}</span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {template.templateDays.length} {template.templateDays.length === 1 ? 'dia' : 'dias'}
                                            </span>
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="flex min-h-[240px] flex-col">
                        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                            {!source ? (
                                <p className="px-2 py-10 text-center text-sm text-muted-foreground">Selecione uma ficha ou modelo à esquerda.</p>
                            ) : loadingDays ? (
                                <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando dias…
                                </p>
                            ) : !sourceDays?.length ? (
                                <p className="px-2 py-10 text-center text-sm text-muted-foreground">Esta ficha não tem dias de treino.</p>
                            ) : (
                                sourceDays.map((day) => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => setDayId(day.id)}
                                        onDoubleClick={() => finish([day], 'append')}
                                        className={cn(
                                            'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                                            dayId === day.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="truncate text-sm font-semibold text-foreground">{day.name}</span>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {weekdayLabel(day.dayOfWeek)} · {day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'}
                                            </span>
                                        </span>
                                        <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                                            {exerciseSummary(day) || 'Sem exercícios'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-3">
                            {sourceDays && sourceDays.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => finish(sourceDays, 'new-days')}
                                    className="mr-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    Importar todos os {sourceDays.length} dias
                                </button>
                            )}
                            <button
                                type="button"
                                disabled={!selectedDay}
                                onClick={() => selectedDay && finish([selectedDay], 'new-days')}
                                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                            >
                                Criar como novo dia
                            </button>
                            <button
                                type="button"
                                disabled={!selectedDay}
                                onClick={() => selectedDay && finish([selectedDay], 'append')}
                                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                Adicionar em {targetDayName}
                            </button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
