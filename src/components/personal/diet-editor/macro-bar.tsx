'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { parseTarget, type EditorTargets, type MacroKey, type MacroTotals } from './model';
import { formatGrams, formatInteger, formatKcal } from './units';

type MacroStatus = 'none' | 'ok' | 'under' | 'over';

const TOLERANCE = 0.05;

function macroStatus(actual: number, target: number | null): MacroStatus {
    if (!target) return 'none';
    const ratio = actual / target;
    if (Math.abs(ratio - 1) <= TOLERANCE) return 'ok';
    return ratio < 1 ? 'under' : 'over';
}

const statusText: Record<MacroStatus, string> = {
    none: 'text-muted-foreground',
    ok: 'text-emerald-600 dark:text-emerald-400',
    under: 'text-amber-600 dark:text-amber-400',
    over: 'text-red-600 dark:text-red-400',
};

const statusBar: Record<MacroStatus, string> = {
    none: 'bg-muted-foreground/40',
    ok: 'bg-emerald-500',
    under: 'bg-amber-500',
    over: 'bg-red-500',
};

const METRICS: { key: MacroKey; label: string; unit: string }[] = [
    { key: 'calories', label: 'Calorias', unit: 'kcal' },
    { key: 'protein', label: 'Proteína', unit: 'g' },
    { key: 'carbs', label: 'Carboidrato', unit: 'g' },
    { key: 'fat', label: 'Gordura', unit: 'g' },
];

function Metric({ label, unit, actual, target, isKcal, compact }: { label: string; unit: string; actual: number; target: number | null; isKcal: boolean; compact: boolean }) {
    const status = macroStatus(actual, target);
    const format = isKcal ? formatKcal : formatGrams;
    const diff = target ? actual - target : 0;
    const width = target ? Math.min(actual / target, 1) * 100 : 0;
    const statusLabel =
        status === 'ok' ? 'dentro da meta' : status === 'under' ? 'abaixo da meta' : status === 'over' ? 'acima da meta' : 'sem meta';

    return (
        <div className="min-w-0" title={target ? `${label}: ${format(actual)} de ${format(target)} ${unit} (${statusLabel})` : `${label}: ${format(actual)} ${unit} (sem meta definida)`}>
            <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                {target ? (
                    <span className={cn('text-xs font-semibold tabular-nums', statusText[status])}>
                        {status === 'ok' ? '✓' : `${diff > 0 ? '+' : '−'}${isKcal ? formatInteger(Math.abs(diff)) : formatGrams(Math.abs(diff))}`}
                    </span>
                ) : null}
            </div>
            <p className="truncate tabular-nums leading-tight">
                <span className={cn('font-bold text-foreground', compact ? 'text-base' : 'text-lg')}>{format(actual)}</span>
                <span className="text-xs text-muted-foreground">
                    {' '}
                    / {target ? format(target) : '—'} {unit}
                </span>
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className={cn('h-full rounded-full transition-[width] duration-300', statusBar[status])} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
}

interface MacroBarProps {
    totals: MacroTotals;
    targets: EditorTargets;
    compact: boolean;
    /** Área à direita (status de salvamento e botões). */
    children?: React.ReactNode;
}

export function MacroBar({ totals, targets, compact, children }: MacroBarProps) {
    const energy = totals.protein * 4 + totals.carbs * 4 + totals.fat * 9;
    const share = (grams: number, factor: number) => (energy > 0 ? Math.round(((grams * factor) / energy) * 100) : 0);

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-2xl border border-border bg-card/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/85 lg:flex-row lg:items-center',
                compact ? 'py-2 shadow-lg' : 'py-3 shadow-sm'
            )}
        >
            <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
                {METRICS.map((metric) => (
                    <Metric
                        key={metric.key}
                        label={metric.label}
                        unit={metric.unit}
                        actual={totals[metric.key]}
                        target={parseTarget(targets[metric.key])}
                        isKcal={metric.key === 'calories'}
                        compact={compact}
                    />
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">
                {!compact && energy > 0 && (
                    <p className="text-xs tabular-nums text-muted-foreground" title="Distribuição das calorias entre os macronutrientes">
                        P {share(totals.protein, 4)}% · C {share(totals.carbs, 4)}% · G {share(totals.fat, 9)}%
                    </p>
                )}
                {children}
            </div>
        </div>
    );
}

/**
 * Mantém o conteúdo visível logo abaixo do cabeçalho enquanto a página rola.
 * Usa `position: sticky` nativo com IntersectionObserver para alternar o modo compacto.
 */
export function FloatingBar({ children }: { children: (floating: boolean) => React.ReactNode }) {
    const sentinelRef = useRef<HTMLDivElement>(null);
    const [floating, setFloating] = useState(false);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setFloating(!entry.isIntersecting);
            },
            { rootMargin: '-72px 0px 0px 0px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    // A fragment on purpose: a sticky element can't leave its parent, so the bar must be a direct child
    // of the editor's (tall) container. The zero-height marker sits right above it; -mb-4 cancels the
    // container's space-y gap so the layout doesn't shift.
    return (
        <>
            <div ref={sentinelRef} className="-mb-4 h-0" aria-hidden />
            <div className="sticky top-[4.5rem] z-20">{children(floating)}</div>
        </>
    );
}
