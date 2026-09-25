'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    BellRing,
    CheckCircle2,
    ChevronRight,
    CreditCard,
    DollarSign,
    Download,
    Dumbbell,
    FilterX,
    LayoutGrid,
    Loader2,
    PauseCircle,
    Phone,
    PlayCircle,
    RefreshCw,
    Search,
    Table as TableIcon,
    UserPlus,
    Users,
    Utensils,
    X,
} from 'lucide-react';
import { Avatar, useDialogs, useToast } from '@/components/ui';
import { usePageMeta } from '@/components/personal/page-meta';
import {
    BILLING_FILTER_OPTIONS,
    CRM_TABS,
    type CrmRow,
    type CrmTab,
    SORT_KEYS,
    type SortKey,
    billingWhatsappUrl,
    buildRow,
    exportRowsCsv,
    sortRows,
    tabPredicates,
} from '@/components/personal/students/crm';
import {
    PLAN_OPTIONS,
    STATUS_OPTIONS,
    STUDENTS_KEY,
    bulkUpdateStudents,
    errorMessage,
    formatBRL,
    formatDate,
    formatShortDate,
    isInteractiveTarget,
    isOtherDialogOpen,
    planEndInfo,
    planLabel,
    planMonths,
    relativeDaysLabel,
    saveCrmQuery,
    saveNavOrder,
    toneText,
    whatsappUrl,
} from '@/components/personal/students/lib';
import { ReminderDialog } from '@/components/personal/students/reminder-dialog';
import { StudentDrawer } from '@/components/personal/students/student-drawer';
import type { StudentListItem } from '@/components/personal/students/types';
import { BillingBadge, Kbd, StudentStatusBadge, selectClass, smallButtonClass } from '@/components/personal/students/ui';
import { useSyncedUrlParams } from '@/components/personal/students/use-instant-url-value';
import { useApi } from '@/hooks/use-api';
import { useHotkey } from '@/hooks/use-hotkey';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { CHECKIN_EXPECTED_DAYS, INACTIVITY_ALERT_DAYS } from '@/lib/student-status';
import { cn, matchesSearch } from '@/lib/utils';

const PAGE_SIZE = 100;

const URL_DEFAULTS = {
    q: '',
    tab: 'all',
    plan: 'all',
    payment: 'all',
    status: 'all',
    sort: 'name',
    dir: 'asc',
    view: '',
    student: '',
};

/** First click on a column uses the most useful direction (e.g. longest without training first). */
const DEFAULT_SORT_DIR: Record<SortKey, 'asc' | 'desc'> = {
    name: 'asc',
    status: 'asc',
    workout: 'asc',
    lastWorkout: 'desc',
    lastCheckin: 'desc',
    plan: 'desc',
    expires: 'asc',
};

const EMPTY_MESSAGES: Record<CrmTab, { title: string; description: string }> = {
    all: { title: 'Nenhum aluno encontrado', description: 'Ajuste a busca ou os filtros.' },
    'on-track': {
        title: 'Ninguém treinando no ritmo neste filtro',
        description: `Aqui aparecem alunos ativos que treinaram nos últimos ${INACTIVITY_ALERT_DAYS} dias.`,
    },
    risk: {
        title: 'Nenhum aluno em risco',
        description: `Todos os alunos ativos treinaram nos últimos ${INACTIVITY_ALERT_DAYS} dias.`,
    },
    billing: {
        title: 'Nenhuma cobrança pendente',
        description: 'Nenhum contrato vencido, vencendo em 7 dias ou com pagamento pendente.',
    },
    inactive: {
        title: 'Nenhum aluno pausado ou inativo',
        description: 'Altere o status de um aluno pelo painel lateral ou pela ficha.',
    },
};

function SortableHeader({
    label,
    column,
    sortKey,
    sortDir,
    onSort,
    className,
}: {
    label: string;
    column: SortKey;
    sortKey: SortKey;
    sortDir: 'asc' | 'desc';
    onSort: (key: SortKey) => void;
    className?: string;
}) {
    const active = sortKey === column;
    return (
        <th
            scope="col"
            aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn('px-3 py-2.5 text-left font-semibold', className)}
        >
            <button
                type="button"
                onClick={() => onSort(column)}
                className={cn(
                    'inline-flex items-center gap-1 rounded-md px-1 -mx-1 uppercase tracking-wider transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                    active && 'text-foreground'
                )}
            >
                {label}
                {active ? (
                    sortDir === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-[#F88022]" />
                    ) : (
                        <ArrowDown className="h-3 w-3 text-[#F88022]" />
                    )
                ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
            </button>
        </th>
    );
}

function MetricCard({
    label,
    value,
    detail,
    icon,
    tone = 'default',
    onClick,
    active,
}: {
    label: string;
    value: React.ReactNode;
    detail: React.ReactNode;
    icon: React.ReactNode;
    tone?: 'default' | 'danger' | 'warn' | 'ok';
    onClick?: () => void;
    active?: boolean;
}) {
    const Wrapper = onClick ? 'button' : 'div';
    return (
        <Wrapper
            {...(onClick ? { type: 'button' as const, onClick } : {})}
            className={cn(
                'rounded-2xl border bg-card p-4 text-left transition-colors',
                onClick && 'hover:border-[#F88022]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                active ? 'border-[#F88022]/60' : 'border-border'
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                <span
                    className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg',
                        tone === 'danger' && 'bg-red-500/10 text-red-500',
                        tone === 'warn' && 'bg-amber-500/10 text-amber-500',
                        tone === 'ok' && 'bg-emerald-500/10 text-emerald-500',
                        tone === 'default' && 'bg-blue-500/10 text-blue-500'
                    )}
                >
                    {icon}
                </span>
            </div>
            <p
                className={cn(
                    'mt-1 text-2xl font-black',
                    tone === 'danger' ? 'text-red-500' : tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                )}
            >
                {value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </Wrapper>
    );
}

function TableSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-busy="true" aria-label="Carregando alunos">
            <div className="h-10 border-b border-border bg-muted/50" />
            {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 border-b border-border/60 px-4 py-3 last:border-0">
                    <div className="h-4 w-4 rounded bg-muted" />
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
                    </div>
                    <div className="hidden h-3 w-24 animate-pulse rounded bg-muted md:block" />
                    <div className="hidden h-3 w-24 animate-pulse rounded bg-muted lg:block" />
                    <div className="hidden h-3 w-20 animate-pulse rounded bg-muted lg:block" />
                </div>
            ))}
        </div>
    );
}

