'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, Library, Loader2, Search, Sparkles, Utensils } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { NOTIFY_STUDENT_STORAGE_KEY } from '@/lib/notifications';
import { cn, getShortDayOfWeekName, matchesSearch } from '@/lib/utils';
import { STUDENTS_KEY, errorMessage, refreshStudentPlans, requestJson, todayInput } from './lib';
import type { StudentListItem } from './types';
import { Field, inputClass, primarySmallButtonClass, selectClass, smallButtonClass } from './ui';

interface WorkoutTemplateOption {
    id: string;
    title: string;
    description?: string | null;
    templateDays?: Array<{
        id: string;
        name: string;
        dayOfWeek: number;
        order?: number;
        items?: Array<{ id: string; exercise?: { name: string } | null }>;
    }>;
}

interface DietTemplateOption {
    id: string;
    title: string;
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    meals?: Array<{ id: string; name: string; time?: string; items?: Array<{ totalCalories?: number }> }>;
}

function DialogError({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
            {message}
        </p>
    );
}

function validateDates(startDate: string, endDate: string): string | null {
    if (!startDate || !endDate) return 'Informe as datas de início e término';
    if (endDate < startDate) return 'A data de término deve ser depois da data de início';
    return null;
}

// ---------------------------------------------------------------------------
// Workout template
// ---------------------------------------------------------------------------

export function AssignWorkoutTemplateDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string;
    studentName: string;
}) {
    const { toast } = useToast();
    const { data, isLoading, error: loadError } = useApi<WorkoutTemplateOption[]>(open ? '/api/workout-templates' : null);
    const templates = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);
    const [templateId, setTemplateId] = useState('');
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState(todayInput());
    const [endDate, setEndDate] = useState(todayInput(60));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setTemplateId('');
            setTitle('');
            setStartDate(todayInput());
            setEndDate(todayInput(60));
            setError(null);
        }
    }, [open]);

    const template = templates.find((item) => item.id === templateId) ?? null;
    const days = useMemo(
        () => [...(template?.templateDays ?? [])].sort((a, b) => a.dayOfWeek - b.dayOfWeek || (a.order ?? 0) - (b.order ?? 0)),
        [template]
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!templateId) return setError('Escolha um modelo da biblioteca');
        if (!title.trim()) return setError('Informe o título do treino para o aluno');
        const dateError = validateDates(startDate, endDate);
        if (dateError) return setError(dateError);
        try {
            setSaving(true);
            setError(null);
            await requestJson('/api/workout-plans/from-template', {
                method: 'POST',
                body: { templateId, studentId, title: title.trim(), startDate, endDate, notifyStudent },
            });
            refreshStudentPlans(studentId);
            toast.success('Treino atribuído', `${title.trim()} para ${studentName}`);
            onOpenChange(false);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-xl rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Library className="h-4 w-4 text-muted-foreground" />
                        Atribuir modelo de treino
                    </DialogTitle>
                    <DialogDescription>O novo treino passa a ser o treino ativo de {studentName}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Field label="Modelo da biblioteca" htmlFor="workout-template">
                        <select
                            id="workout-template"
                            value={templateId}
                            onChange={(event) => {
                                setTemplateId(event.target.value);
                                const picked = templates.find((item) => item.id === event.target.value);
                                if (picked) setTitle(picked.title);
                                setError(null);
                            }}
                            className={selectClass}
                            autoFocus
                        >
                            <option value="">{isLoading ? 'Carregando modelos…' : 'Selecione um modelo'}</option>
                            {templates.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title} ({item.templateDays?.length ?? 0} dias)
                                </option>
                            ))}
                        </select>
                    </Field>
                    {!isLoading && templates.length === 0 && !loadError && (
                        <p className="text-xs text-muted-foreground">
                            Sua biblioteca está vazia.{' '}
                            <Link href="/personal/workouts" className="font-semibold text-primary hover:underline">
                                Criar modelos de treino
                            </Link>
                        </p>
                    )}
                    {loadError && <DialogError message={`Não foi possível carregar os modelos: ${loadError.message}`} />}

                    {template && (
                        <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-muted/40 p-3">
                            {days.length === 0 && <p className="text-xs text-muted-foreground">Modelo sem dias de treino.</p>}
                            {days.map((day) => (
                                <div key={day.id} className="text-sm">
                                    <p className="font-semibold text-foreground">
                                        <span className="mr-1.5 text-xs font-bold uppercase text-muted-foreground">{getShortDayOfWeekName(day.dayOfWeek)}</span>
                                        {day.name}
                                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">{day.items?.length ?? 0} exercícios</span>
                                    </p>
                                    {!!day.items?.length && (
                                        <p className="truncate text-xs text-muted-foreground">
                                            {day.items
                                                .map((item) => item.exercise?.name)
                                                .filter(Boolean)
                                                .join(' · ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <Field label="Título para o aluno" htmlFor="workout-template-title">
                        <input
                            id="workout-template-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Ex.: Hipertrofia — Fase 1"
                            className={inputClass}
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Início" htmlFor="workout-template-start">
                            <input id="workout-template-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Término" htmlFor="workout-template-end" hint="Sugestão: 60 dias">
                            <input id="workout-template-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground">
                        <input
                            type="checkbox"
                            checked={notifyStudent}
                            onChange={(event) => setNotifyStudent(event.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary/25"
                        />
                        Avisar o aluno
                    </label>
                    <DialogError message={error} />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onOpenChange(false)} className={smallButtonClass} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className={primarySmallButtonClass} disabled={saving || !templateId}>
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Atribuir treino
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Clone from another student
// ---------------------------------------------------------------------------

export function CloneWorkoutDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    hasActiveWorkout,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string;
    studentName: string;
    hasActiveWorkout: boolean;
}) {
    const { toast } = useToast();
    const { data, isLoading } = useApi<StudentListItem[]>(open ? STUDENTS_KEY : null);
    const [query, setQuery] = useState('');
    const [sourceId, setSourceId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setQuery('');
            setSourceId('');
            setError(null);
        }
    }, [open]);

    const peers = useMemo(
        () =>
            (Array.isArray(data) ? data : [])
                .filter((student) => student.id !== studentId && (student.workoutPlans?.length ?? 0) > 0)
                .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'pt-BR')),
        [data, studentId]
    );
    const visiblePeers = peers.filter((student) =>
        matchesSearch(query, student.user?.name, student.user?.email, student.workoutPlans?.[0]?.title)
    );
    const source = peers.find((student) => student.id === sourceId) ?? null;
    const sourcePlan = source?.workoutPlans?.[0] ?? null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!sourceId) return setError('Escolha o aluno de origem');
        try {
            setSaving(true);
            setError(null);
            const json = await requestJson<{ message?: string }>('/api/workout-plans/clone', {
                method: 'POST',
                body: { sourceStudentId: sourceId, targetStudentId: studentId },
            });
            refreshStudentPlans(studentId);
            toast.success('Treino clonado', json.message);
            onOpenChange(false);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-xl rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Clonar treino de outro aluno
                    </DialogTitle>
                    <DialogDescription>
                        Copia dias, exercícios, séries, repetições e descansos do treino ativo escolhido, com validade de 60 dias a partir de hoje.
                        {hasActiveWorkout && ` O treino ativo atual de ${studentName} será desativado.`}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Buscar aluno ou treino"
                            aria-label="Buscar aluno de origem"
                            className={cn(inputClass, 'pl-9')}
                            autoFocus
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-border" role="radiogroup" aria-label="Aluno de origem">
                            {isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando alunos…</p>}
                            {!isLoading && visiblePeers.length === 0 && (
                                <p className="p-3 text-sm text-muted-foreground">
                                    {peers.length === 0 ? 'Nenhum outro aluno tem treino ativo.' : 'Nenhum aluno encontrado.'}
                                </p>
                            )}
                            {visiblePeers.map((student) => (
                                <label
                                    key={student.id}
                                    className={cn(
                                        'flex cursor-pointer items-start gap-2 border-b border-border/60 px-3 py-2 text-sm last:border-0 focus-within:bg-muted',
                                        sourceId === student.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="clone-source"
                                        value={student.id}
                                        checked={sourceId === student.id}
                                        onChange={() => {
                                            setSourceId(student.id);
                                            setError(null);
                                        }}
                                        className="mt-1 accent-primary"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate font-semibold text-foreground">{student.user?.name}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{student.workoutPlans?.[0]?.title}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div className="rounded-xl border border-border bg-muted/40 p-3">
                            {sourcePlan ? (
                                <>
                                    <p className="text-xs font-medium text-muted-foreground">Prévia</p>
                                    <p className="mt-1 font-semibold text-foreground">{sourcePlan.title}</p>
                                    <ul className="mt-2 space-y-1 text-sm">
                                        {(sourcePlan.workoutDays ?? []).map((day) => (
                                            <li key={day.id} className="flex items-center gap-1.5 text-foreground">
                                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                                <span className="truncate">{day.name}</span>
                                            </li>
                                        ))}
                                        {(sourcePlan.workoutDays ?? []).length === 0 && (
                                            <li className="text-xs text-muted-foreground">Treino sem dias cadastrados.</li>
                                        )}
                                    </ul>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">Escolha um aluno para ver os dias do treino.</p>
                            )}
                        </div>
                    </div>
                    <DialogError message={error} />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onOpenChange(false)} className={smallButtonClass} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className={primarySmallButtonClass} disabled={saving || !sourceId}>
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                            Clonar treino
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Diet template (sends targetCalories, required by the scaling endpoint)
// ---------------------------------------------------------------------------

const templateBaseCalories = (template: DietTemplateOption | null) => {
    if (!template) return null;
    const fromFoods = (template.meals ?? []).reduce(
        (total, meal) => total + (meal.items ?? []).reduce((sum, item) => sum + (Number(item.totalCalories) || 0), 0),
        0
    );
    if (fromFoods > 0) return Math.round(fromFoods);
    return template.calories ? Math.round(template.calories) : null;
};

export function AssignDietTemplateDialog({
    open,
    onOpenChange,
    studentId,
    studentName,
    currentCalories,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: string;
    studentName: string;
    currentCalories?: number | null;
}) {
    const { toast } = useToast();
    const { data, isLoading, error: loadError } = useApi<DietTemplateOption[]>(open ? '/api/diet-templates' : null);
    const templates = useMemo(() => (Array.isArray(data) ? data : []), [data]);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);
    const [templateId, setTemplateId] = useState('');
    const [title, setTitle] = useState('');
    const [targetCalories, setTargetCalories] = useState('');
    const [caloriesChanged, setCaloriesChanged] = useState(false);
    const [suggestedTarget, setSuggestedTarget] = useState('');
    const [startDate, setStartDate] = useState(todayInput());
    const [endDate, setEndDate] = useState(todayInput(30));
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setTemplateId('');
            setTitle('');
            setTargetCalories('');
            setCaloriesChanged(false);
            setStartDate(todayInput());
            setEndDate(todayInput(30));
            setError(null);
        }
    }, [open]);

    const template = templates.find((item) => item.id === templateId) ?? null;
    const baseCalories = templateBaseCalories(template);
    const target = targetCalories.trim() === '' ? null : Number(targetCalories);
    const factor = target && baseCalories ? target / baseCalories : null;

    const pickTemplate = (id: string) => {
        setTemplateId(id);
        setError(null);
        setCaloriesChanged(false);
        const picked = templates.find((item) => item.id === id) ?? null;
        if (!picked) return;
        setTitle(picked.title);
        const suggested = templateBaseCalories(picked) ?? currentCalories ?? null;
        const suggestedText = suggested ? String(Math.min(6000, Math.max(800, Math.round(suggested)))) : '';
        setTargetCalories(suggestedText);
        setSuggestedTarget(suggestedText);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!templateId) return setError('Escolha um modelo de dieta');
        const dateError = validateDates(startDate, endDate);
        if (dateError) return setError(dateError);

        const hasBase = (baseCalories ?? 0) > 0;
        let finalTargetCalories: number | null = null;
        // Only a value different from the suggestion rescales the template (retyping the same number doesn't).
        if (hasBase && caloriesChanged && targetCalories.trim() !== suggestedTarget.trim()) {
            if (target !== null) {
                if (!Number.isInteger(target) || target < 800 || target > 6000) {
                    return setError('Informe a meta calórica em kcal, entre 800 e 6000 (número inteiro)');
                }
                finalTargetCalories = target;
            }
        }

        try {
            setSaving(true);
            setError(null);
            await requestJson('/api/diet-plans/from-template', {
                method: 'POST',
                body: {
                    templateId,
                    studentId,
                    startDate,
                    endDate,
                    targetCalories: finalTargetCalories,
                    notifyStudent,
                    ...(title.trim() ? { title: title.trim() } : {}),
                },
            });
            refreshStudentPlans(studentId);
            const calText = finalTargetCalories ? ` · ${finalTargetCalories} kcal` : baseCalories ? ` · ${baseCalories} kcal` : '';
            toast.success('Dieta atribuída', `${title.trim() || template?.title || 'Plano alimentar'}${calText}`);
            onOpenChange(false);
        } catch (submitError) {
            setError(errorMessage(submitError));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Utensils className="h-4 w-4 text-muted-foreground" />
                        Atribuir modelo de dieta
                    </DialogTitle>
                    <DialogDescription>As quantidades do modelo são ajustadas para a meta calórica de {studentName}.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <Field label="Modelo da biblioteca" htmlFor="diet-template">
                        <select id="diet-template" value={templateId} onChange={(event) => pickTemplate(event.target.value)} className={selectClass} autoFocus>
                            <option value="">{isLoading ? 'Carregando modelos…' : 'Selecione um modelo'}</option>
                            {templates.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                    {templateBaseCalories(item) ? ` (${templateBaseCalories(item)} kcal)` : ''}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {!isLoading && templates.length === 0 && !loadError && (
                        <p className="text-xs text-muted-foreground">
                            Sua biblioteca está vazia.{' '}
                            <Link href="/personal/diets" className="font-semibold text-primary hover:underline">
                                Criar modelos de dieta
                            </Link>
                        </p>
                    )}
                    {loadError && <DialogError message={`Não foi possível carregar os modelos: ${loadError.message}`} />}
                    {template && (
                        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                            {template.meals?.length ?? 0} refeições · base do modelo: {baseCalories ? `${baseCalories} kcal` : 'sem calorias calculadas'}
                            {caloriesChanged && factor && Math.abs(factor - 1) >= 0.01 && ` · quantidades ×${factor.toFixed(2).replace('.', ',')}`}
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Título para o aluno" htmlFor="diet-template-title" className="col-span-2">
                            <input
                                id="diet-template-title"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Nome do plano alimentar"
                                className={inputClass}
                            />
                        </Field>
                        <Field label="Meta calórica (kcal)" htmlFor="diet-template-kcal" hint={currentCalories ? `Dieta atual: ${currentCalories} kcal` : '800 a 6000 kcal'}>
                            <input
                                id="diet-template-kcal"
                                type="number"
                                inputMode="numeric"
                                min={800}
                                max={6000}
                                step={10}
                                value={targetCalories}
                                onChange={(event) => {
                                    setTargetCalories(event.target.value);
                                    setCaloriesChanged(true);
                                    setError(null);
                                }}
                                placeholder="Em branco: mantém as quantidades do modelo"
                                className={inputClass}
                            />
                        </Field>
                        <div />
                        <Field label="Início" htmlFor="diet-template-start">
                            <input id="diet-template-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                        </Field>
                        <Field label="Término" htmlFor="diet-template-end" hint="Sugestão: 30 dias">
                            <input id="diet-template-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} />
                        </Field>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground">
                        <input
                            type="checkbox"
                            checked={notifyStudent}
                            onChange={(event) => setNotifyStudent(event.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary/25"
                        />
                        Avisar o aluno
                    </label>
                    <DialogError message={error} />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onOpenChange(false)} className={smallButtonClass} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className={primarySmallButtonClass} disabled={saving || !templateId}>
                            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Atribuir dieta
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
