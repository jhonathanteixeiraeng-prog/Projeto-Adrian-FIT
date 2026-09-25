'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MenuEntry =
    | {
        type?: 'item';
        key: string;
        label: string;
        icon?: LucideIcon;
        onSelect?: () => void;
        href?: string;
        danger?: boolean;
        disabled?: boolean;
        hint?: string;
    }
    | { type: 'separator'; key: string }
    | { type: 'label'; key: string; label: string };

interface DropdownMenuProps {
    items: MenuEntry[];
    /** Conteúdo do botão que abre o menu. */
    children: React.ReactNode;
    label: string;
    align?: 'left' | 'right';
    className?: string;
    buttonClassName?: string;
    menuClassName?: string;
    disabled?: boolean;
}

/**
 * Menu suspenso acessível: fecha ao clicar fora, com Esc (devolvendo o foco ao botão) ou Tab;
 * ↑/↓/Home/End navegam entre os itens. Abre para cima quando não cabe abaixo.
 */
export function DropdownMenu({
    items,
    children,
    label,
    align = 'right',
    className,
    buttonClassName,
    menuClassName,
    disabled,
}: DropdownMenuProps) {
    const [open, setOpen] = useState(false);
    const [placement, setPlacement] = useState<'bottom' | 'top'>('bottom');
    const rootRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    const close = useCallback((restoreFocus: boolean) => {
        setOpen(false);
        if (restoreFocus) buttonRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close(true);
            }
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [open, close]);

    useLayoutEffect(() => {
        if (!open) return;
        const menu = menuRef.current;
        const button = buttonRef.current;
        if (!menu || !button) return;
        const buttonRect = button.getBoundingClientRect();
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        setPlacement(spaceBelow < menu.offsetHeight + 12 && buttonRect.top > spaceBelow ? 'top' : 'bottom');
        menu.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    }, [open]);

    const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        const menuItems = Array.from(
            menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []
        );
        if (menuItems.length === 0) return;
        const index = menuItems.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            menuItems[(index + 1) % menuItems.length]?.focus();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            menuItems[(index - 1 + menuItems.length) % menuItems.length]?.focus();
        } else if (event.key === 'Home') {
            event.preventDefault();
            menuItems[0]?.focus();
        } else if (event.key === 'End') {
            event.preventDefault();
            menuItems[menuItems.length - 1]?.focus();
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    };

    const itemClass = (danger?: boolean, disabledItem?: boolean) =>
        cn(
            'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors focus:outline-none',
            danger ? 'text-red-500 hover:bg-red-500/10 focus:bg-red-500/10' : 'text-foreground hover:bg-muted focus:bg-muted',
            disabledItem && 'pointer-events-none opacity-40'
        );

    return (
        <div ref={rootRef} className={cn('relative inline-flex', className)}>
            <button
                ref={buttonRef}
                type="button"
                aria-label={label}
                title={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                disabled={disabled}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
                className={buttonClassName}
            >
                {children}
            </button>
            {open && (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    onKeyDown={onMenuKeyDown}
                    className={cn(
                        'absolute z-40 min-w-[13rem] max-w-[20rem] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl',
                        align === 'right' ? 'right-0' : 'left-0',
                        placement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
                        menuClassName
                    )}
                >
                    {items.map((entry) => {
                        if (entry.type === 'separator') return <div key={entry.key} role="separator" className="my-1 h-px bg-border" />;
                        if (entry.type === 'label') {
                            return (
                                <p key={entry.key} className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {entry.label}
                                </p>
                            );
                        }
                        const Icon = entry.icon;
                        const content = (
                            <>
                                {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}
                                <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                                {entry.hint && <span className="shrink-0 text-xs text-muted-foreground">{entry.hint}</span>}
                            </>
                        );
                        if (entry.href && !entry.disabled) {
                            return (
                                <Link
                                    key={entry.key}
                                    href={entry.href}
                                    role="menuitem"
                                    tabIndex={-1}
                                    onClick={() => setOpen(false)}
                                    className={itemClass(entry.danger)}
                                >
                                    {content}
                                </Link>
                            );
                        }
                        return (
                            <button
                                key={entry.key}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                aria-disabled={entry.disabled || undefined}
                                onClick={() => {
                                    if (entry.disabled) return;
                                    close(false);
                                    entry.onSelect?.();
                                }}
                                className={itemClass(entry.danger, entry.disabled)}
                            >
                                {content}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
