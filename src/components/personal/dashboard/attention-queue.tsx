'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Bell,
    CalendarClock,
    CalendarPlus,
    Check,
    CheckCircle2,
    ClipboardCheck,
    CreditCard,
    Dumbbell,
    Eye,
    EyeOff,
    Loader2,
    MessageCircle,
    Phone,
    TrendingDown,
    User,
    Utensils,
    type LucideIcon,
} from 'lucide-react';
import { Avatar, useDialogs, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { invalidateApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { PLAN_TYPE_LABELS, renewedExpiry } from '@/lib/student-status';
import { personalLinks } from '@/lib/notifications';
import { dayKey, formatRelativeShort, formatShortDate } from '@/components/personal/chat/time-format';
import { firstNameOf } from '@/components/personal/chat/preferences';
import { studentPaths, whatsappHref } from '@/components/personal/chat/contact';
import {
    ATTENTION_CATEGORIES,
    isAtRisk,
    type AttentionCategory,
    type AttentionReason,
    type AttentionSeverity,
} from './attention-rules';
import { ReminderDialog, type ReminderTarget, type ReminderType } from './reminder-dialog';
import type { AttentionItem } from './types';

export type QueueFilter = AttentionCategory | 'ALL';

const INITIAL_ROWS = 10;
const SNOOZE_KEY = 'personal:dashboard-snoozed';

type SnoozeMap = Record<string, { day: string; keys: string[] }>;

const CATEGORY_ICON: Record<AttentionCategory, LucideIcon> = {
    MESSAGES: MessageCircle,
    BILLING: CreditCard,
    INACTIVITY: Dumbbell,
    CHECKIN: ClipboardCheck,
    PLANS: CalendarClock,
};

const REASON_ICON: Partial<Record<AttentionReason['key'], LucideIcon>> = {
    LOW_ADHERENCE: TrendingDown,
    NO_DIET_PLAN: Utensils,
    DIET_PLAN_ENDING: Utensils,
    DIET_PLAN_ENDED: Utensils,
};

const SEVERITY_CHIP: Record<AttentionSeverity, string> = {
    CRITICAL: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
    WARNING: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    INFO: 'border-border bg-muted text-foreground',
};

const SEVERITY_DOT: Record<AttentionSeverity, string> = {
    CRITICAL: 'bg-red-500',
    WARNING: 'bg-amber-500',
    INFO: 'bg-slate-400',
};

const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
    CRITICAL: 'Urgente',
    WARNING: 'Atenção',
    INFO: 'Acompanhar',
};

const STATUS_LABELS: Record<string, string> = { PAUSED: 'Pausado', INACTIVE: 'Inativo' };

const actionClass =
    'inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 lg:min-h-0 lg:min-w-0';
const primaryActionClass =
    'inline-flex items-center gap-1.5 rounded-lg bg-[#F88022] px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#F88022]/90 lg:min-h-0 lg:min-w-0';
const iconActionClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:min-h-0 lg:min-w-0';

const hasCategory = (item: AttentionItem, category: AttentionCategory) =>
    item.reasons.some((reason) => reason.category === category);

const hasReason = (item: AttentionItem, ...keys: AttentionReason['key'][]) =>
    item.reasons.some((reason) => keys.includes(reason.key));

/** Reminder type matching the most severe actionable reason. */
/** "Seu treino já está no app" makes no sense for a student without an active workout plan. */
const lacksWorkoutPlan = (item: AttentionItem) =>
    item.reasons.some((entry) => entry.key === 'NO_WORKOUT_PLAN' || entry.key === 'WORKOUT_PLAN_ENDED');

function reminderTypeFor(item: AttentionItem): ReminderType {
    const reason = item.reasons.find(
        (entry) =>
            entry.category !== 'MESSAGES' &&
            entry.key !== 'NO_WORKOUT_PLAN' &&
            entry.key !== 'WORKOUT_PLAN_ENDED'
    );
    if (!reason) return 'CHECKIN_REMINDER';
    if (reason.category === 'BILLING') return 'PAYMENT_REMINDER';
    if (reason.category === 'CHECKIN' && reason.key !== 'LOW_ADHERENCE') return 'CHECKIN_REMINDER';
    if (reason.key === 'NO_DIET_PLAN' || reason.key === 'DIET_PLAN_ENDING' || reason.key === 'DIET_PLAN_ENDED') return 'MEAL_REMINDER';
    return lacksWorkoutPlan(item) ? 'CHECKIN_REMINDER' : 'WORKOUT_REMINDER';
}

/** Pre-filled WhatsApp text for the most severe reason. */
function whatsappTextFor(item: AttentionItem): string | undefined {
    const first = firstNameOf(item.name);
    const reason = item.reasons.find((entry) => entry.category !== 'MESSAGES');
    if (!reason) return undefined;
    switch (reason.category) {
        case 'BILLING':
            return `Oi ${first}, tudo bem? Passando para lembrar da renovação do seu plano (${reason.label.toLowerCase()}). Vamos renovar para seguir com o acompanhamento? 💪`;
        case 'INACTIVITY':
            return `Oi ${first}, tudo bem? Senti sua falta nos treinos. Como posso te ajudar a retomar o ritmo essa semana? 💪`;
        case 'CHECKIN':
            return reason.key === 'LOW_ADHERENCE'
                ? `Oi ${first}, tudo bem? Vi seu último check-in e quero te ajudar a bater a meta. Precisa de algum ajuste no treino ou na dieta?`
                : `Oi ${first}, tudo bem? Não esqueça de enviar seu check-in no app para eu acompanhar sua evolução! 📋`;
        default:
            return `Oi ${first}, tudo bem? Estou preparando a atualização do seu plano. Como você está se sentindo com o atual?`;
    }
}

/** A student counts as snoozed today only while no new reason shows up. */
const isSnoozed = (item: AttentionItem, snoozed: SnoozeMap, today: string) => {
    const entry = snoozed[item.studentId];
    return Boolean(entry && entry.day === today && item.reasons.every((reason) => entry.keys.includes(reason.key)));
};

function SkeletonRows() {
    return (
        <ul className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, index) => (
                <li key={index} className="flex items-center gap-3 px-3 py-3.5">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                    </div>
                </li>
            ))}
        </ul>
    );
}

