'use client';

import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
    /** Defaults to true. */
    enabled?: boolean;
    /** Fire even when focus is inside an input, textarea, select or contenteditable. Defaults to false. */
    allowInInputs?: boolean;
    /** Defaults to true. */
    preventDefault?: boolean;
    /** Fire plain-key shortcuts even while a dialog/palette is open. Defaults to false. */
    allowInModal?: boolean;
}

export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT') {
        const type = (target as HTMLInputElement).type?.toLowerCase();
        if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit' || type === 'reset') {
            return false;
        }
        return true;
    }
    return tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** True while a modal dialog (Radix Dialog, ⌘K palette) is open. */
export function isModalOpen(): boolean {
    if (typeof document === 'undefined') return false;
    // Radix dialogs expose data-state="open"; the ⌘K palette uses aria-modal.
    // The non-modal student drawer on CRM ([data-student-drawer]) is ignored.
    const dialogs = document.querySelectorAll(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="dialog"][aria-modal="true"]'
    );
    for (let i = 0; i < dialogs.length; i++) {
        const el = dialogs[i];
        if (!el.matches('[data-student-drawer]') && !el.closest('[data-student-drawer]')) {
            return true;
        }
    }
    return false;
}

export const isMacPlatform = () =>
    typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** Label for the platform modifier key: "⌘" on Mac, "Ctrl" elsewhere. */
export const modKeyLabel = () => (isMacPlatform() ? '⌘' : 'Ctrl');

/**
 * Matches a combo such as "mod+k", "mod+s", "alt+arrowup", "shift+?", "escape" or "/".
 * "mod" means ⌘ on Mac and Ctrl elsewhere (either is accepted).
 */
export function matchesHotkey(event: KeyboardEvent, combo: string): boolean {
    const parts = combo.toLowerCase().split('+').map((part) => part.trim());
    const key = parts[parts.length - 1];
    const modifiers = new Set(parts.slice(0, -1));

    const wantsMod = modifiers.has('mod');
    const hasMod = event.metaKey || event.ctrlKey;
    if (wantsMod !== hasMod) return false;
    if (!wantsMod) {
        if (modifiers.has('ctrl') !== event.ctrlKey) return false;
        if (modifiers.has('meta') !== event.metaKey) return false;
    }
    if (modifiers.has('alt') !== event.altKey) return false;
    const wantsShift = modifiers.has('shift');
    // Symbols ("?", "/", "[") may need Shift on some keyboard layouts, so an unrequested Shift only
    // disqualifies letters, digits and named keys (e.g. ⌘⇧Z must not trigger ⌘Z, Alt+Shift+↑ not Alt+↑).
    const isSymbolKey = key.length === 1 && !/[a-z0-9]/.test(key);
    if (!wantsShift && event.shiftKey && !isSymbolKey) return false;
    if (wantsShift && !event.shiftKey) return false;

    const eventKey = (event.key || '').toLowerCase();
    if (key === 'space') return eventKey === ' ';
    if (key === 'esc') return eventKey === 'escape';
    if (eventKey === key) return true;
    // With Alt pressed on macOS, event.key becomes a special character; fall back to the physical key.
    if (key.length === 1 && /[a-z0-9]/.test(key)) {
        return event.code.toLowerCase() === (/[0-9]/.test(key) ? `digit${key}` : `key${key}`);
    }
    return false;
}

/**
 * Registers a keyboard shortcut on window. The handler always sees the latest props,
 * so it doesn't need to be memoized.
 */
export function useHotkey(
    combo: string | string[],
    handler: (event: KeyboardEvent) => void,
    options: HotkeyOptions = {}
) {
    const { enabled = true, allowInInputs = false, preventDefault = true, allowInModal = false } = options;
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    const combos = Array.isArray(combo) ? combo : [combo];
    const combosKey = combos.join('|');

    useEffect(() => {
        if (!enabled) return;
        const list = combosKey.split('|');

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing) return;
            if (!list.some((item) => matchesHotkey(event, item))) return;
            // Plain-key shortcuts must not fire while typing; modifier shortcuts (⌘S, ⌘K) may.
            const usesModifier = event.metaKey || event.ctrlKey || event.altKey;
            if (!allowInInputs && !usesModifier && isTypingTarget(event.target)) return;
            // Single-key shortcuts belong to the page, not to whatever dialog is on top of it.
            if (!allowInModal && !usesModifier && isModalOpen()) return;
            if (preventDefault) event.preventDefault();
            handlerRef.current(event);
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [combosKey, enabled, allowInInputs, preventDefault, allowInModal]);
}
