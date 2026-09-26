'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    BookOpen,
    CheckCircle2,
    Copy,
    Eye,
    FilePlus2,
    Flame,
    MoreVertical,
    Pencil,
    Plus,
    Power,
    RefreshCw,
    Search,
    Trash2,
    UserPlus,
    UserRound,
    Utensils,
    BookmarkPlus,
} from 'lucide-react';
import { Avatar, useDialogs, useToast } from '@/components/ui';
import { usePageMeta } from '@/components/personal/page-meta';
import { AssignTemplateDialog, type AssignableTemplate } from '@/components/personal/diet-editor/assign-template-dialog';
import { DropdownMenu, type MenuEntry } from '@/components/personal/diet-editor/menu';
import { dateInputFromDate, dateInputFromIso, formatDateBR } from '@/components/personal/diet-editor/model';
import { TemplatePreviewDialog, type TemplatePreview } from '@/components/personal/diet-editor/template-preview-dialog';
import { formatKcal } from '@/components/personal/diet-editor/units';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { useHotkey } from '@/hooks/use-hotkey';
import { useUrlStateGroup } from '@/hooks/use-url-state';
import { cn, matchesSearch } from '@/lib/utils';
import { getStoredNotifyStudent } from '@/lib/notifications';

interface PlanRow {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    active: boolean;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
    studentId: string;
    student: {
        id: string;
        user: { name: string; email?: string | null; avatar?: string | null };
    };
    meals: Array<{ id: string }>;
    mealCount?: number;
}

type TemplateRow = TemplatePreview & { createdAt: string; updatedAt?: string };

type StatusFilter = 'active' | 'inactive' | 'all';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
    { value: 'all', label: 'Todos' },
];

async function sendJson(url: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.success === false) throw new Error((data && (data.error || data.message)) || `Erro ${response.status}`);
    return data;
}

function daysUntil(dateIso: string | null) {
    const input = dateInputFromIso(dateIso);
    if (!input) return null;
    const today = new Date(`${dateInputFromDate(new Date())}T00:00:00`);
    const end = new Date(`${input}T00:00:00`);
    return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; tone: string }) {
    return (
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{value}</p>
            </div>
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>
                <Icon className="h-4 w-4" />
            </div>
        </div>
    );
}

function RowsSkeleton() {
    return (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card" aria-busy="true" aria-label="Carregando">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-72 animate-pulse rounded bg-muted" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; action?: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Icon className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
            {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
        </div>
    );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <span>{message}</span>
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
            </button>
        </div>
    );
}

const menuButtonClass = 'rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
const rowLinkClass =
    'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card';

