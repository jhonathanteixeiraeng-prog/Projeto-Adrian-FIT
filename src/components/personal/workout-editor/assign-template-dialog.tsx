'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { invalidateApi, useApi } from '@/hooks/use-api';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import { NOTIFY_STUDENT_STORAGE_KEY } from '@/lib/notifications';
import { StudentPicker, type StudentOption } from './student-picker';
import { addDaysYmd, DEFAULT_PLAN_LENGTH_DAYS, todayYmd } from './plan-dates';

interface AssignTemplateDialogProps {
    template: { id: string; title: string } | null;
    onOpenChange: (open: boolean) => void;
}

const inputClass =
    'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';

/** Prescribes a library template to a student (no student preselected) and opens the new plan in the editor. */
export function AssignTemplateDialog({ template, onOpenChange }: AssignTemplateDialogProps) {
    const router = useRouter();
    const { toast } = useToast();
    const students = useApi<StudentOption[]>(template ? '/api/students' : null);
    const [notifyStudent, setNotifyStudent] = useLocalStorageState<boolean>(NOTIFY_STUDENT_STORAGE_KEY, true);
    const [studentId, setStudentId] = useState('');
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!template) return;
        const start = todayYmd();
        setStudentId('');
        setTitle(template.title);
        setStartDate(start);
        setEndDate(addDaysYmd(start, DEFAULT_PLAN_LENGTH_DAYS));
        setError(null);
    }, [template]);

    const selected = students.data?.find((student) => student.id === studentId);
    const currentPlan = selected?.workoutPlans?.[0];

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!template || saving) return;
        if (!studentId) return setError('Selecione o aluno que vai receber o treino.');
        if (!title.trim()) return setError('Informe o título da ficha.');
        if (!startDate || !endDate) return setError('Informe as datas de início e término.');
        if (endDate < startDate) return setError('A data de término deve ser depois do início.');

        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/workout-plans/from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId: template.id, studentId, title: title.trim(), startDate, endDate, notifyStudent }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) {
                setError(result?.error || 'Não foi possível atribuir o modelo.');
                return;
            }
            invalidateApi('/api/workout-plans');
            invalidateApi('/api/students');
            toast.success('Ficha criada a partir do modelo', `${selected?.user.name ?? 'O aluno'} já recebeu “${title.trim()}”.`);
            onOpenChange(false);
            router.push(`/personal/workouts/${result.data.id}`);
        } catch {
            setError('Erro de conexão. Verifique sua internet e tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={Boolean(template)} onOpenChange={(open) => !saving && onOpenChange(open)}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card p-0">
                <form onSubmit={submit}>
                    <DialogHeader className="border-b border-border px-5 py-4 text-left">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <UserPlus className="h-5 w-5 text-[#F88022]" /> Atribuir modelo a um aluno
                        </DialogTitle>
                        <DialogDescription>
                            Cria uma ficha ativa com os treinos de “{template?.title}”. Você poderá ajustá-la em seguida.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 px-5 py-4">
                        <div>
                            <span className="mb-1 block text-xs font-medium text-muted-foreground">Aluno</span>
                            <StudentPicker
                                inline
                                autoFocus
                                students={students.data}
                                loading={students.isLoading}
                                value={studentId}
                                onChange={(id) => {
                                    setStudentId(id);
                                    setError(null);
                                }}
                            />
                            {currentPlan && (
                                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    {selected?.user.name} já tem a ficha ativa “{currentPlan.title}”, que ficará inativa.
                                </p>
                            )}
                        </div>
                        <label className="block">
                            <span className="mb-1 block text-xs font-medium text-muted-foreground">Título da ficha</span>
                            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={inputClass} />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                                <span className="mb-1 block text-xs font-medium text-muted-foreground">Início</span>
                                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs font-medium text-muted-foreground">Término</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    min={startDate || undefined}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className={inputClass}
                                />
                            </label>
                        </div>
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
                            <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </p>
                        )}
                    </div>
                    <DialogFooter className="gap-2 border-t border-border px-5 py-3 sm:space-x-0">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={saving}
                            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90 disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Criar ficha e abrir
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
