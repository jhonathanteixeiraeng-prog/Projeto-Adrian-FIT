'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * useState persisted in localStorage (per browser). Use for preferences such as
 * view mode, collapsed sidebar, quick replies or recently used items.
 * Reads happen after mount to avoid hydration mismatches; storage errors are ignored.
 */
export function useLocalStorageState<T>(key: string, defaultValue: T): [T, (value: T | ((current: T) => T)) => void] {
    const [value, setValue] = useState<T>(defaultValue);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw !== null) setValue(JSON.parse(raw) as T);
        } catch {
            // Private mode, blocked storage or invalid JSON: keep the default.
        }
    }, [key]);

    const update = useCallback(
        (next: T | ((current: T) => T)) => {
            setValue((current) => {
                const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next;
                try {
                    window.localStorage.setItem(key, JSON.stringify(resolved));
                } catch {
                    // Ignore quota/private-mode errors; the in-memory value still updates.
                }
                return resolved;
            });
        },
        [key]
    );

    return [value, update];
}
