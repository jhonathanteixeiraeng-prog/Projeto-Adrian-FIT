'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertCircle,
    BookmarkPlus,
    BookOpen,
    CalendarClock,
    CheckCircle2,
    ClipboardList,
    Copy,
    CopyPlus,
    Eye,
    Pencil,
    Plus,
    Power,
    PowerOff,
    Search,
    Trash2,
    UserPlus,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { Avatar, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useDialogs, useToast } from '@/components/ui';
import { cn, matchesSearch } from '@/lib/utils';
import { getStoredNotifyStudent, personalLinks } from '@/lib/notifications';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { isModalOpen, useHotkey } from '@/hooks/use-hotkey';
import { useUrlStateGroup } from '@/hooks/use-url-state';
import { usePageMeta } from '@/components/personal/page-meta';
import { ActionMenu, type ActionMenuEntry } from '@/components/personal/workout-editor/action-menu';
import { AssignTemplateDialog } from '@/components/personal/workout-editor/assign-template-dialog';
import { daysUntilPlanEnd, formatPlanDate } from '@/components/personal/workout-editor/plan-dates';
import type { StudentOption } from '@/components/personal/workout-editor/student-picker';
import { TemplatePreviewDialog, type TemplateSummary } from '@/components/personal/workout-editor/template-preview-dialog';

interface PlanListItem {
    id: string;
    studentId: string;
    title: string;
    startDate: string;
    endDate: string;
    active: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
    student?: { user?: { name?: string | null; avatar?: string | null } | null } | null;
    workoutDays?: { id: string; name: string; _count?: { items: number } }[];
    _count?: { workoutDays: number };
}

const PAGE_SIZE = 50;
const EXPIRING_DAYS = 7;

const STATUS_OPTIONS = [
    { value: 'active', label: 'Ativas' },
    { value: 'expiring', label: 'Vencendo' },
    { value: 'inactive', label: 'Inativas' },
    { value: 'all', label: 'Todas' },
];

const studentNameOf = (plan: PlanListItem) => plan.student?.user?.name || 'Aluno';

function isExpiring(plan: PlanListItem) {
    const days = daysUntilPlanEnd(plan.endDate);
    return plan.active && days !== null && days <= EXPIRING_DAYS;
}

function EndHint({ plan }: { plan: PlanListItem }) {
    if (!plan.active) return null;
    const days = daysUntilPlanEnd(plan.endDate);
    if (days === null || days > EXPIRING_DAYS) return null;
    const text = days < 0 ? `venceu há ${-days} ${days === -1 ? 'dia' : 'dias'}` : days === 0 ? 'vence hoje' : `vence em ${days} ${days === 1 ? 'dia' : 'dias'}`;
    return <span className={cn('text-xs font-medium', days < 0 ? 'text-red-500' : 'text-amber-600 dark:text-amber-400')}>{text}</span>;
}

function StatCard({
    label,
    value,
    icon: Icon,
    tone,
    onClick,
    active,
    title,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    onClick: () => void;
    active?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                'flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/50',
                active ? 'border-primary/60' : 'border-border'
            )}
        >
            <span>
                <span className="block text-xs font-medium text-muted-foreground">{label}</span>
                <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-foreground">{value}</span>
            </span>
            <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>
                <Icon className="h-4 w-4" />
            </span>
        </button>
    );
}