export default function DietsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { confirm, prompt } = useDialogs();
    const [filters, setFilters] = useUrlStateGroup({ tab: 'plans', status: 'active', q: '' });
    const tab = filters.tab === 'templates' ? 'templates' : 'plans';
    const status: StatusFilter = (['active', 'inactive', 'all'] as const).includes(filters.status as StatusFilter)
        ? (filters.status as StatusFilter)
        : 'active';

    const [search, setSearch] = useState(filters.q);
    const lastPushedQuery = useRef(filters.q);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [assignTemplate, setAssignTemplate] = useState<AssignableTemplate | null>(null);
    const [previewTemplate, setPreviewTemplate] = useState<TemplateRow | null>(null);

    const plansApi = useApi<PlanRow[]>('/api/diets');
    const templatesApi = useApi<TemplateRow[]>('/api/diet-templates');

    usePageMeta({ title: 'Planos de dieta', breadcrumbs: [{ label: 'Planos de dieta' }] });

    // Busca digitada fica na URL (com atraso, para não navegar a cada tecla).
    useEffect(() => {
        if (search === lastPushedQuery.current) return;
        const timer = window.setTimeout(() => {
            lastPushedQuery.current = search;
            setFilters({ q: search });
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search, setFilters]);

    useEffect(() => {
        if (filters.q !== lastPushedQuery.current) {
            lastPushedQuery.current = filters.q;
            setSearch(filters.q);
        }
    }, [filters.q]);

    // Links antigos usavam /personal/diets#templates.
    useEffect(() => {
        if (window.location.hash === '#templates') setFilters({ tab: 'templates' });
    }, [setFilters]);

    const plans = useMemo(() => plansApi.data ?? [], [plansApi.data]);
    const templates = useMemo(() => templatesApi.data ?? [], [templatesApi.data]);

    const counts = useMemo(() => {
        const active = plans.filter((plan) => plan.active);
        const activeWithCalories = active.filter((plan) => (plan.calories ?? 0) > 0);
        return {
            all: plans.length,
            active: active.length,
            inactive: plans.length - active.length,
            averageCalories: activeWithCalories.length
                ? Math.round(activeWithCalories.reduce((total, plan) => total + (plan.calories ?? 0), 0) / activeWithCalories.length)
                : 0,
            expiring: active.filter((plan) => {
                const days = daysUntil(plan.endDate);
                return days !== null && days <= 7;
            }).length,
        };
    }, [plans]);

    const visiblePlans = useMemo(
        () =>
            plans.filter(
                (plan) =>
                    (status === 'all' || (status === 'active' ? plan.active : !plan.active)) &&
                    matchesSearch(search, plan.title, plan.student?.user?.name, plan.student?.user?.email)
            ),
        [plans, status, search]
    );
    const visibleTemplates = useMemo(() => templates.filter((template) => matchesSearch(search, template.title)), [templates, search]);

    // ------------------------------------------------------------------ teclado

    useHotkey('/', () => {
        searchRef.current?.focus();
        searchRef.current?.select();
    });

    const focusRow = (delta: number) => {
        const links = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-row-link]') ?? []);
        if (links.length === 0) return;
        const index = links.indexOf(document.activeElement as HTMLElement);
        if (index === 0 && delta < 0) {
            searchRef.current?.focus();
            return;
        }
        const next = index < 0 ? (delta > 0 ? 0 : links.length - 1) : Math.min(Math.max(index + delta, 0), links.length - 1);
        links[next]?.focus();
    };

    useHotkey('arrowdown', () => focusRow(1));
    useHotkey('arrowup', () => focusRow(-1));

    const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusRow(1);
        } else if (event.key === 'Enter') {
            const first = listRef.current?.querySelector<HTMLAnchorElement>('[data-row-link]');
            if (first) {
                event.preventDefault();
                router.push(first.getAttribute('href') || '/personal/diets');
            }
        } else if (event.key === 'Escape' && search) {
            event.preventDefault();
            setSearch('');
        }
    };

    // ------------------------------------------------------------------ ações de planos

    const togglePlanActive = async (plan: PlanRow) => {
        const next = !plan.active;
        let shouldNotify = false;
        if (next) {
            shouldNotify = getStoredNotifyStudent();
            const studentName = plan.student?.user?.name ?? 'o aluno';
            const ok = await confirm({
                title: `Ativar “${plan.title}”?`,
                description: `Ela passa a ser a dieta que ${studentName} vê no app. A dieta ativa atual do aluno será desativada (continua no histórico). ${shouldNotify ? 'O aluno será avisado no app.' : 'O aluno não será avisado.'}`,
                confirmText: 'Ativar dieta',
            });
            if (!ok) return;
        }
        try {
            await sendJson(`/api/diets/${plan.id}`, 'PUT', { active: next, notifyStudent: next ? shouldNotify : false });
            plansApi.mutate(
                (list) =>
                    list?.map((item) =>
                        item.id === plan.id ? { ...item, active: next } : next && item.studentId === plan.studentId ? { ...item, active: false } : item
                    ),
                { revalidate: false }
            );
            invalidateApi('/api/students');
            toast.success(
                next ? 'Plano ativado' : 'Plano desativado',
                next ? `${plan.student?.user?.name ?? 'O aluno'} passa a ver esta dieta no app.` : 'Não aparece mais no app do aluno.'
            );
        } catch (error) {
            toast.error('Não foi possível alterar o status', error instanceof Error ? error.message : undefined);
        }
    };

    const savePlanAsTemplate = async (plan: PlanRow) => {
        const name = await prompt({
            title: 'Salvar como modelo',
            description: 'Copia as refeições salvas deste plano para a biblioteca de modelos.',
            label: 'Nome do modelo',
            defaultValue: `${plan.title} - Modelo`,
            confirmText: 'Criar modelo',
        });
        if (!name) return;
        try {
            await sendJson('/api/diet-templates/from-plan', 'POST', { planId: plan.id, title: name });
            templatesApi.mutate(undefined, { force: true });
            toast.success('Modelo criado', `“${name}” está na biblioteca de modelos.`);
        } catch (error) {
            toast.error('Não foi possível criar o modelo', error instanceof Error ? error.message : undefined);
        }
    };

    const deletePlan = async (plan: PlanRow) => {
        const ok = await confirm({
            title: `Excluir “${plan.title}”?`,
            description: `${plan.student?.user?.name ?? 'O aluno'} deixa de ver esta dieta no app. Esta ação não pode ser desfeita.`,
            confirmText: 'Excluir plano',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await sendJson(`/api/diets/${plan.id}`, 'DELETE');
            plansApi.mutate((list) => list?.filter((item) => item.id !== plan.id), { revalidate: false });
            invalidateApi('/api/students');
            toast.success('Plano excluído');
        } catch (error) {
            toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
        }
    };

    // ------------------------------------------------------------------ ações de modelos

    const duplicateTemplate = async (template: TemplateRow) => {
        try {
            await sendJson('/api/diet-templates', 'POST', {
                title: `${template.title} (cópia)`,
                calories: template.calories,
                protein: template.protein,
                carbs: template.carbs,
                fat: template.fat,
                meals: template.meals.map((meal) => ({ name: meal.name, time: meal.time, notes: meal.notes, items: meal.items ?? [] })),
            });
            templatesApi.mutate(undefined, { force: true });
            toast.success('Modelo duplicado', `“${template.title} (cópia)” foi criado.`);
        } catch (error) {
            toast.error('Não foi possível duplicar', error instanceof Error ? error.message : undefined);
        }
    };

    const deleteTemplate = async (template: TemplateRow) => {
        const ok = await confirm({
            title: `Excluir o modelo “${template.title}”?`,
            description: 'Planos já criados a partir dele não são afetados.',
            confirmText: 'Excluir modelo',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            await sendJson(`/api/diet-templates/${template.id}`, 'DELETE');
            templatesApi.mutate((list) => list?.filter((item) => item.id !== template.id), { revalidate: false });
            toast.success('Modelo excluído');
        } catch (error) {
            toast.error('Não foi possível excluir', error instanceof Error ? error.message : undefined);
        }
    };

    // ------------------------------------------------------------------ render

    const planMenu = (plan: PlanRow): MenuEntry[] => [
        { key: 'edit', label: 'Editar', icon: Pencil, href: `/personal/diets/${plan.id}` },
        { key: 'duplicate', label: 'Duplicar para aluno…', icon: Copy, href: `/personal/diets/new?fromPlanId=${plan.id}` },
        { key: 'template', label: 'Salvar como modelo…', icon: BookmarkPlus, onSelect: () => void savePlanAsTemplate(plan) },
        { key: 'toggle', label: plan.active ? 'Desativar' : 'Ativar', icon: Power, onSelect: () => void togglePlanActive(plan) },
        { key: 'profile', label: 'Ficha do aluno', icon: UserRound, href: `/personal/students/${plan.student?.id}?tab=diet` },
        { type: 'separator', key: 'sep' },
        { key: 'delete', label: 'Excluir', icon: Trash2, danger: true, onSelect: () => void deletePlan(plan) },
    ];

    const templateMenu = (template: TemplateRow): MenuEntry[] => [
        { key: 'preview', label: 'Visualizar', icon: Eye, onSelect: () => setPreviewTemplate(template) },
        { key: 'edit', label: 'Editar modelo', icon: Pencil, href: `/personal/diets/templates/${template.id}` },
        { key: 'use', label: 'Usar modelo (novo plano)', icon: FilePlus2, href: `/personal/diets/new?templateId=${template.id}` },
        { key: 'assign', label: 'Atribuir a aluno…', icon: UserPlus, onSelect: () => setAssignTemplate(template) },
        { key: 'duplicate', label: 'Duplicar', icon: Copy, onSelect: () => void duplicateTemplate(template) },
        { type: 'separator', key: 'sep' },
        { key: 'delete', label: 'Excluir', icon: Trash2, danger: true, onSelect: () => void deleteTemplate(template) },
    ];

    const tabButton = (value: 'plans' | 'templates', label: string, count: number | undefined, Icon: React.ComponentType<{ className?: string }>) => (
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
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold tabular-nums', tab === value ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                {count ?? '–'}
            </span>
            {tab === value && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden />}
        </button>
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Planos de dieta</h1>
                    <p className="text-sm text-muted-foreground">Prescrições dos alunos e biblioteca de modelos reutilizáveis.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/personal/diets/templates/new"
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                        <BookOpen className="h-4 w-4" />
                        Novo modelo
                    </Link>
                    <Link
                        href="/personal/diets/new"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" />
                        Nova dieta
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Dietas ativas" value={plansApi.isLoading ? '–' : counts.active} icon={CheckCircle2} tone="bg-muted text-muted-foreground" />
                <StatCard
                    label="Vencem em 7 dias"
                    value={plansApi.isLoading ? '–' : counts.expiring}
                    icon={RefreshCw}
                    tone={counts.expiring > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}
                />
                <StatCard
                    label="Média das ativas"
                    value={plansApi.isLoading ? '–' : counts.averageCalories ? `${formatKcal(counts.averageCalories)} kcal` : '–'}
                    icon={Flame}
                    tone="bg-muted text-muted-foreground"
                />
                <StatCard label="Modelos" value={templatesApi.isLoading ? '–' : templates.length} icon={BookOpen} tone="bg-muted text-muted-foreground" />
            </div>

            <div role="tablist" aria-label="Seções" className="flex items-center gap-1 border-b border-border">
                {tabButton('plans', 'Dietas dos alunos', plansApi.isLoading ? undefined : counts.all, Utensils)}
                {tabButton('templates', 'Biblioteca de modelos', templatesApi.isLoading ? undefined : templates.length, BookOpen)}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder={tab === 'plans' ? 'Buscar por aluno ou título da dieta…' : 'Buscar modelos…'}
                        aria-label="Buscar"
                        className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                        /
                    </kbd>
                </div>
                {tab === 'plans' && (
                    <div role="radiogroup" aria-label="Status" className="flex gap-1 rounded-xl border border-border bg-muted/60 p-1">
                        {STATUS_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={status === option.value}
                                onClick={() => setFilters({ status: option.value })}
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                    status === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {option.label}
                                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                                    {plansApi.isLoading ? '' : counts[option.value]}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div ref={listRef}>
                {tab === 'plans' ? (
                    plansApi.error && !plansApi.data ? (
                        <LoadError message={plansApi.error.message} onRetry={() => void plansApi.mutate()} />
                    ) : plansApi.isLoading ? (
                        <RowsSkeleton />
                    ) : plans.length === 0 ? (
                        <EmptyState
                            icon={Utensils}
                            title="Nenhum plano alimentar ainda"
                            description="Crie a primeira dieta de um aluno do zero, a partir de um modelo ou com um rascunho gerado."
                            action={
                                <Link href="/personal/diets/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                    <Plus className="h-4 w-4" />
                                    Nova dieta
                                </Link>
                            }
                        />
                    ) : visiblePlans.length === 0 ? (
                        <EmptyState
                            icon={Search}
                            title="Nenhuma dieta encontrada"
                            description={search ? `Nada corresponde a “${search}” em ${STATUS_OPTIONS.find((o) => o.value === status)?.label.toLowerCase()}.` : `Não há dietas ${status === 'active' ? 'ativas' : 'inativas'}.`}
                            action={
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        setFilters({ q: '', status: 'all' });
                                    }}
                                    className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                                >
                                    Limpar filtros
                                </button>
                            }
                        />
                    ) : (
                        <div role="list" className="divide-y divide-border overflow-visible rounded-2xl border border-border bg-card shadow-sm">
                            {visiblePlans.map((plan) => {
                                const days = plan.active ? daysUntil(plan.endDate) : null;
                                const mealCount = plan.mealCount ?? plan.meals?.length ?? 0;
                                return (
                                    <div key={plan.id} role="listitem" className="group flex items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/40 sm:px-3">
                                        <Link href={`/personal/diets/${plan.id}`} data-row-link className={rowLinkClass}>
                                            <Avatar name={plan.student?.user?.name || 'Aluno'} src={plan.student?.user?.avatar ?? undefined} size="md" />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                    <span className="truncate font-semibold text-foreground">{plan.student?.user?.name || 'Aluno'}</span>
                                                    <span
                                                        className={cn(
                                                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                                                            plan.active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                                                        )}
                                                    >
                                                        {plan.active ? 'Ativa' : 'Inativa'}
                                                    </span>
                                                    {days !== null && days < 0 && (
                                                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                                                            Vencida há {Math.abs(days)} {Math.abs(days) === 1 ? 'dia' : 'dias'}
                                                        </span>
                                                    )}
                                                    {days !== null && days >= 0 && days <= 7 && (
                                                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                                            {days === 0 ? 'Vence hoje' : `Vence em ${days} ${days === 1 ? 'dia' : 'dias'}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="truncate text-sm text-muted-foreground group-hover:text-foreground">{plan.title}</p>
                                            </div>
                                            <div className="hidden w-48 shrink-0 text-sm tabular-nums text-muted-foreground md:block">
                                                {plan.startDate || plan.endDate
                                                    ? `${formatDateBR(plan.startDate) || '…'} – ${formatDateBR(plan.endDate) || '…'}`
                                                    : 'Sem período definido'}
                                            </div>
                                            <div className="hidden w-60 shrink-0 items-baseline gap-2 text-sm tabular-nums text-muted-foreground lg:flex">
                                                <span className="font-semibold text-foreground">{formatKcal(plan.calories ?? 0)} kcal</span>
                                                <span>P {plan.protein ?? 0}</span>
                                                <span>C {plan.carbs ?? 0}</span>
                                                <span>G {plan.fat ?? 0}</span>
                                            </div>
                                            <div className="hidden w-24 shrink-0 text-right text-sm text-muted-foreground sm:block">
                                                {mealCount} {mealCount === 1 ? 'refeição' : 'refeições'}
                                            </div>
                                        </Link>
                                        <DropdownMenu label={`Ações de ${plan.title}`} items={planMenu(plan)} buttonClassName={menuButtonClass}>
                                            <MoreVertical className="h-4 w-4" />
                                        </DropdownMenu>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : templatesApi.error && !templatesApi.data ? (
                    <LoadError message={templatesApi.error.message} onRetry={() => void templatesApi.mutate()} />
                ) : templatesApi.isLoading ? (
                    <RowsSkeleton />
                ) : templates.length === 0 ? (
                    <EmptyState
                        icon={BookOpen}
                        title="Nenhum modelo na biblioteca"
                        description="Crie um modelo do zero ou use “Salvar como modelo” em qualquer plano para reaproveitá-lo com outros alunos."
                        action={
                            <Link
                                href="/personal/diets/templates/new"
                                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                                <Plus className="h-4 w-4" />
                                Novo modelo
                            </Link>
                        }
                    />
                ) : visibleTemplates.length === 0 ? (
                    <EmptyState
                        icon={Search}
                        title="Nenhum modelo encontrado"
                        description={`Nada corresponde a “${search}”.`}
                        action={
                            <button type="button" onClick={() => setSearch('')} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                                Limpar busca
                            </button>
                        }
                    />
                ) : (
                    <div role="list" className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
                        {visibleTemplates.map((template) => (
                            <div key={template.id} role="listitem" className="group flex items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/40 sm:px-3">
                                <Link href={`/personal/diets/templates/${template.id}`} data-row-link className={rowLinkClass}>
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                                        <Flame className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-foreground">{template.title}</p>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {template.meals.length} {template.meals.length === 1 ? 'refeição' : 'refeições'}
                                            {template.updatedAt ? ` · atualizado em ${formatDateBR(template.updatedAt)}` : ''}
                                        </p>
                                    </div>
                                    <div className="hidden w-60 shrink-0 items-baseline gap-2 text-sm tabular-nums text-muted-foreground lg:flex">
                                        <span className="font-semibold text-foreground">{formatKcal(template.calories ?? 0)} kcal</span>
                                        <span>P {template.protein ?? 0}</span>
                                        <span>C {template.carbs ?? 0}</span>
                                        <span>G {template.fat ?? 0}</span>
                                    </div>
                                </Link>
                                <Link
                                    href={`/personal/diets/new?templateId=${template.id}`}
                                    className="hidden items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted md:inline-flex"
                                >
                                    <FilePlus2 className="h-4 w-4" />
                                    Usar modelo
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setAssignTemplate(template)}
                                    className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:inline-flex"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Atribuir a aluno
                                </button>
                                <DropdownMenu label={`Ações de ${template.title}`} items={templateMenu(template)} buttonClassName={menuButtonClass}>
                                    <MoreVertical className="h-4 w-4" />
                                </DropdownMenu>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Dica: <kbd className="font-semibold">/</kbd> busca · <kbd className="font-semibold">↑ ↓</kbd> navega · <kbd className="font-semibold">Enter</kbd> abre ·
                Ctrl/⌘ + clique abre em nova aba.
            </p>

            <TemplatePreviewDialog
                template={previewTemplate}
                onClose={() => setPreviewTemplate(null)}
                onAssign={(template) => {
                    setPreviewTemplate(null);
                    setAssignTemplate(template);
                }}
            />
            <AssignTemplateDialog template={assignTemplate} onClose={() => setAssignTemplate(null)} />
        </div>
    );
}
