'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Minimal stale-while-revalidate cache for GET endpoints (no external dependency).
 *
 * - Data is cached in memory per URL, so returning to a page renders instantly
 *   while it refreshes in the background.
 * - Concurrent requests for the same URL are deduplicated.
 * - Revalidates on window focus (throttled) and optionally on an interval while the tab is visible.
 * - `mutate` updates the cache optimistically and/or refetches; `invalidateApi` refetches
 *   every mounted key that matches (e.g. after creating a student).
 *
 * Responses shaped like `{ success, data }` resolve to `data`; anything else resolves to the JSON body.
 * `{ success: false }` or a non-2xx status rejects with the API's `error` message.
 */

type Entry = {
    data?: unknown;
    error?: Error;
    promise?: Promise<unknown>;
    updatedAt: number;
    isValidating: boolean;
    fetcher?: (url: string) => Promise<unknown>;
};

type Snapshot = Readonly<Entry>;

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY: Snapshot = Object.freeze({ updatedAt: 0, isValidating: false });
const FOCUS_THROTTLE_MS = 5000;

function getEntry(key: string): Entry {
    let entry = cache.get(key);
    if (!entry) {
        entry = { updatedAt: 0, isValidating: false };
        cache.set(key, entry);
    }
    return entry;
}

function setEntry(key: string, patch: Partial<Entry>) {
    // Replace the object so useSyncExternalStore sees a new snapshot.
    cache.set(key, { ...getEntry(key), ...patch });
    listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
    let set = listeners.get(key);
    if (!set) {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(listener);
    return () => {
        set?.delete(listener);
    };
}

export async function apiFetcher<T = unknown>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });
    let body: any = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    if (!response.ok || (body && typeof body === 'object' && body.success === false)) {
        const message = (body && (body.error || body.message)) || `Erro ${response.status} ao carregar dados`;
        throw new Error(typeof message === 'string' ? message : 'Erro ao carregar dados');
    }
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
        return body.data as T;
    }
    return body as T;
}

function revalidate(
    key: string,
    fetcher: (url: string) => Promise<unknown>,
    options?: { force?: boolean }
) {
    const entry = getEntry(key);
    if (!options?.force && entry.promise) return entry.promise;
    let promise: Promise<unknown>;
    promise = fetcher(key)
        .then((data) => {
            const current = getEntry(key);
            if (current.promise === promise) {
                setEntry(key, { data, error: undefined, promise: undefined, updatedAt: Date.now(), isValidating: false });
            }
            return data;
        })
        .catch((error: unknown) => {
            const current = getEntry(key);
            if (current.promise === promise) {
                setEntry(key, {
                    error: error instanceof Error ? error : new Error(String(error)),
                    promise: undefined,
                    isValidating: false,
                });
            }
            return undefined;
        });
    setEntry(key, { fetcher, promise, isValidating: true });
    return promise;
}

/** Refetch every cached key that matches (string prefix or predicate). */
export function invalidateApi(match: string | ((key: string) => boolean)) {
    const test = typeof match === 'string' ? (key: string) => key === match || key.startsWith(match) : match;
    cache.forEach((entry, key) => {
        if (!test(key)) return;
        if ((listeners.get(key)?.size ?? 0) > 0) {
            revalidate(key, entry.fetcher ?? apiFetcher, { force: true });
        } else {
            // Nobody is showing it right now: drop it so the next mount fetches fresh data.
            cache.delete(key);
        }
    });
}

/** Current cached data for a key, without subscribing or creating an entry. */
export function getApiData<T>(key: string): T | undefined {
    return cache.get(key)?.data as T | undefined;
}

/** Seed or update cached data for a key without a hook (e.g. after a POST that returns the new list). */
export function setApiData<T>(key: string, updater: T | ((current: T | undefined) => T | undefined)) {
    const current = getEntry(key).data as T | undefined;
    const next = typeof updater === 'function' ? (updater as (c: T | undefined) => T | undefined)(current) : updater;
    setEntry(key, { data: next, updatedAt: Date.now() });
}

export interface UseApiOptions<T> {
    fetcher?: (url: string) => Promise<T>;
    /** Refetch when the window regains focus. Defaults to true. */
    revalidateOnFocus?: boolean;
    /** Poll every N ms while the tab is visible. */
    refreshInterval?: number;
}

export interface UseApiResult<T> {
    data: T | undefined;
    error: Error | undefined;
    /** True only while there is no data yet. */
    isLoading: boolean;
    /** True whenever a request is in flight (including background refreshes). */
    isValidating: boolean;
    /**
     * Without arguments: refetch. With data or an updater: update the cache immediately
     * (optimistic UI) and, unless `revalidate: false`, refetch afterwards.
     */
    mutate: (
        updater?: T | ((current: T | undefined) => T | undefined),
        options?: { revalidate?: boolean; force?: boolean }
    ) => Promise<T | undefined>;
}

/** Pass `null` as the key to skip fetching (e.g. while an id is not known yet). */
export function useApi<T = unknown>(key: string | null, options: UseApiOptions<T> = {}): UseApiResult<T> {
    const { revalidateOnFocus = true, refreshInterval } = options;
    const fetcherRef = useRef<(url: string) => Promise<unknown>>(options.fetcher ?? apiFetcher);
    fetcherRef.current = options.fetcher ?? apiFetcher;

    const snapshot = useSyncExternalStore(
        useCallback((listener: () => void) => (key ? subscribe(key, listener) : () => {}), [key]),
        () => (key ? getEntry(key) : EMPTY),
        () => EMPTY
    );

    // Stale-while-revalidate: always refresh on mount / key change, showing cached data meanwhile.
    useEffect(() => {
        if (!key) return;
        setEntry(key, { fetcher: fetcherRef.current });
        revalidate(key, fetcherRef.current);
    }, [key]);

    useEffect(() => {
        if (!key || !revalidateOnFocus) return;
        const onFocus = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - getEntry(key).updatedAt < FOCUS_THROTTLE_MS) return;
            revalidate(key, fetcherRef.current);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [key, revalidateOnFocus]);

    useEffect(() => {
        if (!key || !refreshInterval) return;
        const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') revalidate(key, fetcherRef.current);
        }, refreshInterval);
        return () => window.clearInterval(id);
    }, [key, refreshInterval]);

    const mutate = useCallback<UseApiResult<T>['mutate']>(
        async (updater, mutateOptions) => {
            if (!key) return undefined;
            if (updater !== undefined) {
                setApiData<T>(key, updater);
                if (mutateOptions?.revalidate === false) return getEntry(key).data as T | undefined;
            }
            return (await revalidate(key, fetcherRef.current, { force: mutateOptions?.force })) as T | undefined;
        },
        [key]
    );

    const data = snapshot.data as T | undefined;
    return {
        data,
        error: snapshot.error,
        // Based on updatedAt (not data) so endpoints that legitimately return null don't spin forever.
        isLoading: Boolean(key) && snapshot.updatedAt === 0 && !snapshot.error,
        isValidating: snapshot.isValidating,
        mutate,
    };
}
