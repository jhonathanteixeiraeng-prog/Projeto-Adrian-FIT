'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    BellRing,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Dumbbell,
    FileText,
    MessageCircle,
    Pencil,
    Phone,
    RefreshCw,
    Trash2,
    User,
    Utensils,
    X,
} from 'lucide-react';
import { Avatar, useDialogs, useToast } from '@/components/ui';
import { CHECKIN_EXPECTED_DAYS, renewedExpiry } from '@/lib/student-status';
import { cn } from '@/lib/utils';
import { ContractForm } from './contract-form';
import type { CrmRow } from './crm';
import { billingWhatsappUrl } from './crm';
import {
    PAYMENT_LABELS,
    STATUS_OPTIONS,
    errorMessage,
    formatBRL,
    formatDate,
    formatNumber,
    planEndInfo,
    planLabel,
    planMonths,
    planPeriodLabel,
    relativeDaysLabel,
    removeStudentFromCaches,
    requestJson,
    toDateInputValue,
    toneText,
    updateStudent,
    whatsappUrl,
} from './lib';
import type { StudentPatch } from './types';
import { BillingBadge, Kbd, StudentStatusBadge, primarySmallButtonClass, smallButtonClass } from './ui';

interface StudentDrawerProps {
    row: CrmRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    position: { index: number; total: number } | null;
    onPrev: (() => void) | null;
    onNext: (() => void) | null;
    onRemind: (row: CrmRow) => void;
    onDeleted: (id: string) => void;
}

const NAVIGATION_KEYS = new Set(['j', 'k', 'x', 'arrowup', 'arrowdown']);

const quickLinkClass =
    'flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-1 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

/**
 * Right-side sheet with the essentials of one student. Non-modal on purpose: the list stays usable,
 * clicking another row switches the student, J/K (or ↑/↓) walk the current list, Esc closes.
 */