export default function StudentsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { confirm } = useDialogs();
    usePageMeta({ title: 'Alunos', breadcrumbs: [{ label: 'Alunos (CRM)' }] });

    const { data, error, isLoading, isValidating, mutate } = useApi<StudentListItem[]>(STUDENTS_KEY);
    // All list state lives in the URL (?q, tab, plan, payment, status, sort, dir, view, student), mirrored locally for instant feedback.
    const [params, setParams] = useSyncedUrlParams(URL_DEFAULTS);
    const [storedView, setStoredView] = useLocalStorageState<'table' | 'cards'>('personal:crm-view', 'table');
    const view: 'table' | 'cards' = params.view === 'cards' || params.view === 'table' ? params.view : storedView;

    const search = params.q;
    const setSearch = useCallback((q: string) => setParams({ q }), [setParams]);
    const drawerId = params.student;
    const setDrawerId = useCallback((student: string) => setParams({ student }), [setParams]);

    const tab = (CRM_TABS.some((item) => item.id === params.tab) ? params.tab : 'all') as CrmTab;
    const sortKey = (SORT_KEYS.includes(params.sort as SortKey) ? params.sort : 'name') as SortKey;
    const sortDir: 'asc' | 'desc' = params.dir === 'desc' ? 'desc' : 'asc';

    const searchRef = useRef<HTMLInputElement>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const lastToggledRef = useRef<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [reminderTargets, setReminderTargets] = useState<Array<{ id: string; name: string }> | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);

    const students = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const rows = useMemo(() => {
        const now = new Date();
        return students.map((student) => buildRow(student, now));
    }, [students]);

    const baseRows = useMemo(
        () =>
            rows.filter(
                (row) =>
                    matchesSearch(search, row.name, row.email, row.phone, row.phoneDigits) &&
                    (params.plan === 'all' ||
                        (params.plan === 'none'
                            ? row.student.planValue === null || row.student.planValue === undefined
                            : (row.student.planType || 'MENSAL') === params.plan)) &&
                    (params.payment === 'all' ||
                        (params.payment === 'OVERDUE'
                            ? row.status !== 'INACTIVE' && row.billing.status === 'OVERDUE'
                            : row.billing.status === params.payment)) &&
                    (params.status === 'all' || row.status === params.status)
            ),
        [rows, search, params.plan, params.payment, params.status]
    );

    const tabCounts = useMemo(() => {
        const counts = {} as Record<CrmTab, number>;
        CRM_TABS.forEach((item) => {
            counts[item.id] = baseRows.filter(tabPredicates[item.id]).length;
        });
        return counts;
    }, [baseRows]);

    const filtered = useMemo(
        () => sortRows(baseRows.filter(tabPredicates[tab]), sortKey, sortDir),
        [baseRows, tab, sortKey, sortDir]
    );
    const filteredKey = useMemo(() => filtered.map((row) => row.id).join(','), [filtered]);

    const metrics = useMemo(() => {
        const active = rows.filter((row) => row.status === 'ACTIVE');
        const priced = active.filter((row) => row.monthly !== null);
        const billing = rows.filter((row) => row.billingAlert);
        return {
            total: rows.length,
            active: active.length,
            paused: rows.filter((row) => row.status === 'PAUSED').length,
            inactive: rows.filter((row) => row.status === 'INACTIVE').length,
            mrr: priced.reduce((sum, row) => sum + (row.monthly ?? 0), 0),
            unpriced: active.length - priced.length,
            risk: rows.filter((row) => row.atRisk).length,
            neverTrained: rows.filter((row) => row.atRisk && row.lastWorkoutDays === null).length,
            billing: billing.length,
            overdue: billing.filter((row) => row.billing.status === 'OVERDUE').length,
            expiring: billing.filter((row) => row.billing.status === 'EXPIRING').length,
            pending: billing.filter((row) => row.billing.status === 'PENDING').length,
        };
    }, [rows]);

    // Prev/next in the profile follows exactly this list.
    useEffect(() => {
        if (!data) return;
        saveNavOrder(filtered.map((row) => ({ id: row.id, name: row.name })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredKey, data]);

    const paramsKey = JSON.stringify(params);
    useEffect(() => {
        const query = new URLSearchParams();
        (Object.keys(URL_DEFAULTS) as Array<keyof typeof URL_DEFAULTS>).forEach((key) => {
            const value = params[key];
            if (key !== 'student' && value && value !== URL_DEFAULTS[key]) query.set(key, value);
        });
        saveCrmQuery(query.toString());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paramsKey]);

    // Bulk actions only ever apply to students visible in the current filter.
    useEffect(() => {
        setSelected((current) => {
            if (current.size === 0) return current;
            const visible = new Set(filtered.map((row) => row.id));
            const next = new Set(Array.from(current).filter((id) => visible.has(id)));
            return next.size === current.size ? current : next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredKey]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [search, tab, params.plan, params.payment, params.status, sortKey, sortDir]);

    const drawerRow = drawerId ? rows.find((row) => row.id === drawerId) ?? null : null;
    const drawerIndex = drawerRow ? filtered.findIndex((row) => row.id === drawerRow.id) : -1;
    const highlightIndex = highlightId ? filtered.findIndex((row) => row.id === highlightId) : -1;

    // Only close the drawer after a fresh fetch has completed after mounting, preventing
    // auto-closing when opened with a stale cache (e.g. following a link from the dashboard).
    const [hasFetchedAfterMount, setHasFetchedAfterMount] = useState(false);
    const wasValidatingRef = useRef(false);

    useEffect(() => {
        if (isValidating) {
            wasValidatingRef.current = true;
        } else if (wasValidatingRef.current) {
            setHasFetchedAfterMount(true);
        }
    }, [isValidating]);

    // A link to a student that no longer exists (deleted, other account) just closes the drawer.
    useEffect(() => {
        if (!hasFetchedAfterMount) return;
        if (data && !isValidating && !error && drawerId && !rows.some((row) => row.id === drawerId)) {
            setDrawerId('');
        }
    }, [hasFetchedAfterMount, data, isValidating, error, drawerId, rows, setDrawerId]);

    const scrollRowIntoView = (id: string) => {
        window.requestAnimationFrame(() => {
            document.querySelector(`[data-row-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
        });
    };

    // Drawer opened from a link (?student=ID, e.g. from the dashboard): mark and reveal the row too.
    const drawerRowId = drawerRow?.id ?? null;
    useEffect(() => {
        if (!drawerRowId) return;
        setHighlightId(drawerRowId);
        scrollRowIntoView(drawerRowId);
    }, [drawerRowId]);

    const openDrawer = (id: string) => {
        setHighlightId(id);
        setDrawerId(id);
    };

    const openProfileInNewTab = (id: string) => window.open(`/personal/students/${id}`, '_blank', 'noopener');

    const move = (delta: 1 | -1) => {
        if (filtered.length === 0) return;
        const currentId = drawerRow?.id ?? highlightId;
        const index = currentId ? filtered.findIndex((row) => row.id === currentId) : -1;
        const nextIndex =
            index === -1 ? (delta > 0 ? 0 : filtered.length - 1) : Math.min(filtered.length - 1, Math.max(0, index + delta));
        const next = filtered[nextIndex];
        if (!next || next.id === currentId) return;
        setHighlightId(next.id);
        if (drawerRow) setDrawerId(next.id);
        if (nextIndex >= visibleCount) setVisibleCount((count) => count + PAGE_SIZE);
        scrollRowIntoView(next.id);
    };

    const toggleSelected = (id: string, range: boolean) => {
        setSelected((current) => {
            const next = new Set(current);
            const willSelect = !current.has(id);
            const anchor = lastToggledRef.current;
            if (range && anchor && anchor !== id) {
                const from = filtered.findIndex((row) => row.id === anchor);
                const to = filtered.findIndex((row) => row.id === id);
                if (from !== -1 && to !== -1) {
                    filtered.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((row) => {
                        if (willSelect) next.add(row.id);
                        else next.delete(row.id);
                    });
                    return next;
                }
            }
            if (willSelect) next.add(id);
            else next.delete(id);
            return next;
        });
        lastToggledRef.current = id;
    };

    const allSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));
    const someSelected = selected.size > 0 && !allSelected;
    const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(filtered.map((row) => row.id)));
    };
    const selectedRows = useMemo(() => filtered.filter((row) => selected.has(row.id)), [filtered, selected]);

    // ---------------------------------------------------------------- keyboard
    useHotkey(
        '/',
        (event) => {
            if (isOtherDialogOpen()) return;
            event.preventDefault();
            searchRef.current?.focus();
            searchRef.current?.select();
        },
        { preventDefault: false, allowInModal: true }
    );
    useHotkey(
        ['arrowdown', 'j'],
        (event) => {
            if (isOtherDialogOpen()) return;
            event.preventDefault();
            move(1);
        },
        { preventDefault: false, allowInModal: true }
    );
    useHotkey(
        ['arrowup', 'k'],
        (event) => {
            if (isOtherDialogOpen()) return;
            event.preventDefault();
            move(-1);
        },
        { preventDefault: false, allowInModal: true }
    );
    useHotkey(
        'enter',
        (event) => {
            if (drawerRow || isOtherDialogOpen() || isInteractiveTarget(event.target)) return;
            const row = highlightIndex >= 0 ? filtered[highlightIndex] : null;
            if (!row) return;
            event.preventDefault();
            if (event.shiftKey) router.push(`/personal/students/${row.id}`);
            else openDrawer(row.id);
        },
        { preventDefault: false }
    );
    useHotkey(
        'x',
        (event) => {
            if (isOtherDialogOpen() || highlightIndex < 0) return;
            event.preventDefault();
            toggleSelected(filtered[highlightIndex].id, event.shiftKey);
        },
        { preventDefault: false, allowInModal: true }
    );
    useHotkey(
        'escape',
        () => {
            if (drawerRow || isOtherDialogOpen() || selected.size === 0) return;
            setSelected(new Set());
        },
        { preventDefault: false }
    );

    // ---------------------------------------------------------------- actions
    const setSort = (key: SortKey) => {
        if (key === sortKey) setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' });
        else setParams({ sort: key, dir: DEFAULT_SORT_DIR[key] });
    };

    const setView = (next: 'table' | 'cards') => {
        setStoredView(next);
        setParams({ view: next === 'table' ? '' : next });
    };

    const filtersActive = Boolean(search) || params.plan !== 'all' || params.payment !== 'all' || params.status !== 'all';
    const clearFilters = () => {
        setSearch('');
        setParams({ q: '', plan: 'all', payment: 'all', status: 'all' });
    };

    const describeSelection = (list: CrmRow[]) => {
        const names = list.slice(0, 3).map((row) => row.name).join(', ');
        return list.length > 3 ? `${names} e mais ${list.length - 3}` : names;
    };

    const runBulk = async (
        action: 'MARK_PAID' | 'RENEW' | 'SET_STATUS',
        options: { title: string; description: string; confirmText: string; success: string; status?: string }
    ) => {
        const targets = selectedRows;
        if (targets.length === 0) return;
        const ok = await confirm({
            title: options.title,
            description: `${options.description} Alunos: ${describeSelection(targets)}.`,
            confirmText: options.confirmText,
        });
        if (!ok) return;
        try {
            setBulkBusy(true);
            const result = await bulkUpdateStudents(
                targets.map((row) => row.id),
                action,
                options.status
            );
            toast.success(options.success, `${result.count} ${result.count === 1 ? 'aluno atualizado' : 'alunos atualizados'}`);
            if (action === 'MARK_PAID') {
                const stillExpired = targets.filter((row) => row.billing.daysToExpire !== null && row.billing.daysToExpire < 0).length;
                if (stillExpired > 0) {
                    toast.info(
                        `${stillExpired} ${stillExpired === 1 ? 'plano continua vencido' : 'planos continuam vencidos'}`,
                        'Use "Renovar +1 período" para avançar o vencimento.'
                    );
                }
            }
        } catch (bulkError) {
            toast.error('Não foi possível atualizar os alunos', errorMessage(bulkError));
        } finally {
            setBulkBusy(false);
        }
    };

    const exportCsv = (list: CrmRow[]) => {
        if (list.length === 0) {
            toast.warning('Nenhum aluno para exportar neste filtro');
            return;
        }
        exportRowsCsv(list, `alunos_${new Date().toISOString().slice(0, 10)}.csv`);
        toast.success('CSV exportado', `${list.length} ${list.length === 1 ? 'aluno' : 'alunos'}`);
    };

    const handleRowClick = (event: React.MouseEvent, row: CrmRow) => {
        if (isInteractiveTarget(event.target)) return;
        if (event.metaKey || event.ctrlKey) {
            openProfileInNewTab(row.id);
            return;
        }
        if (event.shiftKey) {
            toggleSelected(row.id, true);
            return;
        }
        openDrawer(row.id);
    };

    const handleRowAuxClick = (event: React.MouseEvent, row: CrmRow) => {
        if (event.button !== 1 || isInteractiveTarget(event.target)) return;
        event.preventDefault();
        openProfileInNewTab(row.id);
    };

    /** Plain click on the name opens the drawer; ⌘/Ctrl/Shift/middle click keep the browser's "open in new tab". */
    const handleNameClick = (event: React.MouseEvent<HTMLAnchorElement>, row: CrmRow) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        openDrawer(row.id);
    };

    const closeDrawerAfterDelete = (id: string) => {
        const index = filtered.findIndex((row) => row.id === id);
        const next = index === -1 ? null : filtered[index + 1] ?? filtered[index - 1] ?? null;
        setSelected((current) => {
            if (!current.has(id)) return current;
            const copy = new Set(current);
            copy.delete(id);
            return copy;
        });
        if (next) openDrawer(next.id);
        else setDrawerId('');
    };

    const visibleRows = filtered.slice(0, Math.max(visibleCount, highlightIndex + 1, drawerIndex + 1));
    const hasMore = visibleRows.length < filtered.length;

    const lastWorkoutTone = (row: CrmRow) => {
        if (row.status !== 'ACTIVE') return toneText.muted;
        if (row.lastWorkoutDays === null || row.lastWorkoutDays >= INACTIVITY_ALERT_DAYS) return toneText.danger;
        return toneText.ok;
    };

    // ---------------------------------------------------------------- render helpers
    const renderWorkout = (row: CrmRow) => {
        if (!row.workout) {
            return (
                <Link
                    href={`/personal/students/${row.id}/workout`}
                    className="text-xs font-semibold text-[#F88022] hover:underline focus:outline-none focus-visible:underline"
                >
                    + Prescrever treino
                </Link>
            );
        }
        const end = planEndInfo(row.workout.endDate);
        return (
            <div className="min-w-0">
                <p className="truncate font-medium text-foreground" title={row.workout.title}>
                    {row.workout.title}
                </p>
                {end && <p className={cn('text-xs', toneText[end.tone])}>{end.label}</p>}
            </div>
        );
    };

    const renderDiet = (row: CrmRow) => {
        if (!row.diet) {
            return (
                <Link
                    href={`/personal/students/${row.id}/diet`}
                    className="text-xs font-semibold text-[#F88022] hover:underline focus:outline-none focus-visible:underline"
                >
                    + Criar dieta
                </Link>
            );
        }
        const end = planEndInfo(row.diet.endDate);
        return (
            <div className="min-w-0">
                <p className="truncate font-medium text-foreground" title={row.diet.title}>
                    {row.diet.title}
                </p>
                <p className="text-xs text-muted-foreground">
                    {row.diet.calories ? `${row.diet.calories} kcal` : 'Sem meta'}
                    {end && end.tone !== 'ok' && <span className={toneText[end.tone]}> · {end.label}</span>}
                </p>
            </div>
        );
    };

    const renderCheckin = (row: CrmRow) => {
        if (!row.lastCheckin) return <span className="text-xs text-muted-foreground">Sem check-in</span>;
        const late = (row.lastCheckinDays ?? 0) >= CHECKIN_EXPECTED_DAYS;
        return (
            <div>
                <p className={cn('font-medium', late ? toneText.warn : 'text-foreground')}>
                    {formatShortDate(row.lastCheckin.date)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({relativeDaysLabel(row.lastCheckinDays).toLowerCase()})
                    </span>
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5" title="Adesão ao treino">
                        <Dumbbell className="h-3 w-3 text-[#F88022]" />
                        {row.lastCheckin.workoutAdherence}%
                    </span>
                    <span className="inline-flex items-center gap-0.5" title="Adesão à dieta">
                        <Utensils className="h-3 w-3 text-emerald-500" />
                        {row.lastCheckin.dietAdherence}%
                    </span>
                </p>
            </div>
        );
    };

    const renderPlan = (row: CrmRow) => (
        <div>
            <p className="font-semibold text-foreground">{row.monthly !== null ? `${formatBRL(row.monthly)}/mês` : '—'}</p>
            <p className="text-xs text-muted-foreground">
                {planLabel(row.student.planType)}
                {planMonths(row.student.planType) > 1 && row.student.planValue != null && ` · ${formatBRL(row.student.planValue)}`}
            </p>
        </div>
    );

    const renderRowActions = (row: CrmRow) => {
        const whatsapp = row.billingAlert ? billingWhatsappUrl(row) : whatsappUrl(row.phone);
        return (
            <div className="flex items-center justify-end gap-1">
                {whatsapp && (
                    <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                        title={row.billingAlert ? 'Cobrar no WhatsApp' : 'Abrir WhatsApp'}
                        aria-label={row.billingAlert ? `Cobrar ${row.name} no WhatsApp` : `WhatsApp de ${row.name}`}
                    >
                        <Phone className="h-4 w-4" />
                    </a>
                )}
                <Link
                    href={`/personal/students/${row.id}`}
                    className="rounded-lg bg-[#F88022]/10 p-1.5 text-[#F88022] transition-colors hover:bg-[#F88022]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                    title="Abrir ficha completa"
                    aria-label={`Abrir ficha de ${row.name}`}
                >
                    <ChevronRight className="h-4 w-4" />
                </Link>
            </div>
        );
    };

    const renderEmpty = () => {
        if (rows.length === 0) {
            return (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F88022]/10 text-[#F88022]">
                        <Users className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-base font-bold text-foreground">Você ainda não tem alunos</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro aluno para prescrever treino, dieta e acompanhar a evolução.</p>
                    <Link
                        href="/personal/students/new"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90"
                    >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar aluno
                    </Link>
                </div>
            );
        }
        const message = filtersActive ? EMPTY_MESSAGES.all : EMPTY_MESSAGES[tab];
        return (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {tab === 'billing' && !filtersActive ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Search className="h-5 w-5" />}
                </div>
                <h3 className="mt-3 text-base font-bold text-foreground">{message.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{message.description}</p>
                {filtersActive && (
                    <button type="button" onClick={clearFilters} className={cn(smallButtonClass, 'mt-4')}>
                        <FilterX className="h-3.5 w-3.5" />
                        Limpar busca e filtros
                    </button>
                )}
            </div>
        );
    };

    // ---------------------------------------------------------------- render
    return (
        <div className="space-y-5 pb-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-foreground">
                        Alunos
                        {isValidating && data && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
                    </h1>
                    <p className="text-sm text-muted-foreground">Contratos, cobrança, retenção e prescrição em um só lugar.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => exportCsv(filtered)} className={cn(smallButtonClass, 'h-9')} disabled={!data}>
                        <Download className="h-4 w-4 text-muted-foreground" />
                        Exportar CSV
                    </button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#F88022] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#F88022]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <UserPlus className="h-4 w-4" />
                        Cadastrar aluno
                    </Link>
                </div>
            </div>

            {data && (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <MetricCard
                        label="Receita mensal (MRR)"
                        value={formatBRL(metrics.mrr)}
                        detail={
                            metrics.unpriced > 0
                                ? `${metrics.active} ativos · ${metrics.unpriced} sem valor definido`
                                : `${metrics.active} alunos ativos · planos em valor mensal`
                        }
                        icon={<DollarSign className="h-4 w-4" />}
                        tone="ok"
                    />
                    <MetricCard
                        label="Base de alunos"
                        value={metrics.total}
                        detail={`${metrics.active} ativos · ${metrics.paused} pausados · ${metrics.inactive} inativos`}
                        icon={<Users className="h-4 w-4" />}
                    />
                    <MetricCard
                        label="Em risco"
                        value={metrics.risk}
                        detail={
                            metrics.risk === 0
                                ? 'Todos treinaram recentemente'
                                : `Sem treinar há ${INACTIVITY_ALERT_DAYS}+ dias${metrics.neverTrained ? ` · ${metrics.neverTrained} nunca treinaram` : ''}`
                        }
                        icon={<AlertTriangle className="h-4 w-4" />}
                        tone={metrics.risk > 0 ? 'danger' : 'ok'}
                        onClick={() => setParams({ tab: 'risk' })}
                        active={tab === 'risk'}
                    />
                    <MetricCard
                        label="Cobrança"
                        value={metrics.billing}
                        detail={
                            metrics.billing === 0
                                ? 'Nenhum contrato pendente'
                                : `${metrics.overdue} vencidos · ${metrics.expiring} vencendo · ${metrics.pending} pendentes`
                        }
                        icon={<CreditCard className="h-4 w-4" />}
                        tone={metrics.overdue > 0 ? 'danger' : metrics.billing > 0 ? 'warn' : 'ok'}
                        onClick={() => setParams({ tab: 'billing' })}
                        active={tab === 'billing'}
                    />
                </div>
            )}

            <div className="flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1" role="tablist" aria-label="Segmentos de alunos">
                {CRM_TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        onClick={() => setParams({ tab: item.id })}
                        className={cn(
                            'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                            tab === item.id ? 'bg-background font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {item.id === 'on-track' && <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />}
                        {item.id === 'risk' && <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />}
                        {item.id === 'billing' && <CreditCard className="h-3.5 w-3.5 text-amber-500" aria-hidden />}
                        {item.label}
                        {data && (
                            <span
                                className={cn(
                                    'rounded-full px-1.5 text-xs font-semibold',
                                    tab === item.id ? 'bg-[#F88022]/15 text-[#F88022]' : 'bg-background/60 text-muted-foreground'
                                )}
                            >
                                {tabCounts[item.id]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2.5 lg:flex-row lg:items-center">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                if (search) setSearch('');
                                else event.currentTarget.blur();
                            } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
                                if (filtered.length === 0) return;
                                event.preventDefault();
                                event.currentTarget.blur();
                                setHighlightId(filtered[0].id);
                                scrollRowIntoView(filtered[0].id);
                                if (event.key === 'Enter' && filtered.length === 1) openDrawer(filtered[0].id);
                            }
                        }}
                        placeholder="Buscar por nome, e-mail ou telefone"
                        aria-label="Buscar aluno"
                        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/30"
                    />
                    <Kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">/</Kbd>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={params.plan}
                        onChange={(event) => setParams({ plan: event.target.value })}
                        className={cn(selectClass, 'w-auto')}
                        aria-label="Filtrar por plano"
                    >
                        <option value="all">Todos os planos</option>
                        {PLAN_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                        <option value="none">Sem valor definido</option>
                    </select>
                    <select
                        value={params.payment}
                        onChange={(event) => setParams({ payment: event.target.value })}
                        className={cn(selectClass, 'w-auto')}
                        aria-label="Filtrar por situação da cobrança"
                    >
                        {BILLING_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={params.status}
                        onChange={(event) => setParams({ status: event.target.value })}
                        className={cn(selectClass, 'w-auto')}
                        aria-label="Filtrar por status do aluno"
                    >
                        <option value="all">Todos os status</option>
                        {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {filtersActive && (
                        <button type="button" onClick={clearFilters} className={cn(smallButtonClass, 'h-9')}>
                            <FilterX className="h-3.5 w-3.5" />
                            Limpar
                        </button>
                    )}
                    <div className="flex items-center rounded-lg border border-border bg-muted p-0.5" role="group" aria-label="Modo de visualização">
                        <button
                            type="button"
                            onClick={() => setView('table')}
                            aria-pressed={view === 'table'}
                            className={cn(
                                'rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                                view === 'table' ? 'bg-card text-[#F88022] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}
                            title="Tabela"
                            aria-label="Visualizar em tabela"
                        >
                            <TableIcon className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setView('cards')}
                            aria-pressed={view === 'cards'}
                            className={cn(
                                'rounded-md p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40',
                                view === 'cards' ? 'bg-card text-[#F88022] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}
                            title="Cards"
                            aria-label="Visualizar em cards"
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            {error && data && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                    <span>Não foi possível atualizar a lista agora. Os dados exibidos podem estar desatualizados.</span>
                    <button type="button" onClick={() => mutate()} className={cn(smallButtonClass, 'shrink-0')}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Tentar de novo
                    </button>
                </div>
            )}

            {isLoading ? (
                <TableSkeleton />
            ) : error && !data ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-10 text-center" role="alert">
                    <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
                    <h3 className="mt-3 text-base font-bold text-foreground">Não foi possível carregar os alunos</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
                    <button type="button" onClick={() => mutate()} className={cn(smallButtonClass, 'mt-4 h-9')}>
                        <RefreshCw className={cn('h-4 w-4', isValidating && 'animate-spin')} />
                        Tentar de novo
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                renderEmpty()
            ) : view === 'table' ? (
                <div data-crm-keep-drawer="" className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="max-h-[calc(100dvh-9rem)] overflow-auto">
                        <table className="w-full min-w-[960px] text-sm">
                            <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                                <tr className="border-b border-border">
                                    <th scope="col" className="w-10 px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            ref={(element) => {
                                                if (element) element.indeterminate = someSelected;
                                            }}
                                            onChange={toggleAll}
                                            className="h-4 w-4 cursor-pointer rounded accent-[#F88022]"
                                            aria-label={allSelected ? 'Desmarcar todos' : `Selecionar os ${filtered.length} alunos do filtro`}
                                            title={allSelected ? 'Desmarcar todos' : `Selecionar os ${filtered.length} alunos do filtro`}
                                        />
                                    </th>
                                    <SortableHeader label="Aluno" column="name" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <SortableHeader label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <SortableHeader label="Treino ativo" column="workout" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold uppercase tracking-wider 2xl:table-cell">
                                        Dieta ativa
                                    </th>
                                    <SortableHeader label="Último treino" column="lastWorkout" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <SortableHeader label="Último check-in" column="lastCheckin" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <SortableHeader label="Plano" column="plan" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <SortableHeader label="Vencimento" column="expires" sortKey={sortKey} sortDir={sortDir} onSort={setSort} />
                                    <th scope="col" className="w-20 px-3 py-2.5">
                                        <span className="sr-only">Ações</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {visibleRows.map((row) => {
                                    const isSelected = selected.has(row.id);
                                    const isHighlighted = row.id === highlightId;
                                    const isOpen = row.id === drawerRow?.id;
                                    return (
                                        <tr
                                            key={row.id}
                                            data-row-id={row.id}
                                            onClick={(event) => handleRowClick(event, row)}
                                            onAuxClick={(event) => handleRowAuxClick(event, row)}
                                            aria-selected={isSelected}
                                            className={cn(
                                                'group cursor-pointer transition-colors',
                                                isOpen ? 'bg-[#F88022]/10' : isSelected ? 'bg-[#F88022]/5' : isHighlighted ? 'bg-muted/60' : 'hover:bg-muted/50'
                                            )}
                                        >
                                            <td
                                                className={cn(
                                                    'relative px-3 py-2',
                                                    (isHighlighted || isOpen) && 'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[#F88022]'
                                                )}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => undefined}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggleSelected(row.id, event.shiftKey);
                                                    }}
                                                    className="h-4 w-4 cursor-pointer rounded accent-[#F88022]"
                                                    aria-label={`Selecionar ${row.name}`}
                                                />
                                            </td>
                                            <td className="max-w-[220px] px-3 py-2">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <Avatar name={row.name} src={row.student.user?.avatar || undefined} size="sm" />
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={`/personal/students/${row.id}`}
                                                            onClick={(event) => handleNameClick(event, row)}
                                                            className="block truncate font-semibold text-foreground hover:text-[#F88022] focus:outline-none focus-visible:underline"
                                                        >
                                                            {row.name}
                                                        </Link>
                                                        <p className="truncate text-xs text-muted-foreground" title={row.email}>
                                                            {row.phone || row.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2">
                                                <StudentStatusBadge status={row.status} />
                                            </td>
                                            <td className="max-w-[170px] px-3 py-2">{renderWorkout(row)}</td>
                                            <td className="hidden max-w-[180px] px-3 py-2 2xl:table-cell">{renderDiet(row)}</td>
                                            <td className="whitespace-nowrap px-3 py-2">
                                                <p className={cn('font-semibold', lastWorkoutTone(row))}>
                                                    {row.lastWorkoutDays === null ? 'Nunca treinou' : relativeDaysLabel(row.lastWorkoutDays)}
                                                </p>
                                                {row.lastWorkoutName && (
                                                    <p className="max-w-[110px] truncate text-xs text-muted-foreground" title={row.lastWorkoutName}>
                                                        {row.lastWorkoutName}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2">{renderCheckin(row)}</td>
                                            <td className="whitespace-nowrap px-3 py-2">{renderPlan(row)}</td>
                                            <td className="whitespace-nowrap px-3 py-2">
                                                <p className="text-sm font-medium text-foreground">{formatDate(row.student.planExpiresAt)}</p>
                                                {row.status === 'INACTIVE' && row.billing.status === 'OVERDUE' ? null : (
                                                    <BillingBadge billing={row.billing} className="mt-0.5" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2">{renderRowActions(row)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {hasMore && (
                            <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm text-muted-foreground">
                                Mostrando {visibleRows.length} de {filtered.length}
                                <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className={smallButtonClass}>
                                    Mostrar mais
                                </button>
                                <button type="button" onClick={() => setVisibleCount(filtered.length)} className={smallButtonClass}>
                                    Mostrar todos
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div data-crm-keep-drawer="" className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {visibleRows.map((row) => {
                            const isSelected = selected.has(row.id);
                            return (
                                <article
                                    key={row.id}
                                    data-row-id={row.id}
                                    onClick={(event) => handleRowClick(event, row)}
                                    onAuxClick={(event) => handleRowAuxClick(event, row)}
                                    className={cn(
                                        'cursor-pointer space-y-3 rounded-2xl border bg-card p-4 transition-colors',
                                        row.id === drawerRow?.id ? 'border-[#F88022]' : isSelected ? 'border-[#F88022]/50' : 'border-border hover:border-[#F88022]/40',
                                        row.id === highlightId && 'ring-2 ring-[#F88022]/50'
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => undefined}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                toggleSelected(row.id, event.shiftKey);
                                            }}
                                            className="mt-1 h-4 w-4 cursor-pointer rounded accent-[#F88022]"
                                            aria-label={`Selecionar ${row.name}`}
                                        />
                                        <Avatar name={row.name} src={row.student.user?.avatar || undefined} size="md" />
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={`/personal/students/${row.id}`}
                                                onClick={(event) => handleNameClick(event, row)}
                                                className="block truncate font-bold text-foreground hover:text-[#F88022] focus:outline-none focus-visible:underline"
                                            >
                                                {row.name}
                                            </Link>
                                            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                <StudentStatusBadge status={row.status} />
                                                {row.status === 'INACTIVE' && row.billing.status === 'OVERDUE' ? null : (
                                                    <BillingBadge billing={row.billing} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-muted/40 p-3 text-sm">
                                        <div className="min-w-0">
                                            <dt className="text-xs text-muted-foreground">Treino ativo</dt>
                                            <dd>{renderWorkout(row)}</dd>
                                        </div>
                                        <div className="min-w-0">
                                            <dt className="text-xs text-muted-foreground">Dieta ativa</dt>
                                            <dd>{renderDiet(row)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Último treino</dt>
                                            <dd className={cn('font-semibold', lastWorkoutTone(row))}>
                                                {row.lastWorkoutDays === null ? 'Nunca treinou' : relativeDaysLabel(row.lastWorkoutDays)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Último check-in</dt>
                                            <dd>{renderCheckin(row)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Plano</dt>
                                            <dd>{renderPlan(row)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Vencimento</dt>
                                            <dd className="font-medium text-foreground">{formatDate(row.student.planExpiresAt)}</dd>
                                        </div>
                                    </dl>
                                    {renderRowActions(row)}
                                </article>
                            );
                        })}
                    </div>
                    {hasMore && (
                        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                            Mostrando {visibleRows.length} de {filtered.length}
                            <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className={smallButtonClass}>
                                Mostrar mais
                            </button>
                        </div>
                    )}
                </div>
            )}

            {data && filtered.length > 0 && (
                <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground lg:flex">
                    <span className="inline-flex items-center gap-1">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd> navegar
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Kbd>Enter</Kbd> abrir painel
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> abrir ficha
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Kbd>X</Kbd> selecionar
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <Kbd>/</Kbd> buscar
                    </span>
                    <span>⌘/Ctrl + clique abre a ficha em nova aba</span>
                </p>
            )}

            <StudentDrawer
                row={drawerRow}
                open={Boolean(drawerRow)}
                onOpenChange={(open) => {
                    if (!open) setDrawerId('');
                }}
                position={drawerIndex >= 0 ? { index: drawerIndex, total: filtered.length } : null}
                onPrev={drawerIndex > 0 ? () => move(-1) : null}
                onNext={drawerIndex >= 0 && drawerIndex < filtered.length - 1 ? () => move(1) : null}
                onRemind={(row) => setReminderTargets([{ id: row.id, name: row.name }])}
                onDeleted={closeDrawerAfterDelete}
            />

            <ReminderDialog
                open={reminderTargets !== null}
                onOpenChange={(open) => {
                    if (!open) setReminderTargets(null);
                }}
                students={reminderTargets ?? []}
            />

            {selectedRows.length > 0 &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        data-crm-keep-drawer=""
                        className={cn(
                            'pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6',
                            drawerRow && 'sm:pr-[460px]'
                        )}
                    >
                        <div
                            role="toolbar"
                            aria-label="Ações em lote"
                            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-2 shadow-2xl"
                        >
                            <span className="mr-1 text-sm font-semibold text-foreground">
                                {selectedRows.length} {selectedRows.length === 1 ? 'selecionado' : 'selecionados'}
                            </span>
                            <button
                                type="button"
                                className={smallButtonClass}
                                disabled={bulkBusy}
                                onClick={() =>
                                    runBulk('MARK_PAID', {
                                        title: `Marcar ${selectedRows.length === 1 ? 'pagamento' : `${selectedRows.length} pagamentos`} como pago?`,
                                        description: 'O status de pagamento passa para "Pago".',
                                        confirmText: 'Marcar pago',
                                        success: 'Pagamentos registrados',
                                    })
                                }
                            >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                Marcar pago
                            </button>
                            <button
                                type="button"
                                className={smallButtonClass}
                                disabled={bulkBusy}
                                onClick={() =>
                                    runBulk('RENEW', {
                                        title: `Renovar ${selectedRows.length === 1 ? '1 plano' : `${selectedRows.length} planos`} por mais um período?`,
                                        description:
                                            'Cada vencimento avança um período do próprio plano (mensal +1 mês, trimestral +3, semestral +6, anual +12), contado do vencimento atual ou de hoje se já venceu. O pagamento fica como pago.',
                                        confirmText: 'Renovar',
                                        success: 'Planos renovados',
                                    })
                                }
                            >
                                <RefreshCw className="h-3.5 w-3.5 text-[#F88022]" />
                                Renovar +1 período
                            </button>
                            <button
                                type="button"
                                className={smallButtonClass}
                                disabled={bulkBusy}
                                onClick={() =>
                                    runBulk('SET_STATUS', {
                                        title: `Pausar ${selectedRows.length === 1 ? '1 aluno' : `${selectedRows.length} alunos`}?`,
                                        description: 'Alunos pausados saem da receita mensal e do alerta de risco até serem reativados.',
                                        confirmText: 'Pausar',
                                        success: 'Alunos pausados',
                                        status: 'PAUSED',
                                    })
                                }
                            >
                                <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                                Pausar
                            </button>
                            <button
                                type="button"
                                className={smallButtonClass}
                                disabled={bulkBusy}
                                onClick={() =>
                                    runBulk('SET_STATUS', {
                                        title: `Reativar ${selectedRows.length === 1 ? '1 aluno' : `${selectedRows.length} alunos`}?`,
                                        description: 'Os alunos voltam para o status "Ativo".',
                                        confirmText: 'Reativar',
                                        success: 'Alunos reativados',
                                        status: 'ACTIVE',
                                    })
                                }
                            >
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-500" />
                                Reativar
                            </button>
                            <button
                                type="button"
                                className={smallButtonClass}
                                disabled={bulkBusy}
                                onClick={() => setReminderTargets(selectedRows.map((row) => ({ id: row.id, name: row.name })))}
                            >
                                <BellRing className="h-3.5 w-3.5 text-[#F88022]" />
                                Enviar lembrete
                            </button>
                            <button type="button" className={smallButtonClass} onClick={() => exportCsv(selectedRows)}>
                                <Download className="h-3.5 w-3.5" />
                                CSV
                            </button>
                            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            <button
                                type="button"
                                onClick={() => setSelected(new Set())}
                                className="ml-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                                title="Limpar seleção (Esc)"
                                aria-label="Limpar seleção"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
