'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle2, Dumbbell, Loader2, MessageCircle, Utensils, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/use-api';
import { personalLinks } from '@/lib/notifications';
import { formatFullDateTime, formatRelativeShort } from '@/components/personal/chat/time-format';
import type { ActivityEvent, ActivityType } from './types';

interface FeedPayload {
    events: ActivityEvent[];
    hasMore: boolean;
}

type FeedFilter = 'ALL' | ActivityType;

const PAGE_SIZE = 25;
const MAX_LIMIT = 100;
const INITIAL_VISIBLE = 8;
const REFRESH_MS = 60000;

const TYPE_CONFIG: Record<ActivityType, { icon: LucideIcon; tone: string; action: string; filterLabel: string }> = {
    WORKOUT_COMPLETED: { icon: Dumbbell, tone: 'bg-primary/15 text-primary', action: 'concluiu o treino', filterLabel: 'Treinos' },
    CHECKIN_SUBMITTED: { icon: CheckCircle2, tone: 'bg-emerald-500/15 text-emerald-500', action: 'enviou o check-in', filterLabel: 'Check-ins' },
    FOOD_SUBSTITUTED: { icon: Utensils, tone: 'bg-blue-500/15 text-blue-500', action: 'substituiu um alimento', filterLabel: 'Dieta' },
    MESSAGE_RECEIVED: { icon: MessageCircle, tone: 'bg-purple-500/15 text-purple-500', action: 'enviou uma mensagem', filterLabel: 'Mensagens' },
};

const FILTERS: { key: FeedFilter; label: string }[] = [
    { key: 'ALL', label: 'Todos' },
    ...(Object.keys(TYPE_CONFIG) as ActivityType[]).map((type) => ({ key: type, label: TYPE_CONFIG[type].filterLabel })),
];

function hrefFor(event: ActivityEvent): string {
    switch (event.type) {
        case 'MESSAGE_RECEIVED':
            return personalLinks.chat(event.studentId);
        case 'CHECKIN_SUBMITTED':
            return personalLinks.student(event.studentId, 'progress');
        case 'FOOD_SUBSTITUTED':
            return personalLinks.student(event.studentId, 'diet');
        default:
            return personalLinks.student(event.studentId, 'workout');
    }
}

async function feedFetcher(url: string): Promise<FeedPayload> {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) throw new Error(body?.error || 'Erro ao carregar atividades');
    return { events: Array.isArray(body.data) ? body.data : [], hasMore: Boolean(body.hasMore) };
}

/** Recent student activity (last 7 days), refreshed every minute while the tab is visible. */
export function ActivityFeed() {
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
    const [filter, setFilter] = useState<FeedFilter>('ALL');
    const { data, error, isLoading } = useApi<FeedPayload>(`/api/personal/feed?limit=${limit}`, {
        refreshInterval: REFRESH_MS,
        fetcher: feedFetcher,
    });

    // While a bigger page loads, keep showing what we have.
    const lastPayloadRef = useRef<FeedPayload | undefined>(undefined);
    if (data) lastPayloadRef.current = data;
    const payload = data ?? lastPayloadRef.current;

    const filtered = useMemo(
        () => (payload?.events ?? []).filter((event) => filter === 'ALL' || event.type === filter),
        [payload, filter]
    );
    const shown = filtered.slice(0, visibleCount);
    const canShowMore = filtered.length > visibleCount || (Boolean(payload?.hasMore) && limit < MAX_LIMIT);
    const isLoadingMore = !data && Boolean(lastPayloadRef.current);

    const showMore = () => {
        if (filtered.length <= visibleCount + 10 && payload?.hasMore && limit < MAX_LIMIT) {
            setLimit((current) => Math.min(MAX_LIMIT, current + PAGE_SIZE));
        }
        setVisibleCount((current) => current + 10);
    };

    return (
        <section className="flex flex-col rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="activity-feed-title">
            <div className="space-y-3 border-b border-border px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Activity className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="activity-feed-title" className="text-base font-semibold text-foreground">
                            Atividade recente
                        </h2>
                        <p className="text-xs text-muted-foreground">Últimos 7 dias · atualiza a cada minuto</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar atividades">
                    {FILTERS.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={filter === item.key}
                            onClick={() => {
                                setFilter(item.key);
                                setVisibleCount(INITIAL_VISIBLE);
                            }}
                            className={cn(
                                'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors lg:min-h-0 lg:min-w-0',
                                filter === item.key
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-2">
                {isLoading && !payload ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : error && !payload ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">Não foi possível carregar as atividades.</p>
                ) : shown.length === 0 ? (
                    <div className="px-3 py-8 text-center">
                        <p className="text-sm font-semibold text-foreground">Nenhuma atividade nos últimos 7 dias</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Treinos concluídos, check-ins, trocas de alimento e mensagens aparecem aqui.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {shown.map((event) => {
                            const config = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.WORKOUT_COMPLETED;
                            const Icon = config.icon;
                            return (
                                <li key={event.id}>
                                    <Link
                                        href={hrefFor(event)}
                                        className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                    >
                                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', config.tone)}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm text-foreground">
                                                <span className="font-semibold">{event.studentName}</span>{' '}
                                                <span className="text-muted-foreground">{event.action ?? config.action}</span>
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">{event.description}</span>
                                        </span>
                                        <time
                                            dateTime={event.timestamp}
                                            title={formatFullDateTime(event.timestamp)}
                                            className="shrink-0 pt-0.5 text-xs text-muted-foreground"
                                        >
                                            {formatRelativeShort(event.timestamp)}
                                        </time>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {canShowMore && shown.length > 0 && (
                <div className="border-t border-border p-2">
                    <button
                        type="button"
                        onClick={showMore}
                        disabled={isLoadingMore}
                        className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                        {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                        Ver mais
                    </button>
                </div>
            )}
        </section>
    );
}
