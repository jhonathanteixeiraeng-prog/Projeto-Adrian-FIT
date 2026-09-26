'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertCircle, RefreshCw, UserPlus } from 'lucide-react';
import { useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { useUrlState } from '@/hooks/use-url-state';
import { usePageMeta } from '@/components/personal/page-meta';
import { formatClock, formatLongToday } from '@/components/personal/chat/time-format';
import { AttentionQueue, type QueueFilter } from '@/components/personal/dashboard/attention-queue';
import { KpiRow } from '@/components/personal/dashboard/kpi-row';
import { ActivityFeed } from '@/components/personal/dashboard/activity-feed';
import type { DashboardData } from '@/components/personal/dashboard/types';

const REFRESH_MS = 2 * 60 * 1000;

// Readable values for the ?fila= query parameter.
const FILTER_SLUGS: Record<QueueFilter, string> = {
    ALL: 'todos',
    MESSAGES: 'mensagens',
    BILLING: 'cobranca',
    INACTIVITY: 'inatividade',
    CHECKIN: 'checkin',
    PLANS: 'planos',
};

const filterFromSlug = (slug: string): QueueFilter =>
    (Object.keys(FILTER_SLUGS) as QueueFilter[]).find((key) => FILTER_SLUGS[key] === slug) ?? 'ALL';

export default function PersonalDashboard() {
    const { data: session } = useSession();
    const { toast } = useToast();
    const [filterSlug, setFilterSlug] = useUrlState('fila', FILTER_SLUGS.ALL);
    const [isRefreshing, setIsRefreshing] = useState(false);

    usePageMeta({ title: 'Dashboard', breadcrumbs: [{ label: 'Dashboard' }] });

    // The timezone lets the server count calendar days (due dates, plan ends) like the browser does.
    const dashboardKey = `/api/dashboard?tz=${new Date().getTimezoneOffset()}`;
    const { data, error, mutate } = useApi<DashboardData>(dashboardKey, { refreshInterval: REFRESH_MS });

    const filter = filterFromSlug(filterSlug);
    const setFilter = (next: QueueFilter) => setFilterSlug(FILTER_SLUGS[next]);

    const refresh = async () => {
        setIsRefreshing(true);
        invalidateApi('/api/personal/feed');
        const result = await mutate(undefined, { force: true });
        setIsRefreshing(false);
        if (result === undefined) toast.error('Não foi possível atualizar o dashboard');
    };

    const firstName = session?.user?.name?.split(' ')[0];
    const today = formatLongToday();
    const todayLabel = today.charAt(0).toUpperCase() + today.slice(1);

    return (
        <div className="space-y-6 animate-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        Olá{firstName ? `, ${firstName}` : ''}! 👋
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {todayLabel}
                        {data?.generatedAt && <> · atualizado às {formatClock(data.generatedAt)}</>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        disabled={isRefreshing}
                        className="rounded-xl border border-border p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Atualizar agora"
                        aria-label="Atualizar dashboard"
                    >
                        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin text-primary')} />
                    </button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition-all hover:bg-primary/90"
                    >
                        <UserPlus className="h-4 w-4" />
                        Novo aluno
                    </Link>
                </div>
            </div>

            {error && !data && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
                    <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error.message || 'Erro ao carregar o dashboard'}
                    </span>
                    <button type="button" onClick={() => void refresh()} className="shrink-0 font-semibold underline">
                        Tentar novamente
                    </button>
                </div>
            )}

            <KpiRow kpis={data?.kpis} onShowBilling={() => setFilter('BILLING')} />

            <div className="grid gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <AttentionQueue
                        items={data ? data.attentionQueue ?? [] : undefined}
                        failed={Boolean(error && !data)}
                        filter={filter}
                        onFilterChange={setFilter}
                        onChanged={() => void mutate(undefined, { force: true })}
                    />
                </div>
                <ActivityFeed />
            </div>
        </div>
    );
}