export default function WorkoutsPage() {
    usePageMeta({ title: 'Fichas de treino', breadcrumbs: [{ label: 'Fichas de treino' }] });
    const router = useRouter();
    const { toast } = useToast();
    const { confirm, prompt } = useDialogs();

    const [filters, setFilters] = useUrlStateGroup({ tab: 'plans', status: 'active', q: '', sort: 'recent' });
    const tab = filters.tab === 'library' ? 'library' : 'plans';
    const [query, setQuery] = useState(filters.q);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [highlight, setHighlight] = useState(-1);
    const [previewTemplate, setPreviewTemplate] = useState<TemplateSummary | null>(null);
    const [assignTemplate, setAssignTemplate] = useState<TemplateSummary | null>(null);
    const [noPlanOpen, setNoPlanOpen] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const plansApi = useApi<PlanListItem[]>('/api/workout-plans');
    const templatesApi = useApi<TemplateSummary[]>('/api/workout-templates');
    const studentsApi = useApi<StudentOption[]>('/api/students');

    useEffect(() => {
        if (query === filters.q) return;
        const id = window.setTimeout(() => setFilters({ q: query }), 300);
        return () => window.clearTimeout(id);
    }, [query, filters.q, setFilters]);

    const plans = useMemo(() => plansApi.data ?? [], [plansApi.data]);
    const templates = useMemo(() => templatesApi.data ?? [], [templatesApi.data]);

    const counts = useMemo(
        () => ({
            active: plans.filter((plan) => plan.active).length,
            expiring: plans.filter(isExpiring).length,
            inactive: plans.filter((plan) => !plan.active).length,
            all: plans.length,
        }),
        [plans]
    );

    const studentsWithoutPlan = useMemo(
        () =>
            (studentsApi.data ?? [])
                .filter((student) => (student.status ?? 'ACTIVE') === 'ACTIVE' && !student.workoutPlans?.length)
                .sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR')),
        [studentsApi.data]
    );

    const filteredPlans = useMemo(() => {
        const list = plans.filter((plan) => {
            if (filters.status === 'active' && !plan.active) return false;
            if (filters.status === 'inactive' && plan.active) return false;
            if (filters.status === 'expiring' && !isExpiring(plan)) return false;
            return matchesSearch(query, plan.title, studentNameOf(plan), ...(plan.workoutDays ?? []).map((day) => day.name));
        });
        switch (filters.sort) {
            case 'student':
                return list.sort(
                    (a, b) => studentNameOf(a).localeCompare(studentNameOf(b), 'pt-BR') || Number(b.active) - Number(a.active)
                );
            case 'title':
                return list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
            case 'end':
                return list.sort((a, b) => a.endDate.localeCompare(b.endDate));
            default:
                return list.sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
        }
    }, [plans, filters.status, filters.sort, query]);

    const filteredTemplates = useMemo(
        () => templates.filter((template) => matchesSearch(query, template.title, template.description)),
        [templates, query]
    );

    const visiblePlans = filteredPlans.slice(0, limit);

    useEffect(() => {
        setHighlight(-1);
        setLimit(PAGE_SIZE);
    }, [filters.status, filters.sort, query, tab]);

    useEffect(() => {
        if (highlight < 0) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight]);

    // ------------------------------------------------------------------ actions
    const moveHighlight = (delta: 1 | -1) => {
        const total = tab === 'plans' ? visiblePlans.length : 0;
        if (!total) return;
        setHighlight((current) => Math.max(0, Math.min(current + delta, total - 1)));
    };

    const openHighlighted = () => {
        const plan = visiblePlans[highlight];
        if (plan) router.push(`/personal/workouts/${plan.id}`);
    };

    useHotkey('/', () => {
        searchRef.current?.focus();
        searchRef.current?.select();
    });
    useHotkey(['arrowdown', 'arrowup'], (event) => moveHighlight(event.key === 'ArrowDown' ? 1 : -1), { enabled: tab === 'plans' });
    useHotkey(
        'enter',
        (event) => {
            const activeElement = document.activeElement;
            if (activeElement && activeElement !== document.body && activeElement.closest('button, a, [role="menu"]')) return;
            if (highlight < 0 || isModalOpen()) return;
            event.preventDefault();
            openHighlighted();
        },
        { enabled: tab === 'plans' && highlight >= 0, preventDefault: false }
    );

    const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (tab === 'plans' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        } else if (tab === 'plans' && event.key === 'Enter') {
            event.preventDefault();
            const plan = visiblePlans[Math.max(highlight, 0)];
            if (plan) router.push(`/personal/workouts/${plan.id}`);
        } else if (event.key === 'Escape') {
            if (query) {
                event.preventDefault();
                setQuery('');
            } else {
                searchRef.current?.blur();
            }
        }
    };

    const refreshAfterPlanChange = () => {
        void plansApi.mutate(undefined, { force: true });
        invalidateApi('/api/students');
    };

    const setPlanActive = async (plan: PlanListItem, value: boolean) => {
        const shouldNotify = getStoredNotifyStudent();
        const ok = await confirm(
            value
                ? {
                      title: `Ativar “${plan.title}”?`,
                      description: `Ela passa a ser a ficha que ${studentNameOf(plan)} vê no app. A ficha ativa atual do aluno será desativada (continua no histórico). ${shouldNotify ? 'O aluno será avisado no app.' : 'O aluno não será avisado.'}`,
                      confirmText: 'Ativar ficha',
                  }
                : {
                      title: `Desativar “${plan.title}”?`,
                      description: `${studentNameOf(plan)} ficará sem ficha ativa no app até você ativar ou criar outra.`,
                      confirmText: 'Desativar',
                      variant: 'danger',
                  }
        );
        if (!ok) return;
        void plansApi.mutate(
            (current) =>
                (current ?? []).map((item) =>
                    item.id === plan.id ? { ...item, active: value } : value && item.studentId === plan.studentId ? { ...item, active: false } : item
                ),
            { revalidate: false }
        );
        try {
            const response = await fetch(`/api/workout-plans/${plan.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: value, notifyStudent: value ? shouldNotify : false }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) throw new Error(result?.error || 'Tente novamente.');
            toast.success(value ? 'Ficha ativada' : 'Ficha desativada', `${plan.title} · ${studentNameOf(plan)}`);
        } catch (error) {
            toast.error(value ? 'Não foi possível ativar a ficha' : 'Não foi possível desativar a ficha', error instanceof Error ? error.message : undefined);
        } finally {
            refreshAfterPlanChange();
        }
    };

    const deletePlan = async (plan: PlanListItem) => {
        const ok = await confirm({
            title: `Excluir “${plan.title}”?`,
            description: `A ficha de ${studentNameOf(plan)} e o histórico de treinos concluídos dela serão apagados permanentemente. Para apenas tirar a ficha do aluno, use “Desativar”.`,
            confirmText: 'Excluir ficha',
            variant: 'danger',
        });
        if (!ok) return;
        void plansApi.mutate((current) => (current ?? []).filter((item) => item.id !== plan.id), { revalidate: false });
        try {
            const response = await fetch(`/api/workout-plans/${plan.id}`, { method: 'DELETE' });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) throw new Error(result?.error || 'Tente novamente.');
            toast.success('Ficha excluída', plan.title);
        } catch (error) {
            toast.error('Não foi possível excluir a ficha', error instanceof Error ? error.message : undefined);
        } finally {
            refreshAfterPlanChange();
        }
    };

    const savePlanAsTemplate = async (plan: PlanListItem) => {
        const name = await prompt({
            title: 'Salvar como modelo',
            description: 'Uma cópia desta ficha vai para a sua biblioteca de modelos.',
            label: 'Nome do modelo',
            defaultValue: `${plan.title} - Modelo`,
            confirmText: 'Salvar modelo',
        });
        if (!name) return;
        try {
            const response = await fetch('/api/workout-templates/from-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId: plan.id, title: name }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) throw new Error(result?.error || 'Tente novamente.');
            void templatesApi.mutate(undefined, { force: true });
            toast.success('Modelo salvo na biblioteca', name);
        } catch (error) {
            toast.error('Não foi possível salvar o modelo', error instanceof Error ? error.message : undefined);
        }
    };

    const duplicateTemplate = async (template: TemplateSummary) => {
        try {
            const response = await fetch('/api/workout-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `${template.title} (cópia)`,
                    description: template.description ?? '',
                    templateDays: template.templateDays.map((day) => ({
                        name: day.name,
                        dayOfWeek: day.dayOfWeek,
                        items: day.items.map((item) => ({
                            exerciseId: item.exerciseId,
                            sets: item.sets,
                            reps: item.reps,
                            rest: item.rest,
                            restBySet: item.restBySet ?? null,
                            load: item.load ?? null,
                            rpe: item.rpe ?? null,
                            groupId: item.groupId ?? null,
                            notes: item.notes ?? '',
                        })),
                    })),
                }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) throw new Error(result?.error || 'Tente novamente.');
            void templatesApi.mutate(undefined, { force: true });
            toast.success('Modelo duplicado', `${template.title} (cópia)`);
        } catch (error) {
            toast.error('Não foi possível duplicar o modelo', error instanceof Error ? error.message : undefined);
        }
    };

    const deleteTemplate = async (template: TemplateSummary) => {
        const ok = await confirm({
            title: `Excluir o modelo “${template.title}”?`,
            description: 'Ele sai da sua biblioteca. Fichas já criadas a partir dele não são afetadas.',
            confirmText: 'Excluir modelo',
            variant: 'danger',
        });
        if (!ok) return;
        void templatesApi.mutate((current) => (current ?? []).filter((item) => item.id !== template.id), { revalidate: false });
        try {
            const response = await fetch(`/api/workout-templates/${template.id}`, { method: 'DELETE' });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) throw new Error(result?.error || 'Tente novamente.');
            toast.success('Modelo excluído', template.title);
        } catch (error) {
            toast.error('Não foi possível excluir o modelo', error instanceof Error ? error.message : undefined);
            void templatesApi.mutate(undefined, { force: true });
        }
    };

    const planMenu = (plan: PlanListItem): ActionMenuEntry[] => [
        { label: 'Editar ficha', icon: Pencil, href: `/personal/workouts/${plan.id}` },
        { label: 'Abrir aluno', icon: UserRound, href: personalLinks.student(plan.studentId, 'workout') },
        { type: 'separator' },
        { label: 'Duplicar para aluno…', icon: Copy, href: `/personal/workouts/new?fromPlanId=${plan.id}` },
        { label: 'Salvar como modelo', icon: BookmarkPlus, onSelect: () => void savePlanAsTemplate(plan) },
        plan.active
            ? { label: 'Desativar', icon: PowerOff, onSelect: () => void setPlanActive(plan, false) }
            : { label: 'Ativar ficha', icon: Power, onSelect: () => void setPlanActive(plan, true) },
        { type: 'separator' },
        { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => void deletePlan(plan) },
    ];

    const templateMenu = (template: TemplateSummary): ActionMenuEntry[] => [
        { label: 'Visualizar', icon: Eye, onSelect: () => setPreviewTemplate(template) },
        { label: 'Editar modelo', icon: Pencil, href: `/personal/workouts/${template.id}?kind=template` },
        { label: 'Duplicar modelo', icon: CopyPlus, onSelect: () => void duplicateTemplate(template) },
        { type: 'separator' },
        { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => void deleteTemplate(template) },
    ];

    const tabButton = (value: 'plans' | 'library', label: string, count: number | null, Icon: React.ComponentType<{ className?: string }>) => (
        <button
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setFilters({ tab: value })}
            className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                tab === value ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
        >
            <Icon className="h-4 w-4" />
            {label}
            {count !== null && (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', tab === value ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                    {count}
                </span>
            )}
            {tab === value && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
        </button>
    );

    const plansLoading = plansApi.isLoading;
    const templatesLoading = templatesApi.isLoading;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fichas de treino</h1>
                    <p className="text-sm text-muted-foreground">Fichas dos alunos e modelos reutilizáveis</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/personal/workouts/new?kind=template"
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                        <BookOpen className="h-4 w-4" /> Novo modelo
                    </Link>
                    <Link
                        href="/personal/workouts/new"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Nova ficha
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                    label="Fichas ativas"
                    value={plansLoading ? '—' : counts.active}
                    icon={CheckCircle2}
                    tone="bg-muted text-muted-foreground"
                    active={tab === 'plans' && filters.status === 'active'}
                    onClick={() => setFilters({ tab: 'plans', status: 'active' })}
                />
                <StatCard
                    label={`Vencem em ${EXPIRING_DAYS} dias`}
                    value={plansLoading ? '—' : counts.expiring}
                    icon={CalendarClock}
                    tone={counts.expiring > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}
                    active={tab === 'plans' && filters.status === 'expiring'}
                    onClick={() => setFilters({ tab: 'plans', status: 'expiring', sort: 'end' })}
                    title="Fichas ativas que terminam nos próximos dias ou já venceram"
                />
                <StatCard
                    label="Alunos sem ficha"
                    value={studentsApi.isLoading ? '—' : studentsWithoutPlan.length}
                    icon={Users}
                    tone={studentsWithoutPlan.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}
                    onClick={() => setNoPlanOpen(true)}
                    title="Alunos ativos sem ficha de treino ativa"
                />
                <StatCard
                    label="Modelos"
                    value={templatesLoading ? '—' : templates.length}
                    icon={BookOpen}
                    tone="bg-muted text-muted-foreground"
                    active={tab === 'library'}
                    onClick={() => setFilters({ tab: 'library' })}
                />
            </div>

            <div className="flex items-center gap-1 border-b border-border" role="tablist">
                {tabButton('plans', 'Fichas', plansLoading ? null : counts.all, ClipboardList)}
                {tabButton('library', 'Modelos', templatesLoading ? null : templates.length, BookOpen)}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder={tab === 'plans' ? 'Buscar por aluno, ficha ou treino' : 'Buscar modelo'}
                        aria-label="Buscar"
                        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    {query ? (
                        <button
                            type="button"
                            aria-label="Limpar busca"
                            onClick={() => setQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-xs text-muted-foreground">
                            /
                        </kbd>
                    )}
                </div>
                {tab === 'plans' && (
                    <>
                        <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Status">
                            {STATUS_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setFilters({ status: option.value })}
                                    className={cn(
                                        'rounded-md px-2.5 py-1 text-sm font-medium',
                                        filters.status === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {option.label}
                                    {!plansLoading && (
                                        <span className="ml-1 text-xs text-muted-foreground">{counts[option.value as keyof typeof counts]}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <select
                            aria-label="Ordenar"
                            value={filters.sort}
                            onChange={(event) => setFilters({ sort: event.target.value })}
                            className="h-9 rounded-lg border border-border bg-card px-2.5 text-sm text-muted-foreground focus:border-primary focus:outline-none"
                        >
                            <option value="recent">Atualizadas recentemente</option>
                            <option value="student">Aluno (A–Z)</option>
                            <option value="title">Título (A–Z)</option>
                            <option value="end">Término mais próximo</option>
                        </select>
                    </>
                )}
            </div>

            {tab === 'plans' ? (
                plansLoading ? (
                    <div className="space-y-2" aria-busy="true">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div key={index} className="skeleton-shimmer h-14" />
                        ))}
                    </div>
                ) : plansApi.error && !plansApi.data ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                        <p className="text-sm text-muted-foreground">Não foi possível carregar as fichas. {plansApi.error.message}</p>
                        <button type="button" onClick={() => void plansApi.mutate()} className="text-sm font-semibold text-primary hover:underline">
                            Tentar novamente
                        </button>
                    </div>
                ) : filteredPlans.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                        <ClipboardList className="h-8 w-8 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                            {plans.length === 0 ? 'Nenhuma ficha criada ainda' : 'Nenhuma ficha encontrada'}
                        </p>
                        <p className="max-w-md text-sm text-muted-foreground">
                            {plans.length === 0
                                ? 'Crie a primeira ficha do zero ou a partir de um modelo da biblioteca.'
                                : query
                                  ? 'Nenhuma ficha corresponde à busca.'
                                  : 'Nenhuma ficha com este status.'}
                        </p>
                        <div className="mt-2 flex gap-2">
                            {plans.length > 0 && (query || filters.status !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        setFilters({ q: '', status: 'all' });
                                    }}
                                    className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                                >
                                    Ver todas as fichas
                                </button>
                            )}
                            <Link
                                href="/personal/workouts/new"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                            >
                                <Plus className="h-4 w-4" /> Nova ficha
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_90px_80px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                            <span>Ficha</span>
                            <span>Aluno</span>
                            <span>Período</span>
                            <span>Treinos</span>
                            <span>Status</span>
                            <span />
                        </div>
                        <div ref={listRef} className="divide-y divide-border/70">
                            {visiblePlans.map((plan, index) => {
                                const dayNames = plan.workoutDays?.map((day) => day.name) ?? [];
                                const exerciseCount = plan.workoutDays?.reduce((sum, day) => sum + (day._count?.items ?? 0), 0) ?? 0;
                                return (
                                    <div
                                        key={plan.id}
                                        data-index={index}
                                        onMouseMove={() => highlight !== index && setHighlight(index)}
                                        className={cn(
                                            'relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_90px_80px]',
                                            index === highlight ? 'bg-muted/70' : 'hover:bg-muted/40'
                                        )}
                                    >
                                        <div className="min-w-0">
                                            <Link
                                                href={`/personal/workouts/${plan.id}`}
                                                className="block truncate text-sm font-semibold text-foreground after:absolute after:inset-0 hover:text-primary"
                                            >
                                                {plan.title}
                                            </Link>
                                            <span className="text-xs text-muted-foreground">
                                                v{plan.version} · atualizada {formatPlanDate(plan.updatedAt, { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="relative z-10 col-start-2 row-start-1 flex justify-end md:hidden">
                                            <ActionMenu entries={planMenu(plan)} label={`Ações de ${plan.title}`} />
                                        </div>
                                        <Link
                                            href={personalLinks.student(plan.studentId, 'workout')}
                                            className="relative z-10 flex min-w-0 items-center gap-2 justify-self-start text-sm text-foreground hover:text-primary"
                                        >
                                            <Avatar name={studentNameOf(plan)} src={plan.student?.user?.avatar ?? undefined} size="sm" />
                                            <span className="truncate">{studentNameOf(plan)}</span>
                                        </Link>
                                        <div className="min-w-0 text-sm">
                                            <span className="block text-foreground">
                                                {formatPlanDate(plan.startDate, { day: '2-digit', month: '2-digit', year: '2-digit' })} →{' '}
                                                {formatPlanDate(plan.endDate, { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                            </span>
                                            <EndHint plan={plan} />
                                        </div>
                                        <div className="min-w-0 text-sm text-muted-foreground">
                                            <span className="block truncate" title={dayNames.join(' · ')}>
                                                {dayNames.length ? dayNames.join(' · ') : 'Sem treinos'}
                                            </span>
                                            <span className="text-xs">
                                                {plan._count?.workoutDays ?? dayNames.length} {(plan._count?.workoutDays ?? dayNames.length) === 1 ? 'dia' : 'dias'} ·{' '}
                                                {exerciseCount} {exerciseCount === 1 ? 'exercício' : 'exercícios'}
                                            </span>
                                        </div>
                                        <span>
                                            {plan.active ? (
                                                <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                    Ativa
                                                </span>
                                            ) : (
                                                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                                                    Inativa
                                                </span>
                                            )}
                                        </span>
                                        <div className="relative z-10 hidden items-center justify-end gap-0.5 md:flex">
                                            <Link
                                                href={`/personal/workouts/${plan.id}`}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                                aria-label={`Editar ${plan.title}`}
                                                title="Editar"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Link>
                                            <ActionMenu entries={planMenu(plan)} label={`Ações de ${plan.title}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {filteredPlans.length > visiblePlans.length && (
                            <div className="border-t border-border p-3 text-center">
                                <button
                                    type="button"
                                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10"
                                >
                                    Mostrar mais ({filteredPlans.length - visiblePlans.length} restantes)
                                </button>
                            </div>
                        )}
                    </div>
                )
            ) : templatesLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="skeleton-shimmer h-40 rounded-2xl" />
                    ))}
                </div>
            ) : templatesApi.error && !templatesApi.data ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    <p className="text-sm text-muted-foreground">Não foi possível carregar os modelos. {templatesApi.error.message}</p>
                    <button type="button" onClick={() => void templatesApi.mutate()} className="text-sm font-semibold text-primary hover:underline">
                        Tentar novamente
                    </button>
                </div>
            ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                    <p className="font-semibold text-foreground">{templates.length === 0 ? 'Nenhum modelo na biblioteca' : 'Nenhum modelo encontrado'}</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        {templates.length === 0
                            ? 'Crie um modelo do zero ou use “Salvar como modelo” em qualquer ficha para reaproveitá-la com outros alunos.'
                            : 'Nenhum modelo corresponde à busca.'}
                    </p>
                    <Link
                        href="/personal/workouts/new?kind=template"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
                    >
                        <Plus className="h-4 w-4" /> Novo modelo
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredTemplates.map((template) => {
                        const exerciseCount = template.templateDays.reduce((sum, day) => sum + day.items.length, 0);
                        return (
                            <div key={template.id} className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                                <div className="flex items-start justify-between gap-2">
                                    <button type="button" onClick={() => setPreviewTemplate(template)} className="min-w-0 text-left">
                                        <h3 className="truncate text-sm font-semibold text-foreground hover:text-primary">{template.title}</h3>
                                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                            {template.description || 'Modelo para prescrição rápida.'}
                                        </p>
                                    </button>
                                    <ActionMenu entries={templateMenu(template)} label={`Ações do modelo ${template.title}`} />
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {template.templateDays.slice(0, 6).map((day) => (
                                        <span key={day.id} className="max-w-[160px] truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {day.name}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {template.templateDays.length} {template.templateDays.length === 1 ? 'dia' : 'dias'} · {exerciseCount}{' '}
                                    {exerciseCount === 1 ? 'exercício' : 'exercícios'} · criado em {formatPlanDate(template.createdAt)}
                                </p>
                                <div className="mt-auto flex gap-2 pt-3">
                                    <Link
                                        href={`/personal/workouts/new?templateId=${template.id}`}
                                        className="flex-1 rounded-lg border border-border px-3 py-1.5 text-center text-sm font-semibold text-foreground hover:bg-muted"
                                        title="Abrir no editor para ajustar antes de salvar"
                                    >
                                        Usar modelo
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setAssignTemplate(template)}
                                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                                    >
                                        <UserPlus className="h-4 w-4" /> Atribuir
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {tab === 'plans' && (
                <p className="hidden text-xs text-muted-foreground lg:block">Atalhos: / busca · ↑↓ navega · Enter abre a ficha</p>
            )}

            <TemplatePreviewDialog
                template={previewTemplate}
                onOpenChange={(open) => !open && setPreviewTemplate(null)}
                onAssign={(template) => {
                    setPreviewTemplate(null);
                    setAssignTemplate(template);
                }}
            />
            <AssignTemplateDialog template={assignTemplate} onOpenChange={(open) => !open && setAssignTemplate(null)} />

            <Dialog open={noPlanOpen} onOpenChange={setNoPlanOpen}>
                <DialogContent className="flex max-h-[80dvh] max-w-md flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0">
                    <DialogHeader className="border-b border-border px-5 py-4 text-left">
                        <DialogTitle className="text-base font-bold">Alunos sem ficha ativa</DialogTitle>
                        <DialogDescription>Alunos ativos que não têm um treino no app.</DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        {studentsWithoutPlan.length === 0 ? (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Todos os alunos ativos têm uma ficha ativa. 🎉</p>
                        ) : (
                            studentsWithoutPlan.map((student) => (
                                <div key={student.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60">
                                    <Avatar name={student.user.name} src={student.user.avatar ?? undefined} size="sm" />
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{student.user.name}</span>
                                    <Link
                                        href={`/personal/students/${student.id}/workout`}
                                        onClick={() => setNoPlanOpen(false)}
                                        className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                                    >
                                        Criar ficha
                                    </Link>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
