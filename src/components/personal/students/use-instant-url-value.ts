'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUrlStateGroup } from '@/hooks/use-url-state';

/** While our own URL write is in flight, intermediate URL states are ignored for at most this long. */
const PENDING_WINDOW_MS = 2000;

/**
 * Local mirror of a URL-backed value: the UI updates immediately while the URL
 * (router.replace) catches up, optionally debounced. Back/forward and links that
 * change the URL still flow into the local value.
 */
export function useInstantUrlValue(urlValue: string, setUrlValue: (value: string) => void, debounceMs = 0): [string, (value: string) => void] {
    const [value, setValue] = useState(urlValue);
    const pendingRef = useRef<string | null>(null);
    const timerRef = useRef<number>();
    const releaseRef = useRef<number>();
    const setUrlRef = useRef(setUrlValue);
    setUrlRef.current = setUrlValue;

    useEffect(() => {
        if (pendingRef.current !== null) {
            // Ignore intermediate URL states while our own update is in flight.
            if (urlValue === pendingRef.current) pendingRef.current = null;
            return;
        }
        setValue(urlValue);
    }, [urlValue]);

    useEffect(
        () => () => {
            window.clearTimeout(timerRef.current);
            window.clearTimeout(releaseRef.current);
        },
        []
    );

    const update = useCallback(
        (next: string) => {
            setValue(next);
            pendingRef.current = next;
            window.clearTimeout(timerRef.current);
            window.clearTimeout(releaseRef.current);
            const push = () => {
                setUrlRef.current(next);
                releaseRef.current = window.setTimeout(() => {
                    pendingRef.current = null;
                }, PENDING_WINDOW_MS);
            };
            if (debounceMs > 0) timerRef.current = window.setTimeout(push, debounceMs);
            else push();
        },
        [debounceMs]
    );

    return [value, update];
}

/**
 * useUrlStateGroup with a local mirror: every change renders immediately and the complete
 * group is written to the URL in one debounced replace. Writing the whole group (instead of
 * merging into window.location, which router.replace only updates when the navigation lands)
 * means quick successive changes — a tab click right before opening the drawer — never drop each other.
 */
export function useSyncedUrlParams<T extends Record<string, string>>(defaults: T, debounceMs = 200): [T, (patch: Partial<T>) => void] {
    const [urlValues, setUrlValues] = useUrlStateGroup(defaults);
    const urlKey = JSON.stringify(urlValues);
    const [values, setValues] = useState<T>(urlValues);
    const valuesRef = useRef(values);
    const pendingRef = useRef<string | null>(null);
    const timerRef = useRef<number>();
    const releaseRef = useRef<number>();
    const setUrlRef = useRef(setUrlValues);
    setUrlRef.current = setUrlValues;

    useEffect(() => {
        if (pendingRef.current !== null) {
            if (urlKey === pendingRef.current) pendingRef.current = null;
            return;
        }
        const next = JSON.parse(urlKey) as T;
        valuesRef.current = next;
        setValues(next);
    }, [urlKey]);

    useEffect(
        () => () => {
            window.clearTimeout(timerRef.current);
            window.clearTimeout(releaseRef.current);
        },
        []
    );

    const update = useCallback(
        (patch: Partial<T>) => {
            const next = { ...valuesRef.current, ...patch } as T;
            valuesRef.current = next;
            setValues(next);
            pendingRef.current = JSON.stringify(next);
            window.clearTimeout(timerRef.current);
            window.clearTimeout(releaseRef.current);
            timerRef.current = window.setTimeout(() => {
                setUrlRef.current(next);
                releaseRef.current = window.setTimeout(() => {
                    pendingRef.current = null;
                }, PENDING_WINDOW_MS);
            }, debounceMs);
        },
        [debounceMs]
    );

    return [values, update];
}
