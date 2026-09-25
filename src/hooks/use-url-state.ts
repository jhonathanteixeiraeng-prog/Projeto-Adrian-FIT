'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Keeps a piece of UI state (tab, filter, sort, search, view mode) in the URL query string,
 * so it survives back/forward, reloads and "open in new tab", and can be bookmarked.
 *
 * The value is removed from the URL when it equals the default, keeping links clean.
 * Pages using this must render under a <Suspense> boundary (the personal layout provides one).
 */
export function useUrlState(key: string, defaultValue = ''): [string, (value: string) => void] {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const value = searchParams.get(key) ?? defaultValue;

    const setValue = useCallback(
        (next: string) => {
            // Read the live URL so several setters called in a row don't overwrite each other.
            const params = new URLSearchParams(window.location.search);
            if (!next || next === defaultValue) {
                params.delete(key);
            } else {
                params.set(key, next);
            }
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [key, defaultValue, pathname, router]
    );

    return [value, setValue];
}

/** Several URL-backed values at once, e.g. `const [filters, setFilters] = useUrlStateGroup({ tab: 'all', sort: 'name' })`. */
export function useUrlStateGroup<T extends Record<string, string>>(
    defaults: T
): [T, (patch: Partial<T>) => void] {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const values = Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [key, searchParams.get(key) ?? fallback])
    ) as T;

    const defaultsKey = JSON.stringify(defaults);
    const setValues = useCallback(
        (patch: Partial<T>) => {
            const fallbacks = JSON.parse(defaultsKey) as T;
            const params = new URLSearchParams(window.location.search);
            Object.entries(patch).forEach(([key, next]) => {
                if (next === undefined) return;
                if (!next || next === fallbacks[key]) {
                    params.delete(key);
                } else {
                    params.set(key, String(next));
                }
            });
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [defaultsKey, pathname, router]
    );

    return [values, setValues];
}
