'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ChatMessage {
    id: string;
    fromMe: boolean;
    text: string;
    /** ISO string. */
    createdAt: string;
    read: boolean;
    /** Only for messages typed here that the server hasn't confirmed yet. */
    status?: 'sending' | 'failed';
}

interface ApiMessage {
    id: string;
    fromMe: boolean;
    text: string;
    read: boolean;
    createdAt: string;
}

interface ApiPayload {
    success: boolean;
    data?: ApiMessage[];
    hasMore?: boolean;
    readUpTo?: string | null;
    error?: string;
}

const PAGE_SIZE = 100;
const POLL_INTERVAL_MS = 5000;
// Each poll re-reads a few seconds before the newest message and dedupes by id,
// so a message committed slightly out of order is never skipped.
const POLL_OVERLAP_MS = 3000;

const toMessage = (message: ApiMessage): ChatMessage => ({
    id: message.id,
    fromMe: message.fromMe,
    text: message.text,
    createdAt: new Date(message.createdAt).toISOString(),
    read: message.read,
});

/** Confirmed messages by date, then the ones still being sent (or failed) in the order they were typed. */
function sortMessages(list: ChatMessage[]): ChatMessage[] {
    const confirmed = list
        .filter((message) => !message.status)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return [...confirmed, ...list.filter((message) => message.status)];
}

async function fetchPayload(url: string): Promise<ApiPayload> {
    const response = await fetch(url, { cache: 'no-store' });
    const body = (await response.json().catch(() => null)) as ApiPayload | null;
    if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Não foi possível carregar as mensagens.');
    }
    return body;
}

export interface UseChatMessagesOptions {
    /** The conversation was loaded (the server marked it as read). */
    onOpened?: () => void;
    /** Polling brought new messages from the student (already marked as read by the server). */
    onIncoming?: (messages: ChatMessage[]) => void;
    /** A message was delivered. */
    onSent?: (message: ChatMessage) => void;
}

/**
 * Messages of one conversation: loads the latest page, polls only for newer messages every 5 s
 * while the tab is visible, loads older history on demand and sends optimistically.
 */
