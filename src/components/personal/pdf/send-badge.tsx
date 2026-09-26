'use client';

import React from 'react';
import { FileCheck2, FileClock, FileWarning } from 'lucide-react';
import { daysUntil } from '@/components/personal/students/lib';
import { STUDENTS_USE_APP } from '@/lib/features';
import { sendStatus, type SendFields } from '@/lib/plan-send';
import { cn } from '@/lib/utils';

/**
 * "PDF enviado em 26/09" / "Alterado depois do envio" / "PDF ainda não enviado" for an active plan.
 * Not sent is only a warning while the PDF is how students get their plans (no app). With `endDate`,
 * nothing shows once the plan is over: like the dashboard, renewing is the work then.
 */
export function PlanSendBadge({
    plan,
    endDate,
    compact = false,
    className,
}: {
    plan: SendFields;
    endDate?: string | Date | null;
    compact?: boolean;
    className?: string;
}) {
    const daysLeft = endDate ? daysUntil(endDate) : null;
    if (daysLeft !== null && daysLeft < 0) return null;
    const status = sendStatus(plan);
    const warn = status.state === 'CHANGED' || (status.state === 'NOT_SENT' && !STUDENTS_USE_APP);
    const Icon = status.state === 'SENT' ? FileCheck2 : status.state === 'CHANGED' ? FileWarning : FileClock;
    return (
        <span
            title={status.hint}
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold',
                warn ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-border bg-muted text-muted-foreground',
                className
            )}
        >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', status.state === 'SENT' && 'text-emerald-600 dark:text-emerald-400')} aria-hidden />
            {compact ? status.short : status.label}
        </span>
    );
}
