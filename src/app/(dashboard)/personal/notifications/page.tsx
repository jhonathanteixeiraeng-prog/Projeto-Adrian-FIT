'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Bell,
    CalendarCheck2,
    Check,
    CheckCheck,
    ChevronRight,
    ClipboardList,
    Dumbbell,
    Loader2,
    MessageCircle,
    RefreshCw,
    ShieldAlert,
    UtensilsCrossed,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUrlStateGroup } from '@/hooks/use-url-state';
import { usePageMeta } from '@/components/personal/page-meta';
import { useNotifications, type PersonalNotification } from '@/components/personal/notifications-provider';
import { dayKey, formatDayLabel, formatFullDateTime, formatRelativeShort } from '@/components/personal/chat/time-format';

type TypeGroup = 'checkins' | 'adesao' | 'planos' | 'lembretes' | 'outros';

const TYPE_GROUPS: { key: TypeGroup; label: string; types: string[] }[] = [
    { key: 'checkins', label: 'Check-ins', types: ['CHECKIN_REMINDER'] },
    { key: 'adesao', label: 'Adesão', types: ['LOW_ADHERENCE'] },
    { key: 'planos', label: 'Planos', types: ['PLAN_UPDATED'] },
    { key: 'lembretes', label: 'Lembretes', types: ['WORKOUT_REMINDER', 'MEAL_REMINDER', 'WATER_REMINDER'] },
    { key: 'outros', label: 'Outros', types: [] },
];

const groupOf = (type: string): TypeGroup => TYPE_GROUPS.find((group) => group.types.includes(type))?.key ?? 'outros';

const TYPE_ICONS: Record<string, LucideIcon> = {
    WORKOUT_REMINDER: Dumbbell,
    MEAL_REMINDER: UtensilsCrossed,
    CHECKIN_REMINDER: CalendarCheck2,
    LOW_ADHERENCE: ShieldAlert,
    PLAN_UPDATED: ClipboardList,
    NEW_MESSAGE: MessageCircle,
};