interface AttentionQueueProps {
    /** Undefined while loading. */
    items: AttentionItem[] | undefined;
    /** The dashboard could not be loaded (the page shows the error). */
    failed?: boolean;
    filter: QueueFilter;
    onFilterChange: (filter: QueueFilter) => void;
    /** Called after something changed on the server (renewal, payment). */
    onChanged: () => void;
}

export function AttentionQueue({ items, failed, filter, onFilterChange, onChanged }: AttentionQueueProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { confirm } = useDialogs();
    const [snoozed, setSnoozed] = useLocalStorageState<SnoozeMap>(SNOOZE_KEY, {});
    const [expanded, setExpanded] = useState(false);
    const [showSnoozed, setShowSnoozed] = useState(false);
    const [reminder, setReminderState] = useState<{ targets: ReminderTarget[]; type: ReminderType } | null>(null);
    const [isReminderOpen, setIsReminderOpen] = useState(false);
    const [remindedIds, setRemindedIds] = useState<Set<string>>(() => new Set());
    const [busyId, setBusyId] = useState<string | null>(null);
    const [focusedId, setFocusedId] = useState<string | null>(null);

    const today = dayKey(new Date());
    const all = useMemo(() => items ?? [], [items]);
    const active = useMemo(() => all.filter((item) => !isSnoozed(item, snoozed, today)), [all, snoozed, today]);
    const snoozedCount = all.length - active.length;
    const pool = showSnoozed ? all : active;

    const counts = useMemo(() => {
        const result = {} as Record<AttentionCategory, number>;
        ATTENTION_CATEGORIES.forEach(({ key }) => {
            result[key] = active.filter((item) => hasCategory(item, key)).length;
        });
        return result;
    }, [active]);

    const filtered = useMemo(
        () => (filter === 'ALL' ? pool : pool.filter((item) => hasCategory(item, filter))),
        [pool, filter]
    );
    const shown = expanded ? filtered : filtered.slice(0, INITIAL_ROWS);
    const rovingId = shown.some((item) => item.studentId === focusedId) ? focusedId : shown[0]?.studentId ?? null;

    // Bulk reminders go only to students whose training/check-in routine is at risk.
    const bulk = useMemo(() => {
        if (filter !== 'ALL' && filter !== 'INACTIVITY' && filter !== 'CHECKIN') return null;
        const candidates = active.filter((item) =>
            filter === 'ALL'
                ? isAtRisk(item.reasons)
                : filter === 'CHECKIN'
                ? hasReason(item, 'CHECKIN_OVERDUE', 'NO_CHECKIN')
                : hasCategory(item, filter)
        );
        const onlyCheckin = candidates.length > 0 && candidates.every((item) => !hasCategory(item, 'INACTIVITY'));
        const type: ReminderType = filter === 'CHECKIN' || (filter === 'ALL' && onlyCheckin) ? 'CHECKIN_REMINDER' : 'WORKOUT_REMINDER';
        // A workout reminder only goes to students who actually have a workout plan to follow.
        const targets = candidates.filter(
            (item) => !remindedIds.has(item.studentId) && (type !== 'WORKOUT_REMINDER' || !lacksWorkoutPlan(item))
        );
        return {
            targets,
            type,
            label: filter === 'INACTIVITY' ? 'inativos' : filter === 'CHECKIN' ? 'sem check-in' : 'em risco',
        };
    }, [active, filter, remindedIds]);

    const openReminder = (targets: ReminderTarget[], type: ReminderType) => {
        setReminderState({ targets, type });
        setIsReminderOpen(true);
    };

    const snooze = (item: AttentionItem) => {
        setSnoozed((current) => {
            const next: SnoozeMap = {};
            // Drop entries from previous days while writing.
            Object.entries(current).forEach(([id, entry]) => {
                if (entry.day === today) next[id] = entry;
            });
            next[item.studentId] = { day: today, keys: item.reasons.map((reason) => reason.key) };
            return next;
        });
        toast.info(`${firstNameOf(item.name)} oculto até amanhã`, 'Volta antes se aparecer um motivo novo.');
    };

    const unsnooze = (item: AttentionItem) => {
        setSnoozed((current) => {
            const next = { ...current };
            delete next[item.studentId];
            return next;
        });
    };

    const updateBilling = async (item: AttentionItem, payload: Record<string, string>, success: string, detail?: string) => {
        setBusyId(item.studentId);
        try {
            const response = await fetch(`/api/students/${item.studentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Erro ao atualizar o contrato');
            toast.success(success, detail);
            invalidateApi('/api/students');
            onChanged();
        } catch (reason) {
            toast.error('Não foi possível atualizar o contrato', reason instanceof Error ? reason.message : undefined);
        } finally {
            setBusyId(null);
        }
    };

    const renew = async (item: AttentionItem) => {
        if (!item.billing) return;
        const nextExpiry = renewedExpiry(item.billing.planType, item.billing.planExpiresAt);
        const planLabel = PLAN_TYPE_LABELS[(item.billing.planType || 'MENSAL').toUpperCase()] ?? item.billing.planType ?? 'Mensal';
        const confirmed = await confirm({
            title: `Renovar o plano de ${item.name}?`,
            description: `Plano ${planLabel.toLowerCase()}: o novo vencimento será ${formatShortDate(nextExpiry)} e o pagamento fica marcado como recebido.`,
            confirmText: 'Renovar plano',
        });
        if (!confirmed) return;
        // Date-only, like the CRM: the API stores it at noon UTC so it's the same day in every timezone.
        await updateBilling(
            item,
            { planExpiresAt: dayKey(nextExpiry), paymentStatus: 'PAID' },
            'Plano renovado',
            `${firstNameOf(item.name)} agora vence em ${formatShortDate(nextExpiry)}.`
        );
    };

    const markPaid = async (item: AttentionItem) => {
        const confirmed = await confirm({
            title: `Marcar pagamento de ${item.name} como recebido?`,
            description: 'O vencimento do plano não muda.',
            confirmText: 'Marcar como pago',
        });
        if (!confirmed) return;
        await updateBilling(item, { paymentStatus: 'PAID' }, 'Pagamento registrado');
    };

    const primaryAction = (item: AttentionItem) => {
        router.push(item.unansweredMessage ? personalLinks.chat(item.studentId) : studentPaths.crm(item.studentId));
    };

    const focusRow = (studentId: string | undefined) => {
        if (!studentId) return;
        setFocusedId(studentId);
        document.querySelector<HTMLElement>(`[data-queue-row="${CSS.escape(studentId)}"]`)?.focus();
    };

    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, item: AttentionItem, index: number) => {
        if (event.target !== event.currentTarget || event.altKey || event.metaKey || event.ctrlKey) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusRow(shown[index + (event.key === 'ArrowDown' ? 1 : -1)]?.studentId);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            primaryAction(item);
        }
    };

    const filterChips: { key: QueueFilter; label: string; count: number; icon?: LucideIcon }[] = [
        { key: 'ALL', label: 'Todos', count: active.length },
        ...ATTENTION_CATEGORIES.map((category) => ({
            key: category.key as QueueFilter,
            label: category.label,
            count: counts[category.key] ?? 0,
            icon: CATEGORY_ICON[category.key],
        })),
    ];

    return (
        <section className="rounded-2xl border border-border bg-card shadow-sm" aria-labelledby="attention-queue-title">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 id="attention-queue-title" className="text-base font-bold text-foreground">
                        Precisa da sua atenção hoje
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {items === undefined
                            ? failed
                                ? 'Indisponível'
                                : 'Carregando…'
                            : active.length === 0
                                ? 'Nenhum aluno pendente'
                                : `${active.length} ${active.length === 1 ? 'aluno' : 'alunos'} · do mais urgente para o menos urgente`}
                    </p>
                </div>
                {bulk && bulk.targets.length > 0 && (
                    <button
                        type="button"
                        onClick={() =>
                            openReminder(
                                bulk.targets.map((item) => ({ studentId: item.studentId, name: item.name })),
                                bulk.type
                            )
                        }
                        className={cn(actionClass, 'shrink-0 self-start')}
                        title="Enviar um lembrete no app para estes alunos (você confirma antes)"
                    >
                        <Bell className="h-3.5 w-3.5 text-amber-500" />
                        Lembrar {bulk.targets.length} {bulk.label}
                    </button>
                )}
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5" role="tablist" aria-label="Filtrar por motivo">
                {filterChips.map((chip) => {
                    const Icon = chip.icon;
                    const selected = filter === chip.key;
                    return (
                        <button
                            key={chip.key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => {
                                onFilterChange(chip.key);
                                setExpanded(false);
                            }}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors lg:min-h-0 lg:min-w-0',
                                selected ? 'bg-[#F88022]/10 text-[#F88022]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                !selected && chip.count === 0 && chip.key !== 'ALL' && 'opacity-60'
                            )}
                        >
                            {Icon && <Icon className="h-3.5 w-3.5" />}
                            {chip.label}
                            <span className="tabular-nums">{chip.count}</span>
                        </button>
                    );
                })}
            </div>

            {items === undefined && failed ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">Não foi possível carregar a fila de atenção.</p>
            ) : items === undefined ? (
                <SkeletonRows />
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <CheckCircle2 className="h-9 w-9 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">
                        {filter === 'ALL'
                            ? 'Tudo em dia! Nenhum aluno precisa de atenção agora.'
                            : `Nada em ${ATTENTION_CATEGORIES.find((category) => category.key === filter)?.label.toLowerCase()} agora.`}
                    </p>
                    {filter !== 'ALL' && (
                        <button type="button" onClick={() => onFilterChange('ALL')} className="text-sm font-semibold text-[#F88022] hover:underline lg:min-h-0">
                            Ver todos os motivos
                        </button>
                    )}
                </div>
            ) : (
                <ul className="divide-y divide-border">
                    {shown.map((item, index) => {
                        const snoozedNow = isSnoozed(item, snoozed, today);
                        const whatsapp = whatsappHref(item.phone, whatsappTextFor(item));
                        const billing = item.billing;
                        const expired = billing?.daysToExpire !== null && billing?.daysToExpire !== undefined && billing.daysToExpire < 0;
                        const canRenew = hasCategory(item, 'BILLING') && (billing?.status === 'EXPIRING' || expired);
                        const canMarkPaid = hasCategory(item, 'BILLING') && !canRenew;
                        const hasReminderReason = item.reasons.some(
                            (reason) =>
                                reason.category !== 'MESSAGES' &&
                                reason.key !== 'NO_WORKOUT_PLAN' &&
                                reason.key !== 'WORKOUT_PLAN_ENDED'
                        );
                        const reminded = remindedIds.has(item.studentId);
                        const busy = busyId === item.studentId;

                        return (
                            <li key={item.studentId} className={cn(snoozedNow && 'opacity-60')}>
                                <div
                                    data-queue-row={item.studentId}
                                    tabIndex={item.studentId === rovingId ? 0 : -1}
                                    onFocus={(event) => {
                                        if (event.target === event.currentTarget) setFocusedId(item.studentId);
                                    }}
                                    onKeyDown={(event) => handleRowKeyDown(event, item, index)}
                                    aria-label={`${item.name}: ${item.reasons.map((reason) => reason.label).join(', ')}`}
                                    className="flex flex-col gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#F88022]/50 lg:flex-row lg:items-start"
                                >
                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                        <div className="relative shrink-0">
                                            <Avatar src={item.avatar ?? undefined} name={item.name} size="md" />
                                            <span
                                                className={cn('absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card', SEVERITY_DOT[item.severity])}
                                                title={SEVERITY_LABEL[item.severity]}
                                                aria-hidden
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <Link
                                                    href={studentPaths.crm(item.studentId)}
                                                    className="truncate text-sm font-semibold text-foreground hover:text-[#F88022] lg:min-h-0 lg:min-w-0"
                                                    title="Abrir no CRM"
                                                >
                                                    {item.name}
                                                </Link>
                                                <span className="text-xs text-muted-foreground">{SEVERITY_LABEL[item.severity]}</span>
                                                {STATUS_LABELS[item.status] && (
                                                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                                        {STATUS_LABELS[item.status]}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {item.reasons.map((reason) => {
                                                    const Icon = REASON_ICON[reason.key] ?? CATEGORY_ICON[reason.category];
                                                    return (
                                                        <span
                                                            key={reason.key}
                                                            className={cn(
                                                                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                                                                SEVERITY_CHIP[reason.severity]
                                                            )}
                                                        >
                                                            <Icon className="h-3 w-3 shrink-0" />
                                                            {reason.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            {item.unansweredMessage && (
                                                <p className="mt-1.5 truncate text-sm text-muted-foreground">
                                                    “{item.unansweredMessage.text}”
                                                    <span className="ml-1.5 text-xs">· {formatRelativeShort(item.unansweredMessage.createdAt)}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 pl-[52px] lg:max-w-[55%] lg:justify-end lg:pl-0">
                                        {item.unansweredMessage && (
                                            <Link href={personalLinks.chat(item.studentId)} className={primaryActionClass}>
                                                <MessageCircle className="h-3.5 w-3.5" />
                                                Responder
                                            </Link>
                                        )}
                                        {canRenew && (
                                            <button type="button" onClick={() => void renew(item)} disabled={busy} className={actionClass}>
                                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5 text-emerald-500" />}
                                                Renovar
                                            </button>
                                        )}
                                        {canMarkPaid && (
                                            <button type="button" onClick={() => void markPaid(item)} disabled={busy} className={actionClass}>
                                                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-500" />}
                                                Marcar pago
                                            </button>
                                        )}
                                        {hasReminderReason && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openReminder([{ studentId: item.studentId, name: item.name }], reminderTypeFor(item))
                                                }
                                                className={cn(actionClass, reminded && 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400')}
                                                title="Enviar notificação no app do aluno"
                                            >
                                                {reminded ? <Check className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5 text-amber-500" />}
                                                {reminded ? 'Lembrete enviado' : 'Lembrete'}
                                            </button>
                                        )}
                                        {hasReason(item, 'NO_WORKOUT_PLAN', 'WORKOUT_PLAN_ENDING', 'WORKOUT_PLAN_ENDED') && (
                                            <Link href={studentPaths.workoutEditor(item.studentId)} className={actionClass}>
                                                <Dumbbell className="h-3.5 w-3.5 text-[#F88022]" />
                                                Treino
                                            </Link>
                                        )}
                                        {hasReason(item, 'NO_DIET_PLAN', 'DIET_PLAN_ENDING', 'DIET_PLAN_ENDED') && (
                                            <Link href={studentPaths.dietEditor(item.studentId)} className={actionClass}>
                                                <Utensils className="h-3.5 w-3.5 text-emerald-500" />
                                                Dieta
                                            </Link>
                                        )}
                                        {whatsapp && (
                                            <a
                                                href={whatsapp}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn(iconActionClass, 'hover:text-emerald-600')}
                                                title="Abrir no WhatsApp com mensagem pronta"
                                                aria-label={`WhatsApp de ${item.name}`}
                                            >
                                                <Phone className="h-4 w-4" />
                                            </a>
                                        )}
                                        <Link
                                            href={personalLinks.student(item.studentId)}
                                            className={iconActionClass}
                                            title="Abrir ficha do aluno"
                                            aria-label={`Abrir ficha de ${item.name}`}
                                        >
                                            <User className="h-4 w-4" />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => (snoozedNow ? unsnooze(item) : snooze(item))}
                                            className={iconActionClass}
                                            title={snoozedNow ? 'Mostrar de novo' : 'Ocultar até amanhã'}
                                            aria-label={snoozedNow ? `Mostrar ${item.name} de novo` : `Ocultar ${item.name} até amanhã`}
                                        >
                                            {snoozedNow ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {items !== undefined && (filtered.length > INITIAL_ROWS || snoozedCount > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
                    {filtered.length > INITIAL_ROWS ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((current) => !current)}
                            className="text-sm font-semibold text-[#F88022] hover:underline lg:min-h-0"
                        >
                            {expanded ? 'Mostrar menos' : `Ver todos (${filtered.length})`}
                        </button>
                    ) : (
                        <span />
                    )}
                    {snoozedCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowSnoozed((current) => !current)}
                            className="text-xs font-medium text-muted-foreground hover:text-foreground lg:min-h-0"
                        >
                            {showSnoozed
                                ? 'Esconder ocultos'
                                : `${snoozedCount} ${snoozedCount === 1 ? 'oculto' : 'ocultos'} hoje · mostrar`}
                        </button>
                    )}
                </div>
            )}

            <ReminderDialog
                open={isReminderOpen}
                onOpenChange={setIsReminderOpen}
                targets={reminder?.targets ?? []}
                defaultType={reminder?.type ?? 'WORKOUT_REMINDER'}
                onSent={(ids) =>
                    setRemindedIds((current) => {
                        const next = new Set(current);
                        ids.forEach((id) => next.add(id));
                        return next;
                    })
                }
            />
        </section>
    );
}
