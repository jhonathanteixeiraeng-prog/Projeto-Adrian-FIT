'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, MessageCircle, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn, matchesSearch } from '@/lib/utils';
import { isMacPlatform, isModalOpen, isTypingTarget, useHotkey } from '@/hooks/use-hotkey';
import { personalLinks } from '@/lib/notifications';
import { useChat, type ConversationItem } from './chat-context';
import { formatFullDateTime, formatRelativeShort } from './time-format';

type InboxFilter = 'all' | 'unread' | 'waiting';

const STATUS_LABELS: Record<string, string> = { PAUSED: 'Pausado', INACTIVE: 'Inativo' };

const isWaiting = (item: ConversationItem) => Boolean(item.lastMessage && !item.lastMessage.fromMe);

interface ConversationListProps {
    /** Student id of the open conversation (null on /personal/chat). */
    activeStudentId: string | null;
}

export function ConversationList({ activeStudentId }: ConversationListProps) {
    const router = useRouter();
    const { conversations, isLoading, error, reload } = useChat();
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<InboxFilter>('all');
    const [highlightedId, setHighlightedId] = useState<string | null>(activeStudentId);
    const [now, setNow] = useState(() => new Date());
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Keeps "há 5 min" labels fresh between polls.
    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(new Date()), 60000);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (activeStudentId) setHighlightedId(activeStudentId);
    }, [activeStudentId]);

    const counts = useMemo(
        () => ({
            unread: conversations.filter((item) => item.unreadCount > 0).length,
            waiting: conversations.filter(isWaiting).length,
        }),
        [conversations]
    );

    const visible = useMemo(
        () =>
            conversations.filter((item) => {
                // The open conversation stays listed even after it stops matching "não lidas".
                const keep = item.studentId === activeStudentId;
                if (filter === 'unread' && item.unreadCount === 0 && !keep) return false;
                if (filter === 'waiting' && !isWaiting(item) && !keep) return false;
                return matchesSearch(query, item.name, item.email, item.phone, item.lastMessage?.text);
            }),
        [conversations, filter, query, activeStudentId]
    );

    const highlightedIndex = visible.findIndex((item) => item.studentId === highlightedId);

    const scrollIntoView = useCallback((studentId: string) => {
        requestAnimationFrame(() => {
            listRef.current
                ?.querySelector<HTMLElement>(`[data-conversation-id="${CSS.escape(studentId)}"]`)
                ?.scrollIntoView({ block: 'nearest' });
        });
    }, []);

    /** Moves the highlight and returns the newly highlighted conversation. */
    const moveHighlight = (delta: number): ConversationItem | undefined => {
        if (visible.length === 0) return undefined;
        const start = highlightedIndex === -1 ? (delta > 0 ? -1 : visible.length) : highlightedIndex;
        const next = visible[Math.min(visible.length - 1, Math.max(0, start + delta))];
        setHighlightedId(next.studentId);
        scrollIntoView(next.studentId);
        return next;
    };

    const open = (studentId: string | undefined) => {
        if (!studentId) return;
        setHighlightedId(studentId);
        router.push(personalLinks.chat(studentId));
    };

    useHotkey('/', () => {
        searchRef.current?.focus();
        searchRef.current?.select();
    });

    // Alt+↑ / Alt+↓ switches conversations from anywhere, even while typing a message (not under a dialog).
    useHotkey(
        ['alt+arrowup', 'alt+arrowdown'],
        (event) => {
            if (visible.length === 0 || isModalOpen()) return;
            if (isMacPlatform() && isTypingTarget(event.target)) return;
            event.preventDefault();
            const currentIndex = visible.findIndex((item) => item.studentId === (activeStudentId ?? highlightedId));
            const delta = event.key === 'ArrowUp' ? -1 : 1;
            const target =
                currentIndex === -1
                    ? visible[delta > 0 ? 0 : visible.length - 1]
                    : visible[Math.min(visible.length - 1, Math.max(0, currentIndex + delta))];
            if (target && target.studentId !== activeStudentId) {
                scrollIntoView(target.studentId);
                open(target.studentId);
            }
        },
        { preventDefault: false }
    );

    // Without an open conversation the list is the page: plain ↑/↓/Enter drive it when nothing has focus.
    // (Re-subscribed every render so the handler sees the current list.)
    useEffect(() => {
        if (activeStudentId) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTypingTarget(event.target) || isModalOpen()) return;
            const focused = document.activeElement;
            if (focused && focused !== document.body) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
            } else if (event.key === 'Enter' && highlightedIndex !== -1) {
                event.preventDefault();
                open(visible[highlightedIndex]?.studentId);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    });

    const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            open((highlightedIndex !== -1 ? visible[highlightedIndex] : visible[0])?.studentId);
        } else if (event.key === 'Escape') {
            if (query) {
                event.preventDefault();
                setQuery('');
            } else {
                event.currentTarget.blur();
            }
        }
    };

    // With a row focused, arrows move the focus between rows (Enter is the link's own behavior).
    const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        const target = moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        if (target) {
            listRef.current?.querySelector<HTMLElement>(`[data-conversation-id="${CSS.escape(target.studentId)}"]`)?.focus();
        }
    };

    const filters: { key: InboxFilter; label: string; count?: number }[] = [
        { key: 'all', label: 'Todas' },
        { key: 'unread', label: 'Não lidas', count: counts.unread },
        { key: 'waiting', label: 'Sem resposta', count: counts.waiting },
    ];

    const hasData = conversations.length > 0;

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="space-y-2.5 border-b border-border p-3">
                <div className="flex items-center justify-between px-1">
                    <h1 className="text-base font-bold text-foreground">Conversas</h1>
                    {counts.unread > 0 && (
                        <span className="text-xs font-semibold text-[#F88022]">
                            {counts.unread} {counts.unread === 1 ? 'não lida' : 'não lidas'}
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Buscar aluno ou mensagem"
                        aria-label="Buscar conversa"
                        aria-controls="chat-conversation-list"
                        className="w-full rounded-xl border border-border bg-muted py-2 pl-9 pr-16 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#F88022]/60 [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                searchRef.current?.focus();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground lg:min-h-0 lg:min-w-0"
                            aria-label="Limpar busca"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    ) : (
                        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-card px-1.5 text-xs font-semibold text-muted-foreground lg:block">
                            /
                        </kbd>
                    )}
                </div>
                <div className="flex gap-1" role="tablist" aria-label="Filtrar conversas">
                    {filters.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={filter === item.key}
                            onClick={() => setFilter(item.key)}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors lg:min-h-0 lg:min-w-0',
                                filter === item.key
                                    ? 'bg-[#F88022]/10 text-[#F88022]'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {item.label}
                            {item.count ? <span className="tabular-nums">({item.count})</span> : null}
                        </button>
                    ))}
                </div>
            </div>

            <div
                ref={listRef}
                id="chat-conversation-list"
                onKeyDown={handleListKeyDown}
                className="min-h-0 flex-1 overflow-y-auto p-1.5"
                aria-label="Conversas"
            >
                {isLoading && !hasData ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-[#F88022]" />
                    </div>
                ) : error && !hasData ? (
                    <div className="space-y-3 px-4 py-10 text-center">
                        <AlertCircle className="mx-auto h-7 w-7 text-red-500" />
                        <p className="text-sm text-muted-foreground">{error.message || 'Não foi possível carregar as conversas.'}</p>
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Tentar novamente
                        </button>
                    </div>
                ) : !hasData ? (
                    <div className="space-y-3 px-4 py-10 text-center">
                        <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Nenhum aluno cadastrado</p>
                        <p className="text-sm text-muted-foreground">Cadastre alunos para conversar com eles por aqui.</p>
                        <Link
                            href="/personal/students/new"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F88022] px-3 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90"
                        >
                            <UserPlus className="h-4 w-4" />
                            Cadastrar aluno
                        </Link>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="space-y-2 px-4 py-10 text-center">
                        <p className="text-sm font-semibold text-foreground">Nenhuma conversa encontrada</p>
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                setFilter('all');
                            }}
                            className="text-sm font-semibold text-[#F88022] hover:underline lg:min-h-0"
                        >
                            Limpar busca e filtros
                        </button>
                    </div>
                ) : (
                    <ul className="space-y-0.5">
                        {visible.map((item) => {
                            const isActive = item.studentId === activeStudentId;
                            const isHighlighted = item.studentId === highlightedId && !isActive;
                            // The open conversation is being read: an inbox poll that raced the read shouldn't flag it.
                            const unread = item.unreadCount > 0 && !isActive;
                            return (
                                <li key={item.studentId}>
                                    <Link
                                        href={personalLinks.chat(item.studentId)}
                                        data-conversation-id={item.studentId}
                                        aria-current={isActive ? 'page' : undefined}
                                        onFocus={() => setHighlightedId(item.studentId)}
                                        className={cn(
                                            'flex items-start gap-3 rounded-xl px-2.5 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#F88022]/50',
                                            isActive
                                                ? 'bg-[#F88022]/10'
                                                : isHighlighted
                                                    ? 'bg-muted'
                                                    : 'hover:bg-muted'
                                        )}
                                    >
                                        <Avatar src={item.avatar ?? undefined} name={item.name} size="md" className="shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className={cn('truncate text-sm text-foreground', unread ? 'font-bold' : 'font-semibold')}>
                                                    {item.name}
                                                </p>
                                                {item.lastMessage && (
                                                    <time
                                                        dateTime={item.lastMessage.createdAt}
                                                        title={formatFullDateTime(item.lastMessage.createdAt)}
                                                        className={cn(
                                                            'shrink-0 text-xs',
                                                            unread ? 'font-semibold text-[#F88022]' : 'text-muted-foreground'
                                                        )}
                                                    >
                                                        {formatRelativeShort(item.lastMessage.createdAt, now)}
                                                    </time>
                                                )}
                                            </div>
                                            <div className="mt-0.5 flex items-center justify-between gap-2">
                                                <p className={cn('truncate text-sm', unread ? 'text-foreground' : 'text-muted-foreground')}>
                                                    {item.lastMessage ? (
                                                        <>
                                                            {item.lastMessage.fromMe && <span className="text-muted-foreground">Você: </span>}
                                                            {item.lastMessage.text}
                                                        </>
                                                    ) : (
                                                        <span className="italic">Nenhuma mensagem ainda</span>
                                                    )}
                                                </p>
                                                {unread && (
                                                    <span
                                                        className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#F88022] px-1.5 text-xs font-bold text-white"
                                                        aria-label={`${item.unreadCount} não lidas`}
                                                    >
                                                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                            {STATUS_LABELS[item.status] && (
                                                <span className="mt-1 inline-flex rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                    {STATUS_LABELS[item.status]}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            <p className="hidden border-t border-border px-4 py-2 text-xs text-muted-foreground lg:block">
                <kbd className="font-sans font-semibold">↑↓</kbd> navegar · <kbd className="font-sans font-semibold">Enter</kbd> abrir ·{' '}
                <kbd className="font-sans font-semibold">Alt ↑↓</kbd> trocar de conversa
            </p>
        </div>
    );
}
