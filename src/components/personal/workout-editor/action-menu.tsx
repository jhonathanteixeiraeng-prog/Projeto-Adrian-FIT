'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActionMenuItem {
    type?: 'item';
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onSelect?: () => void;
    /** Renders a real link (Cmd/Ctrl+click opens a new tab). */
    href?: string;
    danger?: boolean;
    disabled?: boolean;
    /** Right-aligned hint, e.g. a shortcut. */
    hint?: string;
}

export type ActionMenuEntry = ActionMenuItem | { type: 'separator' } | { type: 'label'; label: string };

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface ActionMenuProps {
    entries: ActionMenuEntry[];
    /** Accessible name of the trigger button. */
    label: string;
    children?: React.ReactNode;
    triggerClassName?: string;
    tabIndex?: number;
    align?: 'start' | 'end';
    width?: number;
    onOpenChange?: (open: boolean) => void;
}

/**
 * Lightweight dropdown menu rendered in a portal with fixed positioning, so it is never
 * clipped by scroll containers. Keyboard: ↑/↓/Home/End move, Enter selects, Esc/Tab close.
 */
export function ActionMenu({
    entries,
    label,
    children,
    triggerClassName,
    tabIndex,
    align = 'end',
    width = 224,
    onOpenChange,
}: ActionMenuProps) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const focusFirstRef = useRef(false);

    const setOpenState = useCallback(
        (next: boolean) => {
            setOpen(next);
            onOpenChange?.(next);
        },
        [onOpenChange]
    );

    const close = useCallback(
        (restoreFocus = false) => {
            setOpenState(false);
            if (restoreFocus) triggerRef.current?.focus();
        },
        [setOpenState]
    );

    const place = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const menuHeight = menuRef.current?.offsetHeight ?? 0;
        let left = align === 'end' ? rect.right - width : rect.left;
        left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
        let top = rect.bottom + 4;
        if (menuHeight && top + menuHeight > window.innerHeight - 8 && rect.top - menuHeight - 4 > 8) {
            top = rect.top - menuHeight - 4;
        }
        setPosition({ top, left });
    }, [align, width]);

    useIsomorphicLayoutEffect(() => {
        if (!open) return;
        place();
        // Second pass once the menu has a height (flip above the trigger if needed).
        const id = window.requestAnimationFrame(place);
        return () => window.cancelAnimationFrame(id);
    }, [open, place]);

    useEffect(() => {
        if (!open) return;
        if (focusFirstRef.current) {
            focusFirstRef.current = false;
            window.requestAnimationFrame(() => {
                menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
            });
        }
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
            close();
        };
        const onScroll = (event: Event) => {
            if (menuRef.current?.contains(event.target as Node)) return;
            close();
        };
        const onResize = () => close();
        document.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open, close]);

    const onMenuKeyDown = (event: React.KeyboardEvent) => {
        const items = Array.from(
            menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            items[(index + 1) % items.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            items[(index - 1 + items.length) % items.length]?.focus();
        } else if (event.key === 'Home') {
            event.preventDefault();
            items[0]?.focus();
        } else if (event.key === 'End') {
            event.preventDefault();
            items[items.length - 1]?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        } else if (event.key === 'Tab') {
            close();
        }
    };

    const itemClass = (item: ActionMenuItem) =>
        cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus:outline-none',
            item.disabled
                ? 'cursor-not-allowed opacity-50'
                : item.danger
                  ? 'text-red-500 hover:bg-red-500/10 focus:bg-red-500/10'
                  : 'text-foreground hover:bg-muted focus:bg-muted'
        );

    const renderItem = (item: ActionMenuItem, index: number) => {
        const Icon = item.icon;
        const content = (
            <>
                {Icon && <Icon className={cn('h-4 w-4 shrink-0', item.danger ? 'text-red-500' : 'text-muted-foreground')} />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="shrink-0 text-xs text-muted-foreground">{item.hint}</span>}
            </>
        );
        if (item.href && !item.disabled) {
            return (
                <Link key={index} href={item.href} role="menuitem" className={itemClass(item)} onClick={() => close()}>
                    {content}
                </Link>
            );
        }
        return (
            <button
                key={index}
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                className={itemClass(item)}
                onClick={() => {
                    if (item.disabled) return;
                    close(true);
                    item.onSelect?.();
                }}
            >
                {content}
            </button>
        );
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                tabIndex={tabIndex}
                onClick={(event) => {
                    event.stopPropagation();
                    // detail === 0 → opened from the keyboard: move focus into the menu.
                    focusFirstRef.current = event.detail === 0;
                    setOpenState(!open);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        focusFirstRef.current = true;
                        setOpenState(true);
                    }
                }}
                className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    open && 'bg-muted text-foreground',
                    triggerClassName
                )}
            >
                {children ?? <MoreHorizontal className="h-4 w-4" />}
            </button>
            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        ref={menuRef}
                        role="menu"
                        aria-label={label}
                        onKeyDown={onMenuKeyDown}
                        onClick={(event) => event.stopPropagation()}
                        style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width }}
                        className="fixed z-[70] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl"
                    >
                        {entries.map((entry, index) => {
                            if (entry.type === 'separator') return <div key={index} className="my-1 h-px bg-border" role="separator" />;
                            if (entry.type === 'label') {
                                return (
                                    <p key={index} className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                                        {entry.label}
                                    </p>
                                );
                            }
                            return renderItem(entry, index);
                        })}
                    </div>,
                    document.body
                )}
        </>
    );
}
