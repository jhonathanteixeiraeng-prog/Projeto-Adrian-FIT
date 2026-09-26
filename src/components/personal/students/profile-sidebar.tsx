'use client';

import React, { useState } from 'react';
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
    Utensils,
    Zap,
} from 'lucide-react';
import { useDialogs, useToast } from '@/components/ui';
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

export function ContactCard({ student }: { student: StudentProfile }) {
    const { toast } = useToast();
    const whatsapp = whatsappUrl(student.user.phone);
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
                    <a href={`mailto:${student.user.email}`} className="min-w-0 flex-1 truncate text-foreground hover:text-primary">
                        {student.user.email}
                    </a>
                    <button type="button" onClick={() => copy(student.user.email, 'E-mail')} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Copiar e-mail">
                        <Copy className="h-3.5 w-3.5" />
                    </button>
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
                <Link href={`/personal/chat/${student.id}`} className={smallButtonClass}>
                    <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    Chat no app
                </Link>
            </div>
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
    onDelete,
}: {
    student: StudentProfile;
    onRemind: () => void;
    onResetPassword: () => void;
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
                <button type="button" onClick={onRemind} className={actionClass}>
                    <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
                    Lembrete
                </button>
                <button type="button" onClick={onResetPassword} className={actionClass}>
                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                    Redefinir senha
                </button>
                <button type="button" onClick={onDelete} className={cn(actionClass, 'text-red-600 hover:bg-red-500/10 dark:text-red-400')}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir aluno
                </button>
            </div>
        </SectionCard>
    );
}