export default function PersonalNotificationsPage() {
    const router = useRouter();
    const { notifications, unreadNotifications, unreadMessages, isLoading, error, refresh, markRead, markAllRead } = useNotifications();
    const [filters, setFilters] = useUrlStateGroup({ status: 'todas', tipo: 'todos' });

    usePageMeta({ title: 'Notificações', breadcrumbs: [{ label: 'Notificações' }] });

    const onlyUnread = filters.status === 'nao-lidas';
    const typeFilter = filters.tipo as TypeGroup | 'todos';

    // Only offer the type chips that have something in them.
    const groupCounts = useMemo(() => {
        const counts = new Map<TypeGroup, number>();
        notifications.forEach((item) => counts.set(groupOf(item.type), (counts.get(groupOf(item.type)) ?? 0) + 1));
        return counts;
    }, [notifications]);

    const visible = useMemo(
        () =>
            notifications.filter(
                (item) => (!onlyUnread || !item.read) && (typeFilter === 'todos' || groupOf(item.type) === typeFilter)
            ),
        [notifications, onlyUnread, typeFilter]
    );

    const days = useMemo(() => {
        const result: { key: string; label: string; items: PersonalNotification[] }[] = [];
        visible.forEach((item) => {
            const key = dayKey(item.createdAt);
            const last = result[result.length - 1];
            if (last && last.key === key) last.items.push(item);
            else result.push({ key, label: formatDayLabel(item.createdAt), items: [item] });
        });
        return result;
    }, [visible]);

    const open = (item: PersonalNotification) => {
        void markRead(item.id);
        if (item.link) router.push(item.link);
    };

    // ↑/↓ moves between notifications (Enter opens: they are buttons).
    const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-notification-item]'));
        const index = buttons.findIndex((button) => button === document.activeElement);
        if (index === -1) return;
        event.preventDefault();
        buttons[Math.min(buttons.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    };

    const statusChips = [
        { key: 'todas', label: 'Todas' },
        { key: 'nao-lidas', label: unreadNotifications > 0 ? `Não lidas (${unreadNotifications})` : 'Não lidas' },
    ];

    return (
        <div className="mx-auto max-w-3xl space-y-5 pb-8 animate-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {unreadNotifications === 0
                            ? 'Nenhuma notificação não lida'
                            : `${unreadNotifications} ${unreadNotifications === 1 ? 'não lida' : 'não lidas'}`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void markAllRead()}
                    disabled={unreadNotifications === 0}
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                >
                    <CheckCheck className="h-4 w-4" />
                    Marcar todas como lidas
                </button>
            </div>

            {unreadMessages > 0 && (
                <Link
                    href="/personal/chat"
                    className="flex items-center gap-3 rounded-2xl border border-[#F88022]/30 bg-[#F88022]/10 px-4 py-3 transition-colors hover:bg-[#F88022]/15"
                >
                    <MessageCircle className="h-5 w-5 shrink-0 text-[#F88022]" />
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                            {unreadMessages} {unreadMessages === 1 ? 'mensagem não lida' : 'mensagens não lidas'} no chat
                        </span>
                        <span className="block text-xs text-muted-foreground">Mensagens ficam no chat e são lidas ao abrir a conversa.</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#F88022]" />
                </Link>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
                {statusChips.map((chip) => (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => setFilters({ status: chip.key })}
                        aria-pressed={filters.status === chip.key}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors lg:min-h-0 lg:min-w-0',
                            filters.status === chip.key
                                ? 'bg-[#F88022]/10 text-[#F88022]'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        {chip.label}
                    </button>
                ))}
                {groupCounts.size > 1 && (
                    <>
                        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                        {[{ key: 'todos', label: 'Todos os tipos' }, ...TYPE_GROUPS.filter((group) => groupCounts.has(group.key))].map((group) => (
                            <button
                                key={group.key}
                                type="button"
                                onClick={() => setFilters({ tipo: group.key })}
                                aria-pressed={typeFilter === group.key}
                                className={cn(
                                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors lg:min-h-0 lg:min-w-0',
                                    typeFilter === group.key
                                        ? 'bg-muted text-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                {group.label}
                                {group.key !== 'todos' && <span className="ml-1 tabular-nums">{groupCounts.get(group.key as TypeGroup)}</span>}
                            </button>
                        ))}
                    </>
                )}
            </div>

            {isLoading && notifications.length === 0 ? (
                <div className="flex justify-center rounded-2xl border border-border bg-card py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#F88022]" />
                </div>
            ) : error && notifications.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-border bg-card px-6 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Não foi possível carregar as notificações.</p>
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Tentar novamente
                    </button>
                </div>
            ) : visible.length === 0 ? (
                <div className="space-y-2 rounded-2xl border border-border bg-card px-6 py-12 text-center">
                    <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">
                        {notifications.length === 0
                            ? 'Você não tem notificações'
                            : onlyUnread
                                ? 'Tudo lido por aqui'
                                : 'Nenhuma notificação deste tipo'}
                    </p>
                    {notifications.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setFilters({ status: 'todas', tipo: 'todos' })}
                            className="text-sm font-semibold text-[#F88022] hover:underline lg:min-h-0"
                        >
                            Ver todas
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-4" onKeyDown={handleListKeyDown}>
                    {days.map((day) => (
                        <section key={day.key} aria-label={day.label}>
                            <h2 className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{day.label}</h2>
                            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                                {day.items.map((item) => {
                                    const Icon = TYPE_ICONS[item.type] ?? Bell;
                                    return (
                                        <li key={item.id} className={cn('flex items-stretch', !item.read && 'bg-[#F88022]/5')}>
                                            <button
                                                type="button"
                                                data-notification-item
                                                onClick={() => open(item)}
                                                className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus:outline-none focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F88022]/50"
                                            >
                                                <span
                                                    className={cn(
                                                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                                        item.read ? 'bg-muted text-muted-foreground' : 'bg-[#F88022]/15 text-[#F88022]'
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex items-center gap-2">
                                                        <span className={cn('truncate text-sm text-foreground', item.read ? 'font-medium' : 'font-semibold')}>
                                                            {item.title}
                                                        </span>
                                                        {!item.read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#F88022]" aria-label="Não lida" />}
                                                    </span>
                                                    <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
                                                    <time
                                                        dateTime={item.createdAt}
                                                        title={formatFullDateTime(item.createdAt)}
                                                        className="mt-1 block text-xs text-muted-foreground"
                                                    >
                                                        {formatRelativeShort(item.createdAt)}
                                                    </time>
                                                </span>
                                                {item.link && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" aria-label="Abrir" />}
                                            </button>
                                            {!item.read && (
                                                <button
                                                    type="button"
                                                    onClick={() => void markRead(item.id)}
                                                    className="flex w-12 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-600"
                                                    title="Marcar como lida"
                                                    aria-label={`Marcar "${item.title}" como lida`}
                                                >
                                                    <Check className="h-4 w-4" />
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                    <p className="px-1 text-xs text-muted-foreground">Mostrando as notificações mais recentes.</p>
                </div>
            )}
        </div>
    );
}
