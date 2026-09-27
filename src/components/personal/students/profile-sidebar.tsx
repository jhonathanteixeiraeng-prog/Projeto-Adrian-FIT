'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import {
    BellRing,
    CheckCircle2,
    Copy,
    CreditCard,
    Dumbbell,
    FileText,
    HeartPulse,
    KeyRound,
    Mail,
    MessageCircle,
    Pencil,
    Phone,
    RefreshCw,
    Trash2,
    UserPlus,
    Utensils,
    Zap,
} from 'lucide-react';
import { useDialogs, useToast } from '@/components/ui';
import { invalidateApi } from '@/hooks/use-api';
import { STUDENTS_USE_APP } from '@/lib/features';
import { usesStudentApp } from '@/lib/student-app';
import { contactEmail, hasAppAccess } from '@/lib/student-access';
import { getBillingInfo, renewedExpiry } from '@/lib/student-status';
import { cn } from '@/lib/utils';
import {
    ACTIVITY_LEVEL_LABELS,
    PAYMENT_LABELS,
    STATUS_OPTIONS,
    errorMessage,
    formatBRL,
    formatDate,
    monthlyLabel,
    planLabel,
    planPeriodLabel,
    toDateInputValue,
    updateStudent,
    whatsappUrl,
} from './lib';
import type { StudentProfile } from './types';
import { BillingBadge, InfoRow, SectionCard, primarySmallButtonClass, smallButtonClass } from './ui';

const editButtonClass =
    'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function ContactCard({
    student,
    onCreateAccess,
    onChanged,
}: {
    student: StudentProfile;
    onCreateAccess?: () => void;
    /** After the "Usa a área do aluno" switch was saved. */
    onChanged?: () => void;
}) {
    const { toast } = useToast();
    const whatsapp = whatsappUrl(student.user.phone);
    const email = contactEmail(student.user.email);
    const [savingApp, setSavingApp] = useState(false);
    const canLogIn = hasAppAccess(student.user.email);
    const appSwitchId = useId();

    /** Phase 2 pilot: the student starts (or stops) using the student area. */
    const toggleApp = async () => {
        const next = !student.usesApp;
        setSavingApp(true);
        try {
            const response = await fetch(`/api/students/${student.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usesApp: next }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Tente de novo.');
            toast.success(
                next ? 'Agora usa a área do aluno' : 'Não usa mais a área do aluno',
                next
                    ? 'Recebe os avisos de plano novo e aparece nos alertas de atividade e no chat.'
                    : 'Os planos voltam a ir só em PDF pelo WhatsApp.'
            );
            // The chat and the app alerts show while some student uses the student area.
            invalidateApi('/api/personal/notifications');
            invalidateApi('/api/dashboard');
            onChanged?.();
        } catch (error) {
            toast.error('Não foi possível alterar', error instanceof Error ? error.message : undefined);
        } finally {
            setSavingApp(false);
        }
    };
    const copy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copiado`);
        } catch {
            toast.error('Não foi possível copiar');
        }
    };
    return (
        <SectionCard title="Contato" icon={<Phone className="h-4 w-4 text-emerald-500" />}>
            <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {email ? (
                        <>
                            <a href={`mailto:${email}`} className="min-w-0 flex-1 truncate text-foreground hover:text-primary">
                                {email}
                            </a>
                            <button type="button" onClick={() => copy(email, 'E-mail')} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Copiar e-mail">
                                <Copy className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="min-w-0 flex-1 text-muted-foreground">Sem acesso ao app</span>
                            {onCreateAccess && (
                                <button type="button" onClick={onCreateAccess} className={editButtonClass}>
                                    Criar acesso
                                </button>
                            )}
                        </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    {student.user.phone ? (
                        <>
                            <span className="min-w-0 flex-1 truncate text-foreground">{student.user.phone}</span>
                            <button type="button" onClick={() => copy(student.user.phone!, 'Telefone')} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Copiar telefone">
                                <Copy className="h-3.5 w-3.5" />
                            </button>
                        </>
                    ) : (
                        <span className="text-muted-foreground">Sem telefone</span>
                    )}
                </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                {whatsapp ? (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cn(smallButtonClass, 'border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400')}>
                        <Phone className="h-3.5 w-3.5" />
                        WhatsApp
                    </a>
                ) : (
                    <span className={cn(smallButtonClass, 'cursor-not-allowed opacity-50')} title="Cadastre o telefone para usar o WhatsApp">
                        <Phone className="h-3.5 w-3.5" />
                        WhatsApp
                    </span>
                )}
                {usesStudentApp(student) && (
                    <Link href={`/personal/chat/${student.id}`} className={smallButtonClass}>
                        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        Chat no app
                    </Link>
                )}
            </div>
            {/* Phase 2 pilot (while STUDENTS_USE_APP is off, the trainer picks who uses the student area). */}
            {!STUDENTS_USE_APP && (
                <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(student.usesApp)}
                    aria-labelledby={`${appSwitchId}-label`}
                    aria-describedby={`${appSwitchId}-hint`}
                    onClick={() => void toggleApp()}
                    disabled={savingApp || (!student.usesApp && !canLogIn)}
                    className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <span className="min-w-0">
                        <span id={`${appSwitchId}-label`} className="block text-sm font-medium text-foreground">
                            Usa a área do aluno
                        </span>
                        <span id={`${appSwitchId}-hint`} className="block text-xs text-muted-foreground">
                            {student.usesApp
                                ? 'Recebe avisos de plano e aparece nos alertas de atividade.'
                                : canLogIn
                                  ? 'Hoje recebe os planos em PDF pelo WhatsApp.'
                                  : 'Crie o acesso ao app para incluir.'}
                        </span>
                    </span>
                    <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', student.usesApp ? 'bg-emerald-500' : 'bg-muted-foreground/40')}>
                        <span
                            className={cn(
                                'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                                student.usesApp ? 'translate-x-4' : 'translate-x-0'
                            )}
                        />
                    </span>
                </button>
            )}
        </SectionCard>
    );
}

