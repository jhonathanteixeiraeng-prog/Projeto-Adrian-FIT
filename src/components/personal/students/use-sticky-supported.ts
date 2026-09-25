'use client';

import { RefObject, useEffect, useState } from 'react';

/**
 * `position: sticky` only follows the window when no ancestor is a scroll container.
 * Ancestors with overflow hidden/auto (e.g. `overflow-x-hidden`, which also makes overflow-y auto)
 * capture it, so a tall sticky column would just become a clipped box. Returns true only when
 * sticky can actually work; with `overflow-x-clip` ancestors it does.
 */
export function useStickySupported(ref: RefObject<HTMLElement>): boolean {
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        let node = ref.current?.parentElement ?? null;
        while (node && node !== document.body && node !== document.documentElement) {
            const style = window.getComputedStyle(node);
            if (/(auto|scroll|hidden)/.test(`${style.overflowX} ${style.overflowY}`)) {
                setSupported(false);
                return;
            }
            node = node.parentElement;
        }
        setSupported(true);
    }, [ref]);

    return supported;
}
