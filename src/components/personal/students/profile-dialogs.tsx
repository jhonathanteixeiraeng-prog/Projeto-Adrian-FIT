'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, Phone, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { anamnesisSchema } from '@/lib/validations';
import { cn } from '@/lib/utils';
import {
    ACTIVITY_LEVEL_OPTIONS,
    GENDER_OPTIONS,
    dateInputToIso,
    errorMessage,
    generatePassword,
    requestJson,
    toDateInputValue,
    updateStudent,
    whatsappUrl,
} from './lib';
import type { StudentPatch, StudentProfile } from './types';
import { Field, inputClass, primarySmallButtonClass, selectClass, smallButtonClass, textareaClass } from './ui';

function FormError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {message}
        </p>
    );
}

function DialogActions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
    return (
        <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className={smallButtonClass} disabled={saving}>
                Cancelar
            </button>
            <button type="submit" className={primarySmallButtonClass} disabled={saving}>
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {label}
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Personal information
// ---------------------------------------------------------------------------

const infoValues = (student: StudentProfile) => ({
    name: student.user.name || '',
    phone: student.user.phone || '',
    birthDate: toDateInputValue(student.birthDate, { calendar: true }),
    gender: student.gender || '',
    height: student.height ? String(student.height) : '',
    weight: student.weight ? String(student.weight) : '',
    goal: student.goal || '',
});

export function PersonalInfoDialog({
    open,
    onOpenChange,
    student,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: StudentProfile;
}) {
    const { toast } = useToast();
    const [values, setValues] = useState(() => infoValues(student));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setValues(infoValues(student));
            setErrors({});
            setFormError(null);
        }
        // Reset only when the dialog opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value }));

    const parseMeasure = (raw: string) => (raw.trim() === '' ? null : Number(raw.replace(',', '.')));

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const nextErrors: Record<string, string> = {};
        const height = parseMeasure(values.height);
        const weight = parseMeasure(values.weight);
        if (values.name.trim().length < 2) nextErrors.name = 'Informe o nome completo';
        if (height !== null && (!Number.isFinite(height) || height < 50 || height > 260)) nextErrors.height = 'Altura em centímetros (ex.: 175)';
        if (weight !== null && (!Number.isFinite(weight) || weight < 20 || weight > 400)) nextErrors.weight = 'Peso em quilos (ex.: 72,5)';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        const original = infoValues(student);
        const patch: StudentPatch = {};
        if (values.name.trim() !== original.name) patch.name = values.name.trim();
        if (values.phone.trim() !== original.phone) patch.phone = values.phone.trim() || null;
        if (values.birthDate !== original.birthDate) patch.birthDate = values.birthDate ? dateInputToIso(values.birthDate) : null;
        if (values.gender !== original.gender) patch.gender = values.gender || null;
        if (values.height !== original.height) patch.height = height;
        if (values.weight !== original.weight) patch.weight = weight;
        if (values.goal.trim() !== original.goal) patch.goal = values.goal.trim() || null;

        if (Object.keys(patch).length === 0) {
            onOpenChange(false);
            return;
        }
        try {
            setSaving(true);
            setFormError(null);
            await updateStudent(student.id, patch);
            toast.success('Dados atualizados', values.name.trim());
            onOpenChange(false);
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-base font-bold">Informações do aluno</DialogTitle>
                    <DialogDescription>Campos em branco ficam sem informação.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                    <Field label="Nome completo" htmlFor="info-name" error={errors.name}>
                        <input id="info-name" value={values.name} onChange={set('name')} className={inputClass} autoComplete="off" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Telefone / WhatsApp" htmlFor="info-phone">
                            <input
                                id="info-phone"
                                type="tel"
                                value={values.phone}
                                onChange={set('phone')}
                                placeholder="(11) 98888-7777"
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Data de nascimento" htmlFor="info-birth">
                            <input id="info-birth" type="date" value={values.birthDate} onChange={set('birthDate')} className={inputClass} />
                        </Field>
                        <Field label="Sexo" htmlFor="info-gender">
                            <select id="info-gender" value={values.gender} onChange={set('gender')} className={selectClass}>
                                <option value="">Não informado</option>
                                {GENDER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Altura (cm)" htmlFor="info-height" error={errors.height}>
                                <input
                                    id="info-height"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.5"
                                    value={values.height}
                                    onChange={set('height')}
                                    className={inputClass}
                                />
                            </Field>
                            <Field label="Peso (kg)" htmlFor="info-weight" error={errors.weight}>
                                <input
                                    id="info-weight"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.1"
                                    value={values.weight}
                                    onChange={set('weight')}
                                    className={inputClass}
                                />
                            </Field>
                        </div>
                    </div>
                    <Field label="Objetivo" htmlFor="info-goal">
                        <textarea
                            id="info-goal"
                            value={values.goal}
                            onChange={set('goal')}
                            rows={3}
                            placeholder="Ex.: hipertrofia com foco em membros inferiores, perder 5 kg até dezembro"
                            className={textareaClass}
                        />
                    </Field>
                    <FormError message={formError} />
                    <DialogActions saving={saving} onCancel={() => onOpenChange(false)} label="Salvar" />
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Anamnesis
// ---------------------------------------------------------------------------

const anamnesisValues = (student: StudentProfile) => ({
    activityLevel: student.anamnesis?.activityLevel || 'MODERATE',
    injuries: student.anamnesis?.injuries || '',
    restrictions: student.anamnesis?.restrictions || '',
    medications: student.anamnesis?.medications || '',
    notes: student.anamnesis?.notes || '',
});

export function AnamnesisDialog({
    open,
    onOpenChange,
    student,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: StudentProfile;
}) {
    const { toast } = useToast();
    const [values, setValues] = useState(() => anamnesisValues(student));
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setValues(anamnesisValues(student));
            setFormError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) =>
        setValues((current) => ({ ...current, [key]: event.target.value }));

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const parsed = anamnesisSchema.safeParse(values);
        if (!parsed.success) {
            setFormError(parsed.error.errors[0]?.message ?? 'Revise os campos');
            return;
        }
        try {
            setSaving(true);
            setFormError(null);
            await updateStudent(student.id, {
                anamnesis: {
                    activityLevel: parsed.data.activityLevel,
                    injuries: values.injuries.trim() || null,
                    restrictions: values.restrictions.trim() || null,
                    medications: values.medications.trim() || null,
                    notes: values.notes.trim() || null,
                },
            });
            toast.success('Anamnese salva', student.user.name);
            onOpenChange(false);
        } catch (error) {
            setFormError(errorMessage(error));
        } finally {
            setSaving(false);
        }
    };

    const textField = (key: 'injuries' | 'restrictions' | 'medications' | 'notes', label: string, placeholder: string) => (
        <Field label={label} htmlFor={`anamnesis-${key}`}>
            <textarea
                id={`anamnesis-${key}`}
                value={values[key]}
                onChange={set(key)}
                rows={2}
                placeholder={placeholder}
                className={textareaClass}
            />
        </Field>
    );

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-base font-bold">Anamnese</DialogTitle>
                    <DialogDescription>Informações de saúde consideradas na prescrição de {student.user.name}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Field label="Nível de atividade" htmlFor="anamnesis-activity">
                        <select id="anamnesis-activity" value={values.activityLevel} onChange={set('activityLevel')} className={selectClass}>
                            {ACTIVITY_LEVEL_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {textField('injuries', 'Lesões e dores', 'Ex.: condromalácia no joelho direito, dor lombar ao agachar')}
                    {textField('restrictions', 'Restrições alimentares', 'Ex.: intolerância à lactose, vegetariano')}
                    {textField('medications', 'Medicamentos', 'Ex.: levotiroxina 50 mcg')}
                    {textField('notes', 'Observações', 'Ex.: liberado pelo cardiologista, prefere treinar pela manhã')}
                    <FormError message={formError} />
                    <DialogActions saving={saving} onCancel={() => onOpenChange(false)} label="Salvar anamnese" />
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export function ResetPasswordDialog({
    open,
    onOpenChange,
    student,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    student: StudentProfile;
}) {
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedPassword, setSavedPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (open) {
            setPassword('');
            setVisible(false);
            setError(null);
            setSavedPassword(null);
            setCopied(false);
        }
    }, [open]);

    const credentials = savedPassword
        ? `Seu acesso ao app foi atualizado.\n\nE-mail: ${student.user.email}\nNova senha: ${savedPassword}\n\nAcesse: ${typeof window !== 'undefined' ? window.location.origin : ''}/login`
        : '';
    const whatsapp = savedPassword ? whatsappUrl(student.user.phone, credentials) : null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres');
            return;
        }
        try {
            setSaving(true);
            setError(null);
            await requestJson(`/api/students/${student.id}/reset-password`, { method: 'PUT', body: { newPassword: password } });
            setSavedPassword(password);
            toast.success('Senha redefinida', student.user.name);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setSaving(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(credentials);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-md rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <KeyRound className="h-4 w-4 text-muted-foreground" />
                        Redefinir senha
                    </DialogTitle>
                    <DialogDescription>
                        Nova senha de acesso de {student.user.name} ({student.user.email}).
                    </DialogDescription>
                </DialogHeader>
                {savedPassword ? (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Senha salva. Envie ao aluno:</p>
                            <p className="mt-1 font-mono text-foreground">{savedPassword}</p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={copy} className={smallButtonClass}>
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied ? 'Copiado' : 'Copiar acesso'}
                            </button>
                            {whatsapp && (
                                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={smallButtonClass}>
                                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                                    Enviar no WhatsApp
                                </a>
                            )}
                            <button type="button" onClick={() => onOpenChange(false)} className={primarySmallButtonClass}>
                                Concluir
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <Field label="Nova senha" htmlFor="reset-password" error={error ?? undefined}>
                            <div className="flex gap-1.5">
                                <div className="relative flex-1">
                                    <input
                                        id="reset-password"
                                        type={visible ? 'text' : 'password'}
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value);
                                            setError(null);
                                        }}
                                        placeholder="Mínimo 6 caracteres"
                                        autoComplete="new-password"
                                        className={cn(inputClass, 'pr-9')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setVisible((value) => !value)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                                        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPassword(generatePassword());
                                        setVisible(true);
                                        setError(null);
                                    }}
                                    className={cn(smallButtonClass, 'h-9')}
                                >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    Gerar
                                </button>
                            </div>
                        </Field>
                        <DialogActions saving={saving} onCancel={() => onOpenChange(false)} label="Redefinir senha" />
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