export function StudentDrawer({ row, open, onOpenChange, position, onPrev, onNext, onRemind, onDeleted }: StudentDrawerProps) {
    const { toast } = useToast();
    const { confirm } = useDialogs();
    const contentRef = useRef<HTMLDivElement>(null);
    const [editingContract, setEditingContract] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    const studentId = row?.id;
    useEffect(() => {
        setEditingContract(false);
        setBusy(null);
    }, [studentId]);

    const save = async (patch: StudentPatch, success: string, description?: string) => {
        if (!row) return;
        const updated = await updateStudent(row.id, patch);
        toast.success(success, description);
        return updated;
    };

    const run = async (key: string, action: () => Promise<unknown>) => {
        try {
            setBusy(key);
            await action();
        } catch (error) {
            toast.error('Não foi possível salvar', errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    const markPaid = () =>
        run('paid', async () => {
            if (!row) return;
            await save({ paymentStatus: 'PAID' }, 'Pagamento registrado', row.name);
            if (row.billing.daysToExpire !== null && row.billing.daysToExpire < 0) {
                toast.info('O plano continua vencido', 'Use "Renovar" para avançar o vencimento.');
            }
        });

    const renew = async () => {
        if (!row) return;
        const next = renewedExpiry(row.student.planType, row.student.planExpiresAt);
        const ok = await confirm({
            title: `Renovar o plano de ${row.name}?`,
            description: `Vencimento: ${formatDate(row.student.planExpiresAt, 'sem data')} → ${formatDate(next)} (plano ${planLabel(row.student.planType).toLowerCase()}, ${planPeriodLabel(row.student.planType)}). O pagamento fica registrado como pago.`,
            confirmText: 'Renovar',
        });
        if (!ok) return;
        await run('renew', () =>
            save({ planExpiresAt: toDateInputValue(next), paymentStatus: 'PAID' }, 'Plano renovado', `Novo vencimento: ${formatDate(next)}`)
        );
    };

    const setStatus = (status: string) =>
        run(`status-${status}`, async () => {
            if (!row || row.status === status) return;
            const label = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
            await save({ status }, `Status alterado para ${label}`, row.name);
        });

    const remove = async () => {
        if (!row) return;
        const ok = await confirm({
            title: `Excluir ${row.name}?`,
            description: 'Remove o aluno com treinos, dietas, check-ins e fotos. Esta ação não pode ser desfeita. Para apenas interromper o acompanhamento, prefira "Inativo".',
            confirmText: 'Excluir aluno',
            variant: 'danger',
        });
        if (!ok) return;
        await run('delete', async () => {
            await requestJson(`/api/students/${row.id}`, { method: 'DELETE' });
            removeStudentFromCaches(row.id);
            toast.success('Aluno excluído', row.name);
            onDeleted(row.id);
        });
    };

    const lastCheckin = row?.lastCheckin ?? null;
    const workoutEnd = planEndInfo(row?.workout?.endDate);
    const dietEnd = planEndInfo(row?.diet?.endDate);
    const whatsapp = row ? whatsappUrl(row.phone) : null;
    const billingMessageUrl = row && row.billingAlert ? billingWhatsappUrl(row) : null;
    const lastWorkoutTone =
        row?.status !== 'ACTIVE' ? 'muted' : row.lastWorkoutDays === null || row.lastWorkoutDays >= 3 ? 'danger' : 'ok';
    const checkinTone = row?.lastCheckinDays == null ? 'muted' : row.lastCheckinDays >= CHECKIN_EXPECTED_DAYS ? 'warn' : 'ok';

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Content
                    ref={contentRef}
                    data-student-drawer=""
                    tabIndex={-1}
                    aria-describedby={undefined}
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        contentRef.current?.focus({ preventScroll: true });
                    }}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    onInteractOutside={(event) => {
                        // Rows (switch student), the bulk bar, toasts and dialogs opened from here keep the drawer open.
                        const target = event.target as HTMLElement | null;
                        if (target?.closest?.('[data-crm-keep-drawer], [aria-live], [role="dialog"], [role="alertdialog"]')) {
                            event.preventDefault();
                        }
                    }}
                    className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl outline-none sm:w-[460px] animate-[studentDrawerIn_180ms_ease-out]"
                >
                    <style>{'@keyframes studentDrawerIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}'}</style>
                    {row ? (
                        <>
                            <header className="space-y-3 border-b border-border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => onPrev?.()}
                                            disabled={!onPrev}
                                            className={cn(smallButtonClass, 'w-8 px-0')}
                                            title="Aluno anterior (K)"
                                            aria-label="Aluno anterior"
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onNext?.()}
                                            disabled={!onNext}
                                            className={cn(smallButtonClass, 'w-8 px-0')}
                                            title="Próximo aluno (J)"
                                            aria-label="Próximo aluno"
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                        {position && (
                                            <span className="ml-1 text-xs font-medium text-muted-foreground">
                                                {position.index + 1} de {position.total}
                                            </span>
                                        )}
                                    </div>
                                    <DialogPrimitive.Close
                                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                        aria-label="Fechar painel (Esc)"
                                        title="Fechar (Esc)"
                                    >
                                        <X className="h-4 w-4" />
                                    </DialogPrimitive.Close>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Avatar name={row.name} src={row.student.user?.avatar || undefined} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <DialogPrimitive.Title className="truncate text-lg font-bold leading-tight text-foreground">
                                            {row.name}
                                        </DialogPrimitive.Title>
                                        <p className="truncate text-sm text-muted-foreground">{row.email}</p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <StudentStatusBadge status={row.status} />
                                            {row.status === 'INACTIVE' && row.billing.status === 'OVERDUE' ? null : (
                                                <BillingBadge billing={row.billing} />
                                            )}
                                            {row.phone && (
                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Phone className="h-3 w-3" />
                                                    {row.phone}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <nav className="grid grid-cols-6 gap-1.5" aria-label="Atalhos do aluno">
                                    <Link href={`/personal/students/${row.id}`} className={quickLinkClass}>
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        Ficha
                                    </Link>
                                    <Link href={`/personal/students/${row.id}/workout`} className={quickLinkClass}>
                                        <Dumbbell className="h-4 w-4 text-muted-foreground" />
                                        Treino
                                    </Link>
                                    <Link href={`/personal/students/${row.id}/diet`} className={quickLinkClass}>
                                        <Utensils className="h-4 w-4 text-muted-foreground" />
                                        Dieta
                                    </Link>
                                    <Link href={`/personal/chat/${row.id}`} className={quickLinkClass}>
                                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                                        Chat
                                    </Link>
                                    {whatsapp ? (
                                        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={quickLinkClass}>
                                            <Phone className="h-4 w-4 text-emerald-600" />
                                            WhatsApp
                                        </a>
                                    ) : (
                                        <span className={cn(quickLinkClass, 'cursor-not-allowed opacity-40')} title="Aluno sem telefone cadastrado">
                                            <Phone className="h-4 w-4" />
                                            WhatsApp
                                        </span>
                                    )}
                                    <Link href={`/personal/students/${row.id}/report`} className={quickLinkClass}>
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        Relatório
                                    </Link>
                                </nav>
                            </header>

                            <div className="flex-1 space-y-5 overflow-y-auto p-4">
                                <section aria-labelledby="drawer-contract">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 id="drawer-contract" className="text-xs font-medium text-muted-foreground">
                                            Contrato
                                        </h3>
                                        {!editingContract && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingContract(true)}
                                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                            >
                                                <Pencil className="h-3 w-3" />
                                                Editar
                                            </button>
                                        )}
                                    </div>
                                    {editingContract ? (
                                        <div
                                            className="rounded-xl border border-border bg-background/60 p-3"
                                            onKeyDown={(event) => {
                                                // Don't switch students (J/K/↑/↓) while the contract is being edited.
                                                if (NAVIGATION_KEYS.has(event.key.toLowerCase())) event.stopPropagation();
                                            }}
                                        >
                                            <ContractForm
                                                key={row.id}
                                                idPrefix="drawer-contract"
                                                student={row.student}
                                                autoFocus
                                                onCancel={() => setEditingContract(false)}
                                                onSubmit={async (patch) => {
                                                    await save(patch, 'Contrato atualizado', row.name);
                                                    setEditingContract(false);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
                                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Plano</dt>
                                                    <dd className="font-semibold text-foreground">{planLabel(row.student.planType)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Valor</dt>
                                                    <dd className="font-semibold text-foreground">
                                                        {formatBRL(row.student.planValue)}
                                                        {row.monthly !== null && planMonths(row.student.planType) > 1 && (
                                                            <span className="block text-xs font-normal text-muted-foreground">
                                                                {formatBRL(row.monthly)}/mês
                                                            </span>
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Vencimento</dt>
                                                    <dd className="font-semibold text-foreground">{formatDate(row.student.planExpiresAt)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Pagamento</dt>
                                                    <dd className="font-semibold text-foreground">
                                                        {row.student.paymentStatus
                                                            ? PAYMENT_LABELS[row.student.paymentStatus] ?? row.student.paymentStatus
                                                            : 'Não informado'}
                                                    </dd>
                                                </div>
                                            </dl>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={markPaid}
                                                    disabled={busy !== null || row.student.paymentStatus === 'PAID'}
                                                    className={smallButtonClass}
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                                    Marcar pago
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={renew}
                                                    disabled={busy !== null}
                                                    className={row.billing.status === 'OVERDUE' || row.billing.status === 'EXPIRING' ? primarySmallButtonClass : smallButtonClass}
                                                >
                                                    <RefreshCw className={cn('h-3.5 w-3.5', busy === 'renew' && 'animate-spin')} />
                                                    Renovar +1 período
                                                </button>
                                                {billingMessageUrl && (
                                                    <a href={billingMessageUrl} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
                                                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                                        Cobrar no WhatsApp
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section aria-labelledby="drawer-status">
                                    <h3 id="drawer-status" className="mb-2 text-xs font-medium text-muted-foreground">
                                        Status do aluno
                                    </h3>
                                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-labelledby="drawer-status">
                                        {STATUS_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={row.status === option.value}
                                                onClick={() => setStatus(option.value)}
                                                disabled={busy !== null}
                                                className={cn(
                                                    'rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                                    row.status === option.value
                                                        ? 'bg-card text-foreground shadow-sm'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                <section aria-labelledby="drawer-activity" className="space-y-2">
                                    <h3 id="drawer-activity" className="text-xs font-medium text-muted-foreground">
                                        Atividade
                                    </h3>
                                    <div className="divide-y divide-border rounded-xl border border-border bg-background/60 text-sm">
                                        <div className="flex items-start justify-between gap-3 p-3">
                                            <span className="text-muted-foreground">Último treino</span>
                                            <span className="text-right">
                                                <span className={cn('font-semibold', toneText[lastWorkoutTone])}>
                                                    {row.lastWorkoutDays === null ? 'Nunca treinou' : relativeDaysLabel(row.lastWorkoutDays)}
                                                </span>
                                                {row.lastWorkoutName && (
                                                    <span className="block text-xs text-muted-foreground">{row.lastWorkoutName}</span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-start justify-between gap-3 p-3">
                                            <span className="text-muted-foreground">Último check-in</span>
                                            {lastCheckin ? (
                                                <span className="text-right">
                                                    <span className={cn('font-semibold', toneText[checkinTone])}>
                                                        {formatDate(lastCheckin.date)} · {relativeDaysLabel(row.lastCheckinDays).toLowerCase()}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {formatNumber(lastCheckin.weight, ' kg')} · treino {lastCheckin.workoutAdherence}% · dieta{' '}
                                                        {lastCheckin.dietAdherence}%
                                                    </span>
                                                </span>
                                            ) : (
                                                <span className="font-semibold text-muted-foreground">Sem check-in</span>
                                            )}
                                        </div>
                                        <div className="flex items-start justify-between gap-3 p-3">
                                            <span className="text-muted-foreground">Treino ativo</span>
                                            {row.workout ? (
                                                <span className="min-w-0 text-right">
                                                    <Link
                                                        href={`/personal/students/${row.id}/workout`}
                                                        className="block truncate font-semibold text-foreground hover:text-primary"
                                                    >
                                                        {row.workout.title}
                                                    </Link>
                                                    {workoutEnd && <span className={cn('block text-xs', toneText[workoutEnd.tone])}>{workoutEnd.label}</span>}
                                                </span>
                                            ) : (
                                                <Link href={`/personal/students/${row.id}/workout`} className="text-xs font-semibold text-primary hover:underline">
                                                    Sem treino · Prescrever
                                                </Link>
                                            )}
                                        </div>
                                        <div className="flex items-start justify-between gap-3 p-3">
                                            <span className="text-muted-foreground">Dieta ativa</span>
                                            {row.diet ? (
                                                <span className="min-w-0 text-right">
                                                    <Link
                                                        href={`/personal/students/${row.id}/diet`}
                                                        className="block truncate font-semibold text-foreground hover:text-primary"
                                                    >
                                                        {row.diet.title}
                                                    </Link>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {row.diet.calories ? `${row.diet.calories} kcal` : 'Sem meta calórica'}
                                                        {dietEnd && <span className={toneText[dietEnd.tone]}> · {dietEnd.label}</span>}
                                                    </span>
                                                </span>
                                            ) : (
                                                <Link href={`/personal/students/${row.id}/diet`} className="text-xs font-semibold text-primary hover:underline">
                                                    Sem dieta · Criar
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <footer className="space-y-2 border-t border-border p-3">
                                <div className="flex items-center gap-1.5">
                                    <button type="button" onClick={() => onRemind(row)} className={smallButtonClass}>
                                        <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                                        Enviar lembrete
                                    </button>
                                    <Link href={`/personal/students/${row.id}`} className={cn(primarySmallButtonClass, 'flex-1')}>
                                        Abrir ficha completa
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={remove}
                                        disabled={busy !== null}
                                        className={cn(smallButtonClass, 'w-8 px-0 text-red-500 hover:bg-red-500/10')}
                                        title="Excluir aluno"
                                        aria-label="Excluir aluno"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                                    <Kbd>J</Kbd>
                                    <Kbd>K</Kbd> ou <Kbd>↑</Kbd>
                                    <Kbd>↓</Kbd> trocam de aluno · <Kbd>Esc</Kbd> fecha
                                </p>
                            </footer>
                        </>
                    ) : (
                        <DialogPrimitive.Title className="sr-only">Aluno</DialogPrimitive.Title>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
