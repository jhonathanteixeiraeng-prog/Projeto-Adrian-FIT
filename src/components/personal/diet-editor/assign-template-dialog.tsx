'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { NOTIFY_STUDENT_STORAGE_KEY } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { defaultDateRange } from './model';
import { keepDialogOpenWhileListOpen, StudentPicker, type StudentOption } from './student-picker';
import { formatInteger, parseAmount } from './units';

export interface AssignableTemplate {
    id: string;
    title: string;
    calories: number | null;
}

const fieldClass =
    'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';

/** Atribui um modelo a um aluno (sem aluno pré-selecionado) e abre o plano criado. */
export function AssignTemplateDialog({ template, onClose }: { template: AssignableTemplate | null; onClose: () => void }) {
    const router = useRouter();
    const { toast } = useToast();
    const studentsApi = useApi<any[]>(template ? '/api/students' : null);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);
    const [studentId, setStudentId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [calories, setCalories] = useState('');
    const [caloriesChanged, setCaloriesChanged] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!template) return;
        const range = defaultDateRange();
        setStudentId('');
        setStartDate(range.startDate);
        setEndDate(range.endDate);
        setCalories(template.calories ? String(template.calories) : '');
        setCaloriesChanged(false);
        setError(null);
    }, [template]);

    const students = useMemo<StudentOption[]>(
        () =>
            (studentsApi.data ?? []).map((student: any) => ({
                id: student.id,
                name: student.user?.name ?? 'Aluno',
                email: student.user?.email ?? null,
                avatar: student.user?.avatar ?? null,
                hint: student.dietPlans?.[0]?.title ? `Dieta ativa: ${student.dietPlans[0].title}` : null,
            })),
        [studentsApi.data]
    );
    const selected = students.find((student) => student.id === studentId);
    const activeDietTitle = (studentsApi.data ?? []).find((student: any) => student.id === studentId)?.dietPlans?.[0]?.title as string | undefined;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!template) return;
        if (!studentId) {
            setError('Selecione o aluno.');
            return;
        }
        if (!startDate || !endDate || endDate < startDate) {
            setError('Confira as datas: o término deve ser depois do início.');
            return;
        }
        const baseCalories = template.calories ?? 0;
        const hasBase = baseCalories > 0;
        let finalTargetCalories: number | null = null;
        if (hasBase && caloriesChanged) {
            const target = calories.trim() ? parseAmount(calories) : null;
            if (target !== null) {
                if (!Number.isFinite(target) || target < 800 || target > 6000) {
                    setError('A meta calórica deve ficar entre 800 e 6.000 kcal (ou em branco para manter o modelo).');
                    return;
                }
                finalTargetCalories = Math.round(target);
            }
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/diet-plans/from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: template.id,
                    studentId,
                    startDate,
                    endDate,
                    targetCalories: finalTargetCalories,
                    notifyStudent,
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || body?.success === false || !body?.id) throw new Error(body?.error || 'Não foi possível atribuir o modelo.');
            invalidateApi('/api/diets');
            invalidateApi('/api/diet-plans');
            invalidateApi('/api/students');
            toast.success('Dieta atribuída', `${selected?.name ?? 'O aluno'} já recebe “${template.title}” no app. Abrindo o plano…`);
            onClose();
            router.push(`/personal/diets/${body.id}`);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Não foi possível atribuir o modelo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={template !== null} onOpenChange={(open) => !open && !saving && onClose()}>
            <DialogContent className="max-w-md rounded-2xl border-border bg-card" onEscapeKeyDown={keepDialogOpenWhileListOpen}>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <UserPlus className="h-5 w-5 text-[#F88022]" />
                            Atribuir modelo a um aluno
                        </DialogTitle>
                        <DialogDescription>“{template?.title}” vira o plano ativo do aluno. Você pode ajustar tudo depois no editor.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-1.5">
                        <label htmlFor="assign-student" className="text-sm font-medium text-foreground">
                            Aluno
                        </label>
                        <StudentPicker
                            id="assign-student"
                            students={students}
                            value={studentId}
                            onChange={(id) => {
                                setStudentId(id);
                                setError(null);
                            }}
                            autoFocus
                            loading={studentsApi.isLoading}
                        />
                        {activeDietTitle && (
                            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                A dieta ativa atual (“{activeDietTitle}”) será desativada.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-foreground">Início</span>
                            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={cn(fieldClass, 'tabular-nums')} />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-foreground">Término</span>
                            <input
                                type="date"
                                value={endDate}
                                min={startDate || undefined}
                                onChange={(event) => setEndDate(event.target.value)}
                                className={cn(fieldClass, 'tabular-nums')}
                            />
                        </label>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-foreground">Meta calórica (kcal)</span>
                        <input
                            inputMode="numeric"
                            value={calories}
                            onChange={(event) => {
                                setCalories(event.target.value);
                                setCaloriesChanged(true);
                            }}
                            placeholder="Em branco: mantém as quantidades do modelo"
                            className={cn(fieldClass, 'tabular-nums')}
                        />
                        <span className="block text-xs text-muted-foreground">
                            {template?.calories
                                ? `O modelo tem ${formatInteger(template.calories)} kcal. Outra meta reescala proporcionalmente as quantidades.`
                                : 'Uma meta reescala proporcionalmente as quantidades dos alimentos.'}
                        </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-foreground">
                        <input
                            type="checkbox"
                            checked={notifyStudent}
                            onChange={(event) => setNotifyStudent(event.target.checked)}
                            className="rounded border-border text-[#F88022] focus:ring-[#F88022]/25"
                        />
                        Avisar o aluno
                    </label>

                    {error && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90 disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Atribuir e abrir plano
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
