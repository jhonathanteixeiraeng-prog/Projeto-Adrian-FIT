'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronDown,
    Copy,
    CreditCard,
    Dumbbell,
    Eye,
    EyeOff,
    HeartPulse,
    KeyRound,
    Loader2,
    Phone,
    User,
    UserPlus,
    Utensils,
    Wand2,
} from 'lucide-react';
import { useToast } from '@/components/ui';
import { usePageMeta } from '@/components/personal/page-meta';
import {
    ACTIVITY_LEVEL_OPTIONS,
    GENDER_OPTIONS,
    PAYMENT_OPTIONS,
    PLAN_OPTIONS,
    STUDENTS_KEY,
    crmHref,
    firstName,
    generatePassword,
    monthlyLabel,
    patchCachedData,
    toDateInputValue,
    whatsappUrl,
} from '@/components/personal/students/lib';
import type { StudentListItem } from '@/components/personal/students/types';
import { Field, inputClass, primarySmallButtonClass, selectClass, smallButtonClass, textareaClass } from '@/components/personal/students/ui';
import { useHotkey } from '@/hooks/use-hotkey';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes';
import { renewedExpiry } from '@/lib/student-status';
import { cn, parseDecimalInput } from '@/lib/utils';
import { studentSchema, type StudentInput } from '@/lib/validations';

interface CreatedStudent {
    id: string;
    name: string;
    email: string;
    password: string;
    phone: string | null;
    reusedAccount: boolean;
}

// Empty stays undefined (optional); text that isn't a number becomes NaN so zod shows the field error.
const optionalNumber = {
    setValueAs: (value: unknown) => parseDecimalInput(value) ?? undefined,
};
const optionalText = { setValueAs: (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined) };

const defaultExpiry = (planType: string) => toDateInputValue(renewedExpiry(planType, null));

const defaultValues = (): Partial<StudentInput> => ({
    name: '',
    email: '',
    password: '',
    phone: '',
    birthDate: '',
    goal: '',
    planType: 'MENSAL',
    planExpiresAt: defaultExpiry('MENSAL'),
    paymentStatus: 'PAID',
    anamnesis: { activityLevel: 'MODERATE' },
});

function Panel({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    {icon}
                    {title}
                </h2>
                {action}
            </header>
            <div className="space-y-3 p-4">{children}</div>
        </section>
    );
}

