'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BillingInfo, BillingStatus } from '@/lib/student-status';
import { STATUS_LABELS } from './lib';

/** Dense form controls used by the student screens (visible keyboard focus, 14px text). */
export const inputClass =
    'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-[#F88022] focus-visible:ring-2 focus-visible:ring-[#F88022]/30 disabled:opacity-60';
export const selectClass = cn(inputClass, 'pr-8 cursor-pointer');
export const textareaClass = cn(inputClass, 'h-auto min-h-[72px] py-2 resize-y leading-relaxed');

export function Field({
    label,
    htmlFor,
    error,
    hint,
    className,
    children,
}: {
    label: React.ReactNode;
    htmlFor?: string;
    error?: string;
    hint?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('space-y-1', className)}>
            <label htmlFor={htmlFor} className="block text-xs font-semibold text-muted-foreground">
                {label}
            </label>
            {children}
            {error ? (
                <p className="text-xs font-medium text-red-500" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p className="text-xs text-muted-foreground">{hint}</p>
            ) : null}
        </div>
    );
}

const STATUS_STYLES: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
    PAUSED: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    INACTIVE: 'bg-muted text-muted-foreground border-border',
};

export function StudentStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
    const key = status || 'ACTIVE';
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                STATUS_STYLES[key] ?? STATUS_STYLES.INACTIVE,
                className
            )}
        >
            <span
                className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    key === 'ACTIVE' ? 'bg-emerald-500' : key === 'PAUSED' ? 'bg-amber-500' : 'bg-muted-foreground/60'
                )}
                aria-hidden
            />
            {STATUS_LABELS[key] ?? key}
        </span>
    );
}

export const BILLING_STYLES: Record<BillingStatus, string> = {
    OVERDUE: 'bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400',
    EXPIRING: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
    PENDING: 'bg-orange-500/10 text-orange-700 border-orange-500/30 dark:text-orange-400',
    OK: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
    NO_PLAN: 'bg-muted text-muted-foreground border-border',
};

export function BillingBadge({ billing, className }: { billing: BillingInfo; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                BILLING_STYLES[billing.status],
                className
            )}
        >
            {billing.label}
        </span>
    );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <kbd
            className={cn(
                'inline-flex min-w-[20px] items-center justify-center rounded border border-border bg-muted px-1 font-sans text-xs font-semibold text-muted-foreground',
                className
            )}
        >
            {children}
        </kbd>
    );
}

export function SectionCard({
    title,
    icon,
    action,
    children,
    className,
    bodyClassName,
}: {
    title: React.ReactNode;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cn('rounded-2xl border border-border bg-card', className)}>
            <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                    {icon}
                    <span className="truncate">{title}</span>
                </h2>
                {action}
            </header>
            <div className={cn('p-4', bodyClassName)}>{children}</div>
        </section>
    );
}

export function InfoRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
        </div>
    );
}

/** Small outline button used in dense toolbars (drawer, side column, bulk bar). */
export const smallButtonClass =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 h-8 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40 disabled:opacity-50 disabled:pointer-events-none';
export const primarySmallButtonClass =
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F88022] px-3 h-8 text-xs font-semibold text-white transition-colors hover:bg-[#F88022]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none';
