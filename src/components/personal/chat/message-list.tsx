'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock, Loader2, MessageCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './use-chat-messages';
import { dayKey, formatClock, formatDayLabel, formatFullDateTime } from './time-format';

interface MessageListProps {
    messages: ChatMessage[];
    status: 'loading' | 'ready' | 'error';
    error: string | null;
    hasMore: boolean;
    loadingOlder: boolean;
    onLoadOlder: () => Promise<unknown>;
    onLoadOlderError: (message: string) => void;
    onReload: () => void;
    onRetry: (id: string) => void;
    onDiscard: (id: string) => void;
    studentFirstName: string;
}

// Closer than this to the bottom counts as "following the conversation".
const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_THRESHOLD_PX = 80;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function renderText(text: string, fromMe: boolean) {
    return text.split(URL_PATTERN).map((part, index) =>
        index % 2 === 1 ? (
            <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('break-all underline underline-offset-2', fromMe ? 'text-white' : 'text-[#F88022]')}
            >
                {part}
            </a>
        ) : (
            <React.Fragment key={index}>{part}</React.Fragment>
        )
    );
}

export function MessageList({
    messages,
    status,
    error,
    hasMore,
    loadingOlder,
    onLoadOlder,
    onLoadOlderError,
    onReload,
    onRetry,
    onDiscard,
    studentFirstName,
}: MessageListProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const nearBottomRef = useRef(true);
    const previousRef = useRef<{ ids: Set<string>; firstId: string | null; lastId: string | null }>({
        ids: new Set(),
        firstId: null,
        lastId: null,
    });
    const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);
    const [unseen, setUnseen] = useState(0);
    const [showJump, setShowJump] = useState(false);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const element = containerRef.current;
        if (!element) return;
        element.scrollTo({ top: element.scrollHeight, behavior });
        nearBottomRef.current = true;
        setUnseen(0);
        setShowJump(false);
    }, []);

    const requestOlder = useCallback(async () => {
        const element = containerRef.current;
        if (!element || loadingOlder || !hasMore) return;
        prependAnchorRef.current = { height: element.scrollHeight, top: element.scrollTop };
        try {
            await onLoadOlder();
        } catch (reason) {
            prependAnchorRef.current = null;
            onLoadOlderError(reason instanceof Error ? reason.message : 'Não foi possível carregar mensagens anteriores.');
        }
    }, [hasMore, loadingOlder, onLoadOlder, onLoadOlderError]);

    const handleScroll = () => {
        const element = containerRef.current;
        if (!element) return;
        const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
        const near = distance < NEAR_BOTTOM_PX;
        nearBottomRef.current = near;
        setShowJump((current) => (current === !near ? current : !near));
        if (near) setUnseen((current) => (current === 0 ? current : 0));
        if (element.scrollTop < LOAD_OLDER_THRESHOLD_PX && hasMore && !loadingOlder && !prependAnchorRef.current) {
            void requestOlder();
        }
    };

    // Keep the reading position stable: stick to the bottom only when following the conversation.
    useLayoutEffect(() => {
        const element = containerRef.current;
        const previous = previousRef.current;
        const firstId = messages[0]?.id ?? null;
        const last = messages[messages.length - 1];
        const lastId = last?.id ?? null;

        if (element) {
            if (prependAnchorRef.current && firstId !== previous.firstId) {
                const { height, top } = prependAnchorRef.current;
                element.scrollTop = top + (element.scrollHeight - height);
                prependAnchorRef.current = null;
            } else if (previous.ids.size === 0 && messages.length > 0) {
                element.scrollTop = element.scrollHeight;
            } else if (lastId && lastId !== previous.lastId) {
                const added = messages.filter((message) => !previous.ids.has(message.id));
                const justSent = added.some((message) => message.fromMe && message.status === 'sending');
                const incoming = added.filter((message) => !message.fromMe).length;
                if (justSent || nearBottomRef.current) {
                    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
                    nearBottomRef.current = true;
                } else if (incoming > 0) {
                    setUnseen((current) => current + incoming);
                }
            }
        }

        previousRef.current = { ids: new Set(messages.map((message) => message.id)), firstId, lastId };
    }, [messages]);

    // The initial jump happens before the fonts/emoji settle; re-pin once the first batch is laid out.
    useEffect(() => {
        if (status === 'ready') scrollToBottom('auto');
    }, [status, scrollToBottom]);

    // A load that brought nothing older must not leave the anchor behind (it blocks auto-loading).
    useEffect(() => {
        if (!loadingOlder) prependAnchorRef.current = null;
    }, [loadingOlder]);

    if (status === 'loading' && messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-[#F88022]" />
            </div>
        );
    }

    if (status === 'error' && messages.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <p className="text-sm text-muted-foreground">{error || 'Não foi possível carregar as mensagens.'}</p>
                <button
                    type="button"
                    onClick={onReload}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted"
                >
                    <RefreshCw className="h-4 w-4" />
                    Tentar novamente
                </button>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="min-h-0 flex-1 overflow-y-auto bg-muted px-3 py-4 sm:px-5"
                role="log"
                aria-live="polite"
                aria-label="Mensagens"
            >
                {hasMore && (
                    <div className="mb-3 flex justify-center">
                        <button
                            type="button"
                            onClick={() => void requestOlder()}
                            disabled={loadingOlder}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 lg:min-h-0 lg:min-w-0"
                        >
                            {loadingOlder && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {loadingOlder ? 'Carregando…' : 'Carregar mensagens anteriores'}
                        </button>
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F88022]/10 text-[#F88022]">
                            <MessageCircle className="h-7 w-7" />
                        </div>
                        <p className="text-sm font-semibold text-foreground">Nenhuma mensagem ainda</p>
                        <p className="max-w-xs text-sm">
                            Envie a primeira mensagem{studentFirstName ? ` para ${studentFirstName}` : ''} — use uma resposta rápida abaixo.
                        </p>
                    </div>
                ) : (
                    messages.map((message, index) => {
                        const previous = messages[index - 1];
                        const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
                        const grouped =
                            !newDay &&
                            previous.fromMe === message.fromMe &&
                            new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;

                        return (
                            <React.Fragment key={message.id}>
                                {newDay && (
                                    <div className="my-3 flex items-center justify-center first:mt-0">
                                        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                                            {formatDayLabel(message.createdAt)}
                                        </span>
                                    </div>
                                )}
                                <div className={cn('flex flex-col', message.fromMe ? 'items-end' : 'items-start', grouped ? 'mt-1' : 'mt-3')}>
                                    <div
                                        className={cn(
                                            'max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%]',
                                            message.fromMe
                                                ? 'rounded-br-md bg-[#F88022] text-white'
                                                : 'rounded-bl-md border border-border bg-card text-foreground',
                                            message.status === 'failed' && 'opacity-70 ring-2 ring-red-500/60'
                                        )}
                                    >
                                        <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">
                                            {renderText(message.text, message.fromMe)}
                                        </p>
                                        <div
                                            className={cn(
                                                'mt-0.5 flex items-center justify-end gap-1 text-xs',
                                                message.fromMe ? 'text-white/80' : 'text-muted-foreground'
                                            )}
                                        >
                                            <time dateTime={message.createdAt} title={formatFullDateTime(message.createdAt)}>
                                                {formatClock(message.createdAt)}
                                            </time>
                                            {message.fromMe &&
                                                (message.status === 'sending' ? (
                                                    <Clock className="h-3.5 w-3.5" aria-label="Enviando" />
                                                ) : message.status === 'failed' ? (
                                                    <AlertCircle className="h-3.5 w-3.5" aria-label="Não enviada" />
                                                ) : message.read ? (
                                                    <CheckCheck className="h-3.5 w-3.5 text-sky-200" aria-label="Lida" />
                                                ) : (
                                                    <Check className="h-3.5 w-3.5" aria-label="Enviada" />
                                                ))}
                                        </div>
                                    </div>
                                    {message.status === 'failed' && (
                                        <div className="mt-1 flex items-center gap-2 text-xs">
                                            <span className="text-red-500">Não enviada.</span>
                                            <button type="button" onClick={() => onRetry(message.id)} className="font-semibold text-[#F88022] hover:underline lg:min-h-0 lg:min-w-0">
                                                Tentar de novo
                                            </button>
                                            <button type="button" onClick={() => onDiscard(message.id)} className="text-muted-foreground hover:text-foreground hover:underline lg:min-h-0 lg:min-w-0">
                                                Descartar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
            </div>

            {(unseen > 0 || showJump) && (
                <button
                    type="button"
                    onClick={() => scrollToBottom()}
                    className={cn(
                        'absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold shadow-lg transition-colors',
                        unseen > 0
                            ? 'bg-[#F88022] text-white hover:bg-[#F88022]/90'
                            : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    )}
                    aria-label={unseen > 0 ? `${unseen} novas mensagens. Ir para o fim` : 'Ir para a mensagem mais recente'}
                >
                    {unseen > 0 && (unseen === 1 ? '1 nova mensagem' : `${unseen} novas mensagens`)}
                    <ArrowDown className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