export default function NewStudentPage() {
    const { toast } = useToast();
    const [backHref, setBackHref] = useState('/personal/students');
    useEffect(() => setBackHref(crmHref()), []);
    usePageMeta({ title: 'Novo aluno', breadcrumbs: [{ label: 'Alunos', href: backHref }, { label: 'Novo aluno' }] });

    const [created, setCreated] = useState<CreatedStudent | null>(null);
    const [serverError, setServerError] = useState<{ message: string; studentId?: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [withContract, setWithContract] = useState(true);
    const [withAnamnesis, setWithAnamnesis] = useState(false);
    const [copied, setCopied] = useState<'email' | 'password' | 'all' | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        setFocus,
        formState: { errors, isDirty, isSubmitting, dirtyFields },
    } = useForm<StudentInput>({
        resolver: zodResolver(studentSchema),
        defaultValues: defaultValues(),
    });

    // Links (Cancelar, breadcrumbs, sidebar) ask before discarding what was typed.
    useUnsavedChangesGuard(isDirty && !created && !isSubmitting);

    useEffect(() => {
        setFocus('name');
    }, [setFocus]);

    // Expiry follows the plan period until the trainer picks a date.
    const planType = watch('planType') || 'MENSAL';
    const planValue = watch('planValue');
    useEffect(() => {
        if (!dirtyFields.planExpiresAt) setValue('planExpiresAt', defaultExpiry(planType));
    }, [planType, dirtyFields.planExpiresAt, setValue]);

    const onSubmit = async (values: StudentInput) => {
        setServerError(null);
        const anamnesis = values.anamnesis;
        const hasAnamnesis =
            withAnamnesis &&
            Boolean(
                anamnesis?.injuries?.trim() ||
                    anamnesis?.restrictions?.trim() ||
                    anamnesis?.medications?.trim() ||
                    anamnesis?.notes?.trim() ||
                    dirtyFields.anamnesis?.activityLevel
            );
        const body = {
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
            password: values.password,
            phone: values.phone?.trim() || undefined,
            birthDate: values.birthDate || undefined,
            gender: values.gender || undefined,
            height: values.height,
            weight: values.weight,
            goal: values.goal?.trim() || undefined,
            ...(withContract
                ? {
                      planType: values.planType ?? 'MENSAL',
                      planValue: values.planValue ?? null,
                      planExpiresAt: values.planExpiresAt || null,
                      paymentStatus: values.paymentStatus ?? 'PAID',
                  }
                : {}),
            ...(hasAnamnesis ? { anamnesis } : {}),
        };

        let json: any = null;
        try {
            const response = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            json = await response.json().catch(() => null);
            if (!response.ok || !json?.success) {
                setServerError({
                    message: json?.error || 'Não foi possível cadastrar o aluno. Tente de novo.',
                    studentId: json?.code === 'STUDENT_EXISTS' ? json.studentId : undefined,
                });
                return;
            }
        } catch {
            setServerError({ message: 'Sem conexão com o servidor. Verifique sua internet e tente de novo.' });
            return;
        }

        const student = json.data as StudentListItem;
        patchCachedData<StudentListItem[]>(STUDENTS_KEY, (list) =>
            Array.isArray(list)
                ? [{ ...student, workoutPlans: [], dietPlans: [], checkins: [], workoutSessions: [] }, ...list.filter((item) => item.id !== student.id)]
                : list
        );
        toast.success('Aluno cadastrado', body.name);
        window.scrollTo({ top: 0 });
        setCreated({
            id: student.id,
            name: body.name,
            email: json.data?.user?.email || body.email,
            // Only show a password the server confirms it saved.
            password: json.passwordSet === true ? values.password : '',
            phone: body.phone ?? null,
            reusedAccount: Boolean(json.reusedAccount),
        });
    };

    useHotkey('mod+enter', () => {
        if (!created) handleSubmit(onSubmit)();
    });

    const registerAnother = () => {
        reset(defaultValues());
        setCreated(null);
        setServerError(null);
        setShowPassword(false);
        setCopied(null);
        window.setTimeout(() => setFocus('name'), 0);
    };

    // ------------------------------------------------------------ success
    if (created) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const accessText = `Olá, ${firstName(created.name)}! Seu acesso ao app de treinos:\n\nE-mail: ${created.email}${created.password ? `\nSenha: ${created.password}` : ''}\n\nAcesse: ${origin}/login`;
        const whatsapp = whatsappUrl(created.phone, accessText) ?? `https://wa.me/?text=${encodeURIComponent(accessText)}`;
        const copy = async (text: string, kind: 'email' | 'password' | 'all') => {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(kind);
                window.setTimeout(() => setCopied(null), 2000);
            } catch {
                toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.');
            }
        };

        return (
            <div className="mx-auto max-w-3xl space-y-4 pb-12">
                <div className="rounded-2xl border border-emerald-500/30 bg-card p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-foreground">{created.name} foi cadastrado</h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">Envie o acesso ao aluno e já prescreva o treino e a dieta.</p>
                        </div>
                    </div>

                    {created.reusedAccount && (
                        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                            Este e-mail já possuía uma conta de acesso. A conta foi reaproveitada e a senha abaixo passou a valer.
                        </p>
                    )}

                    <dl className="mt-4 divide-y divide-border rounded-xl border border-border bg-muted/40">
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                                <dt className="text-xs text-muted-foreground">E-mail de acesso</dt>
                                <dd className="truncate font-mono text-sm text-foreground">{created.email}</dd>
                            </div>
                            <button type="button" onClick={() => copy(created.email, 'email')} className={smallButtonClass} aria-label="Copiar e-mail">
                                {copied === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                        {created.password && (
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">Senha</dt>
                                    <dd className="font-mono text-sm text-foreground">{created.password}</dd>
                                </div>
                                <button type="button" onClick={() => copy(created.password, 'password')} className={smallButtonClass} aria-label="Copiar senha">
                                    {copied === 'password' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                        )}
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={cn(primarySmallButtonClass, 'bg-emerald-600 hover:bg-emerald-600/90')}>
                            <Phone className="h-3.5 w-3.5" />
                            Enviar acesso pelo WhatsApp
                        </a>
                        <button type="button" onClick={() => copy(accessText, 'all')} className={smallButtonClass}>
                            {copied === 'all' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === 'all' ? 'Copiado' : 'Copiar acesso'}
                        </button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <Link
                        href={`/personal/students/${created.id}/workout`}
                        className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[#F88022]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                    >
                        <Dumbbell className="h-5 w-5 text-[#F88022]" />
                        <p className="mt-2 font-semibold text-foreground">Prescrever treino</p>
                        <p className="text-xs text-muted-foreground">Do zero ou a partir de um modelo</p>
                    </Link>
                    <Link
                        href={`/personal/students/${created.id}/diet`}
                        className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[#F88022]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                    >
                        <Utensils className="h-5 w-5 text-emerald-500" />
                        <p className="mt-2 font-semibold text-foreground">Criar dieta</p>
                        <p className="text-xs text-muted-foreground">Plano alimentar com macros</p>
                    </Link>
                    <Link
                        href={`/personal/students/${created.id}`}
                        className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-[#F88022]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                    >
                        <User className="h-5 w-5 text-blue-500" />
                        <p className="mt-2 font-semibold text-foreground">Abrir ficha</p>
                        <p className="text-xs text-muted-foreground">Contrato, anamnese e evolução</p>
                    </Link>
                </div>

                <div className="flex flex-wrap justify-between gap-2">
                    <Link href={backHref} className={smallButtonClass}>
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Voltar para alunos
                    </Link>
                    <button type="button" onClick={registerAnother} className={smallButtonClass}>
                        <UserPlus className="h-3.5 w-3.5" />
                        Cadastrar outro aluno
                    </button>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------ form
    const monthly = withContract ? monthlyLabel(planType, planValue) : null;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-12" noValidate>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Link href={backHref} className={cn(smallButtonClass, 'w-9 px-0')} aria-label="Voltar para alunos">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Novo aluno</h1>
                        <p className="text-sm text-muted-foreground">Dados, acesso ao app, contrato e anamnese em uma só tela.</p>
                    </div>
                </div>
            </div>

            {serverError && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">
                    <span>{serverError.message}</span>
                    {serverError.studentId && (
                        <Link href={`/personal/students/${serverError.studentId}`} className={smallButtonClass}>
                            Abrir ficha existente
                        </Link>
                    )}
                </div>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-2">
                <Panel title="Dados pessoais" icon={<User className="h-4 w-4 text-[#F88022]" />}>
                    <Field label="Nome completo *" htmlFor="student-name" error={errors.name?.message}>
                        <input id="student-name" autoComplete="off" className={inputClass} {...register('name')} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Telefone / WhatsApp" htmlFor="student-phone" error={errors.phone?.message}>
                            <input id="student-phone" type="tel" placeholder="(11) 98888-7777" className={inputClass} {...register('phone')} />
                        </Field>
                        <Field label="Data de nascimento" htmlFor="student-birth" error={errors.birthDate?.message}>
                            <input id="student-birth" type="date" className={inputClass} {...register('birthDate')} />
                        </Field>
                        <Field label="Sexo" htmlFor="student-gender" error={errors.gender?.message}>
                            <select id="student-gender" className={selectClass} defaultValue="" {...register('gender', optionalText)}>
                                <option value="">Não informado</option>
                                {GENDER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="Altura (cm)" htmlFor="student-height" error={errors.height?.message}>
                                <input id="student-height" type="text" inputMode="decimal" placeholder="175" className={inputClass} {...register('height', optionalNumber)} />
                            </Field>
                            <Field label="Peso (kg)" htmlFor="student-weight" error={errors.weight?.message}>
                                <input id="student-weight" type="text" inputMode="decimal" placeholder="72,5" className={inputClass} {...register('weight', optionalNumber)} />
                            </Field>
                        </div>
                    </div>
                    <Field label="Objetivo" htmlFor="student-goal" error={errors.goal?.message}>
                        <textarea
                            id="student-goal"
                            rows={4}
                            placeholder="Ex.: hipertrofia com foco em glúteos; perder 6 kg até dezembro; voltar a correr 10 km"
                            className={textareaClass}
                            {...register('goal')}
                        />
                    </Field>
                </Panel>

                <div className="space-y-4">
                    <Panel title="Acesso ao app" icon={<KeyRound className="h-4 w-4 text-[#F88022]" />}>
                        <Field label="E-mail de acesso *" htmlFor="student-email" error={errors.email?.message}>
                            <input id="student-email" type="email" autoComplete="off" placeholder="aluno@email.com" className={inputClass} {...register('email')} />
                        </Field>
                        <Field label="Senha *" htmlFor="student-password" error={errors.password?.message} hint="O aluno entra com este e-mail e senha no app.">
                            <div className="flex gap-1.5">
                                <div className="relative flex-1">
                                    <input
                                        id="student-password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        placeholder="Mínimo 6 caracteres"
                                        className={cn(inputClass, 'pr-9')}
                                        {...register('password')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setValue('password', generatePassword(), { shouldValidate: true, shouldDirty: true });
                                        setShowPassword(true);
                                    }}
                                    className={cn(smallButtonClass, 'h-9')}
                                >
                                    <Wand2 className="h-3.5 w-3.5" />
                                    Gerar senha
                                </button>
                            </div>
                        </Field>
                    </Panel>

                    <Panel
                        title="Contrato"
                        icon={<CreditCard className="h-4 w-4 text-[#F88022]" />}
                        action={
                            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={withContract}
                                    onChange={(event) => setWithContract(event.target.checked)}
                                    className="h-4 w-4 accent-[#F88022]"
                                />
                                Registrar agora
                            </label>
                        }
                    >
                        {withContract ? (
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Plano" htmlFor="student-plan" error={errors.planType?.message}>
                                    <select id="student-plan" className={selectClass} {...register('planType')}>
                                        {PLAN_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Valor do plano (R$)" htmlFor="student-plan-value" error={errors.planValue?.message} hint={monthly ? `Equivale a ${monthly}` : undefined}>
                                    <input
                                        id="student-plan-value"
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="Ex.: 150 ou 149,90"
                                        className={inputClass}
                                        {...register('planValue', optionalNumber)}
                                    />
                                </Field>
                                <Field label="Vencimento" htmlFor="student-plan-expires" error={errors.planExpiresAt?.message}>
                                    <input id="student-plan-expires" type="date" className={inputClass} {...register('planExpiresAt')} />
                                </Field>
                                <Field label="Pagamento" htmlFor="student-payment" error={errors.paymentStatus?.message}>
                                    <select id="student-payment" className={selectClass} {...register('paymentStatus')}>
                                        {PAYMENT_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                O aluno aparece como “Sem contrato” na cobrança. Você pode registrar o contrato depois pela ficha ou pelo CRM.
                            </p>
                        )}
                    </Panel>

                    <Panel
                        title="Anamnese básica"
                        icon={<HeartPulse className="h-4 w-4 text-red-500" />}
                        action={
                            <button
                                type="button"
                                onClick={() => setWithAnamnesis((value) => !value)}
                                aria-expanded={withAnamnesis}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#F88022] hover:bg-[#F88022]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F88022]/40"
                            >
                                {withAnamnesis ? 'Ocultar' : 'Preencher (opcional)'}
                                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', withAnamnesis && 'rotate-180')} />
                            </button>
                        }
                    >
                        {withAnamnesis ? (
                            <div className="space-y-3">
                                <Field label="Nível de atividade" htmlFor="student-activity" error={errors.anamnesis?.activityLevel?.message}>
                                    <select id="student-activity" className={selectClass} {...register('anamnesis.activityLevel')}>
                                        {ACTIVITY_LEVEL_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Lesões e dores" htmlFor="student-injuries" error={errors.anamnesis?.injuries?.message}>
                                    <textarea id="student-injuries" rows={2} placeholder="Ex.: dor no ombro direito ao elevar o braço" className={textareaClass} {...register('anamnesis.injuries')} />
                                </Field>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Restrições alimentares" htmlFor="student-restrictions" error={errors.anamnesis?.restrictions?.message}>
                                        <textarea id="student-restrictions" rows={2} placeholder="Ex.: sem lactose" className={textareaClass} {...register('anamnesis.restrictions')} />
                                    </Field>
                                    <Field label="Medicamentos" htmlFor="student-medications" error={errors.anamnesis?.medications?.message}>
                                        <textarea id="student-medications" rows={2} placeholder="Ex.: nenhum" className={textareaClass} {...register('anamnesis.medications')} />
                                    </Field>
                                </div>
                                <Field label="Observações" htmlFor="student-anamnesis-notes" error={errors.anamnesis?.notes?.message}>
                                    <textarea id="student-anamnesis-notes" rows={2} className={textareaClass} {...register('anamnesis.notes')} />
                                </Field>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Lesões, restrições e medicamentos. Também pode ser preenchida depois na ficha.</p>
                        )}
                    </Panel>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <span className="mr-auto hidden text-xs text-muted-foreground sm:inline">* obrigatório · Enter ou ⌘/Ctrl+Enter cadastra</span>
                <Link href={backHref} className={cn(smallButtonClass, 'h-9 px-4')}>
                    Cancelar
                </Link>
                <button type="submit" className={cn(primarySmallButtonClass, 'h-9 px-4 text-sm')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    Cadastrar aluno
                </button>
            </div>
        </form>
    );
}