export function useChatMessages(userId: string, options: UseChatMessagesOptions = {}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);

    // Source of truth outside React state, so async callbacks always see the latest list.
    const storeRef = useRef<ChatMessage[]>([]);
    const newestRef = useRef<string | null>(null);
    const readUpToRef = useRef<string | null>(null);
    const pollingRef = useRef(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const commit = useCallback((next: ChatMessage[]) => {
        storeRef.current = next;
        setMessages(next);
    }, []);

    /** Merges server messages; returns the ones that were not known yet. */
    const applyServer = useCallback(
        (incoming: ApiMessage[], readUpTo?: string | null): ChatMessage[] => {
            let next = storeRef.current.slice();
            const known = new Map(next.map((message) => [message.id, message]));
            const added: ChatMessage[] = [];

            for (const raw of incoming) {
                const message = toMessage(raw);
                const existing = known.get(message.id);
                if (existing) {
                    if (message.read && !existing.read) {
                        next = next.map((item) => (item.id === message.id ? { ...item, read: true } : item));
                    }
                    continue;
                }
                if (message.fromMe) {
                    // A poll can bring our own message before its POST resolves: drop the optimistic copy.
                    const pendingIndex = next.findIndex((item) => item.status === 'sending' && item.text === message.text);
                    if (pendingIndex !== -1) next.splice(pendingIndex, 1);
                    // A resent message arrived via poll: drop the copy that was marked as failed.
                    const failedIndex = next.findIndex((item) => item.status === 'failed' && item.text === message.text);
                    if (failedIndex !== -1) next.splice(failedIndex, 1);
                }
                known.set(message.id, message);
                next.push(message);
                added.push(message);
            }

            if (readUpTo) readUpToRef.current = readUpTo;
            const readLimit = readUpToRef.current;
            if (readLimit) {
                next = next.map((item) =>
                    item.fromMe && !item.status && !item.read && item.createdAt <= readLimit ? { ...item, read: true } : item
                );
            }

            next = sortMessages(next);
            // The poll cursor only moves with what the server returned in GETs; advancing it with our own
            // sent messages could skip a student's message that arrived just before and wasn't fetched yet.
            for (const raw of incoming) {
                const createdAt = toMessage(raw).createdAt;
                if (!newestRef.current || createdAt > newestRef.current) newestRef.current = createdAt;
            }
            commit(next);
            return added;
        },
        [commit]
    );

    // Initial page (opening the conversation marks it as read on the server).
    useEffect(() => {
        let cancelled = false;
        storeRef.current = [];
        newestRef.current = null;
        readUpToRef.current = null;
        setMessages([]);
        setStatus('loading');
        setError(null);

        fetchPayload(`/api/messages/${encodeURIComponent(userId)}?limit=${PAGE_SIZE}`)
            .then((payload) => {
                if (cancelled) return;
                applyServer(payload.data ?? [], payload.readUpTo);
                setHasMore(Boolean(payload.hasMore));
                setStatus('ready');
                optionsRef.current.onOpened?.();
            })
            .catch((reason: unknown) => {
                if (cancelled) return;
                setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as mensagens.');
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [userId, reloadToken, applyServer]);

    const poll = useCallback(async () => {
        if (pollingRef.current || document.visibilityState !== 'visible') return;
        pollingRef.current = true;
        try {
            const newest = newestRef.current;
            const after = newest ? new Date(new Date(newest).getTime() - POLL_OVERLAP_MS) : new Date(0);
            const payload = await fetchPayload(
                `/api/messages/${encodeURIComponent(userId)}?after=${encodeURIComponent(after.toISOString())}`
            );
            const added = applyServer(payload.data ?? [], payload.readUpTo);
            const incoming = added.filter((message) => !message.fromMe);
            if (incoming.length > 0) optionsRef.current.onIncoming?.(incoming);
        } catch {
            // Transient failure: the next poll retries.
        } finally {
            pollingRef.current = false;
        }
    }, [userId, applyServer]);

    useEffect(() => {
        if (status !== 'ready') return;
        const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') void poll();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('focus', onVisible);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('focus', onVisible);
        };
    }, [status, poll]);

    /** Loads the previous page of history. Rejects on failure. */
    const loadOlder = useCallback(async () => {
        const oldest = storeRef.current.find((message) => !message.status);
        if (!oldest || loadingOlder) return;
        setLoadingOlder(true);
        try {
            const payload = await fetchPayload(
                `/api/messages/${encodeURIComponent(userId)}?before=${encodeURIComponent(oldest.createdAt)}&limit=${PAGE_SIZE}`
            );
            applyServer(payload.data ?? [], payload.readUpTo);
            setHasMore(Boolean(payload.hasMore));
        } finally {
            setLoadingOlder(false);
        }
    }, [userId, loadingOlder, applyServer]);

    const deliver = useCallback(
        async (local: ChatMessage) => {
            try {
                const response = await fetch(`/api/messages/${encodeURIComponent(userId)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: local.text }),
                });
                const body = await response.json().catch(() => null);
                if (!response.ok || !body?.success || !body.data) {
                    throw new Error(body?.error || 'Erro ao enviar mensagem');
                }
                const saved = toMessage(body.data as ApiMessage);
                const current = storeRef.current;
                const withoutLocal = current.filter((message) => message.id !== local.id);
                const alreadyThere = current.some((message) => message.id === saved.id);
                commit(sortMessages(alreadyThere ? withoutLocal : [...withoutLocal, saved]));
                optionsRef.current.onSent?.(saved);
            } catch {
                commit(storeRef.current.map((message) => (message.id === local.id ? { ...message, status: 'failed' } : message)));
            }
        },
        [userId, commit]
    );

    const send = useCallback(
        (text: string) => {
            const value = text.trim();
            if (!value) return;
            const local: ChatMessage = {
                id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                fromMe: true,
                text: value,
                createdAt: new Date().toISOString(),
                read: false,
                status: 'sending',
            };
            commit([...storeRef.current, local]);
            void deliver(local);
        },
        [commit, deliver]
    );

    const retry = useCallback(
        (id: string) => {
            const failed = storeRef.current.find((message) => message.id === id && message.status === 'failed');
            if (!failed) return;
            const again: ChatMessage = { ...failed, status: 'sending' };
            commit(storeRef.current.map((message) => (message.id === id ? again : message)));
            void deliver(again);
        },
        [commit, deliver]
    );

    const discard = useCallback(
        (id: string) => commit(storeRef.current.filter((message) => message.id !== id)),
        [commit]
    );

    const reload = useCallback(() => setReloadToken((token) => token + 1), []);

    return { messages, status, error, hasMore, loadingOlder, loadOlder, send, retry, discard, reload };
}
