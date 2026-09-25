'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { monthlyValue, renewedExpiry } from '@/lib/student-status';
import { cn, parseDecimalInput } from '@/lib/utils';
import {
    PAYMENT_OPTIONS,
    PLAN_OPTIONS,
    dateInputToIso,
    formatBRL,
    planMonths,
    planPeriodLabel,
    toDateInputValue,
} from './lib';
import type { StudentContractFields, StudentPatch } from './types';
import { Field, inputClass, primarySmallButtonClass, selectClass, smallButtonClass } from './ui';

interface ContractFormProps {
    student: StudentContractFields;
    onSubmit: (patch: StudentPatch) => Promise<void>;
    onCancel?: () => void;
    idPrefix: string;
    autoFocus?: boolean;
    submitLabel?: string;
    className?: string;
}

const initialValues = (student: StudentContractFields) => ({
    planType: student.planType || 'MENSAL',
    planValue: student.planValue === null || student.planValue === undefined ? '' : String(student.planValue),
    planExpiresAt: toDateInputValue(student.planExpiresAt),
    paymentStatus: student.paymentStatus === 'PENDING' ? 'PENDENTE' : student.paymentStatus || '',
});

/** Plan, value, expiry and payment. A real form: Enter saves, Esc (in dialogs) cancels. */
export function ContractForm({ student, onSubmit, onCancel, idPrefix, autoFocus, submitLabel = 'Salvar contrato', className }: ContractFormProps) {
    const [values, setValues] = useState(() => initialValues(student));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const firstFieldRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        if (autoFocus) firstFieldRef.current?.focus();
    }, [autoFocus]);

    const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setValues((current) => ({ ...current, [key]: event.target.value }));
        setError(null);
    };

    const numericValue = parseDecimalInput(values.planValue);
    const monthly = numericValue !== null && Number.isFinite(numericValue) ? monthlyValue(values.planType, numericValue) : null;

    const extendOnePeriod = () => {
        const base = values.planExpiresAt ? dateInputToIso(values.planExpiresAt) : null;
        setValues((current) => ({ ...current, planExpiresAt: toDateInputValue(renewedExpiry(current.planType, base)) }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (numericValue !== null && (!Number.isFinite(numericValue) || numericValue < 0)) {
            setError('Informe um valor válido (ex.: 150 ou 149,90) ou deixe em branco.');
            return;
        }
        try {
            setSaving(true);
            await onSubmit({
                planType: values.planType,
                planValue: numericValue,
                planExpiresAt: values.planExpiresAt ? dateInputToIso(values.planExpiresAt) : null,
                paymentStatus: values.paymentStatus || null,
            });
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o contrato.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={cn('space-y-3', className)} noValidate>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Plano" htmlFor={`${idPrefix}-plan`}>
                    <select
                        ref={firstFieldRef}
                        id={`${idPrefix}-plan`}
                        value={values.planType}
                        onChange={set('planType')}
                        className={selectClass}
                    >
                        {PLAN_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field
                    label="Valor do plano (R$)"
                    htmlFor={`${idPrefix}-value`}
                    hint={monthly !== null && planMonths(values.planType) > 1 ? `Equivale a ${formatBRL(monthly)}/mês` : undefined}
                >
                    <input
                        id={`${idPrefix}-value`}
                        type="text"
                        inputMode="decimal"
                        value={values.planValue}
                        onChange={set('planValue')}
                        placeholder="Sem valor"
                        className={inputClass}
                    />
                </Field>
                <Field label="Vencimento" htmlFor={`${idPrefix}-expires`}>
                    <div className="flex gap-1.5">
                        <input
                            id={`${idPrefix}-expires`}
                            type="date"
                            value={values.planExpiresAt}
                            onChange={set('planExpiresAt')}
                            className={inputClass}
                        />
                        <button
                            type="button"
                            onClick={extendOnePeriod}
                            className={cn(smallButtonClass, 'h-9 shrink-0 px-2')}
                            title={`Avançar ${planPeriodLabel(values.planType)}`}
                            aria-label={`Avançar vencimento ${planPeriodLabel(values.planType)}`}
                        >
                            <CalendarPlus className="h-4 w-4" />
                        </button>
                    </div>
                </Field>
                <Field label="Pagamento" htmlFor={`${idPrefix}-payment`}>
                    <select
                        id={`${idPrefix}-payment`}
                        value={values.paymentStatus}
                        onChange={set('paymentStatus')}
                        className={selectClass}
                    >
                        <option value="">Não informado</option>
                        {PAYMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
                {onCancel && (
                    <button type="button" onClick={onCancel} className={smallButtonClass} disabled={saving}>
                        Cancelar
                    </button>
                )}
                <button type="submit" className={primarySmallButtonClass} disabled={saving}>
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {submitLabel}
                </button>
            </div>
        </form>
    );
}

export function ContractDialog({
    open,
    onOpenChange,
    student,
    studentName,
    onSubmit,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: StudentContractFields;
    studentName: string;
    onSubmit: (patch: StudentPatch) => Promise<void>;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-base font-bold">Contrato e pagamento</DialogTitle>
                    <DialogDescription>{studentName}</DialogDescription>
                </DialogHeader>
                {open && (
                    <ContractForm
                        idPrefix="contract-dialog"
                        student={student}
                        autoFocus
                        onCancel={() => onOpenChange(false)}
                        onSubmit={async (patch) => {
                            await onSubmit(patch);
                            onOpenChange(false);
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