export function ContractCard({ student, onEdit }: { student: StudentProfile; onEdit: () => void }) {
    const { toast } = useToast();
    const { confirm } = useDialogs();
    const [busy, setBusy] = useState<'paid' | 'renew' | null>(null);
    const billing = getBillingInfo(student);
    const monthly = monthlyLabel(student.planType, student.planValue);

    const markPaid = async () => {
        try {
            setBusy('paid');
            await updateStudent(student.id, { paymentStatus: 'PAID' });
            toast.success('Pagamento registrado');
            if (billing.daysToExpire !== null && billing.daysToExpire < 0) {
                toast.info('O plano continua vencido', 'Use "Renovar" para avançar o vencimento.');
            }
        } catch (error) {
            toast.error('Não foi possível salvar', errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    const renew = async () => {
        const next = renewedExpiry(student.planType, student.planExpiresAt);
        const ok = await confirm({
            title: 'Renovar o plano por mais um período?',
            description: `Vencimento: ${formatDate(student.planExpiresAt, 'sem data')} → ${formatDate(next)} (plano ${planLabel(student.planType).toLowerCase()}, ${planPeriodLabel(student.planType)}). O pagamento fica registrado como pago.`,
            confirmText: 'Renovar',
        });
        if (!ok) return;
        try {
            setBusy('renew');
            await updateStudent(student.id, { planExpiresAt: toDateInputValue(next), paymentStatus: 'PAID' });
            toast.success('Plano renovado', `Novo vencimento: ${formatDate(next)}`);
        } catch (error) {
            toast.error('Não foi possível renovar', errorMessage(error));
        } finally {
            setBusy(null);
        }
    };

    return (
        <SectionCard
            title="Contrato"
            icon={<CreditCard className="h-4 w-4 text-muted-foreground" />}
            action={
                <button type="button" onClick={onEdit} className={editButtonClass}>
                    <Pencil className="h-3 w-3" />
                    Editar
                </button>
            }
        >
            <div className="mb-2">
                <BillingBadge billing={billing} />
            </div>
            <div className="divide-y divide-border/60">
                <InfoRow label="Plano">{planLabel(student.planType)}</InfoRow>
                <InfoRow label="Valor">
                    {formatBRL(student.planValue)}
                    {monthly && <span className="block text-xs font-normal text-muted-foreground">{monthly}</span>}
                </InfoRow>
                <InfoRow label="Vencimento">{formatDate(student.planExpiresAt)}</InfoRow>
                <InfoRow label="Pagamento">
                    {student.paymentStatus ? PAYMENT_LABELS[student.paymentStatus] ?? student.paymentStatus : 'Não informado'}
                </InfoRow>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={markPaid} disabled={busy !== null || student.paymentStatus === 'PAID'} className={smallButtonClass}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Marcar pago
                </button>
                <button
                    type="button"
                    onClick={renew}
                    disabled={busy !== null}
                    className={billing.status === 'OVERDUE' || billing.status === 'EXPIRING' ? primarySmallButtonClass : smallButtonClass}
                >
                    <RefreshCw className={cn('h-3.5 w-3.5', busy === 'renew' && 'animate-spin')} />
                    Renovar
                </button>
            </div>
        </SectionCard>
    );
}

export function StatusCard({ student }: { student: StudentProfile }) {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);

    const change = async (status: string) => {
        if (status === student.status) return;
        try {
            setBusy(true);
            await updateStudent(student.id, { status });
            const label = STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
            toast.success(`Status alterado para ${label}`, student.user.name);
        } catch (error) {
            toast.error('Não foi possível alterar o status', errorMessage(error));
        } finally {
            setBusy(false);
        }
    };

    return (
        <SectionCard title="Status do aluno" icon={<Zap className="h-4 w-4 text-muted-foreground" />}>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Status do aluno">
                {STATUS_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={student.status === option.value}
                        disabled={busy}
                        onClick={() => change(option.value)}
                        className={cn(
                            'rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                            student.status === option.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
                {student.status === 'PAUSED'
                    ? 'Pausado: fora da receita mensal e dos alertas de risco.'
                    : student.status === 'INACTIVE'
                        ? 'Inativo: ex-aluno, fora da cobrança e dos alertas.'
                        : 'Ativo: conta na receita mensal e nos alertas de treino.'}
            </p>
        </SectionCard>
    );
}

export function AnamnesisCard({ student, onEdit }: { student: StudentProfile; onEdit: () => void }) {
    const anamnesis = student.anamnesis;
    const items = anamnesis
        ? [
              { label: 'Lesões e dores', value: anamnesis.injuries, highlight: true },
              { label: 'Restrições alimentares', value: anamnesis.restrictions, highlight: true },
              { label: 'Medicamentos', value: anamnesis.medications, highlight: false },
              { label: 'Observações', value: anamnesis.notes, highlight: false },
          ].filter((item) => item.value)
        : [];

    return (
        <SectionCard
            title="Anamnese"
            icon={<HeartPulse className="h-4 w-4 text-red-500" />}
            action={
                <button type="button" onClick={onEdit} className={editButtonClass}>
                    <Pencil className="h-3 w-3" />
                    {anamnesis ? 'Editar' : 'Preencher'}
                </button>
            }
        >
            {anamnesis ? (
                <div className="space-y-2 text-sm">
                    <InfoRow label="Nível de atividade">
                        {anamnesis.activityLevel ? ACTIVITY_LEVEL_LABELS[anamnesis.activityLevel] ?? anamnesis.activityLevel : '—'}
                    </InfoRow>
                    {items.length === 0 && <p className="text-xs text-muted-foreground">Sem lesões, restrições ou medicamentos registrados.</p>}
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className={cn('rounded-lg px-2.5 py-1.5', item.highlight ? 'border border-amber-500/30 bg-amber-500/10' : 'bg-muted/60')}
                        >
                            <p className={cn('text-xs font-semibold', item.highlight ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                                {item.label}
                            </p>
                            <p className="whitespace-pre-line text-sm text-foreground">{item.value}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">Anamnese não preenchida. Registre lesões, restrições e medicamentos antes de prescrever.</p>
            )}
        </SectionCard>
    );
}

export function QuickActionsCard({
    student,
    onRemind,
    onResetPassword,
    onCreateAccess,
    onDelete,
}: {
    student: StudentProfile;
    onRemind: () => void;
    onResetPassword: () => void;
    onCreateAccess: () => void;
    onDelete: () => void;
}) {
    const actionClass = cn(smallButtonClass, 'justify-start');
    return (
        <SectionCard title="Ações rápidas" icon={<Zap className="h-4 w-4 text-muted-foreground" />}>
            <div className="grid grid-cols-2 gap-2">
                <Link href={`/personal/students/${student.id}/workout`} className={actionClass}>
                    <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                    Editar treino
                </Link>
                <Link href={`/personal/students/${student.id}/diet`} className={actionClass}>
                    <Utensils className="h-3.5 w-3.5 text-muted-foreground" />
                    Editar dieta
                </Link>
                <Link href={`/personal/students/${student.id}/report`} className={actionClass}>
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    Relatório
                </Link>
                {/* Reminders are app notifications. */}
                {usesStudentApp(student) && (
                    <button type="button" onClick={onRemind} className={actionClass}>
                        <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                        Lembrete
                    </button>
                )}
                {/* A student registered without e-mail has no login to reset: the trainer can create one. */}
                {hasAppAccess(student.user.email) ? (
                    <button type="button" onClick={onResetPassword} className={actionClass}>
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        Redefinir senha
                    </button>
                ) : (
                    <button type="button" onClick={onCreateAccess} className={actionClass}>
                        <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        Criar acesso ao app
                    </button>
                )}
                <button type="button" onClick={onDelete} className={cn(actionClass, 'text-red-600 hover:bg-red-500/10 dark:text-red-400')}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir aluno
                </button>
            </div>
        </SectionCard>
    );
}
