'use client';

import React, { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { REMINDER_OPTIONS, type ReminderType, errorMessage, firstName, sendReminder } from './lib';
import { Field, primarySmallButtonClass, smallButtonClass, textareaClass } from './ui';

const CONCURRENCY = 4;

/** Sends POST /api/personal/reminders once per student (same contract used by the dashboard). */
export function ReminderDialog({
    open,
    onOpenChange,
    students,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    students: Array<{ id: string; name: string }>;
    onDone?: () => void;
}) {
    const { toast } = useToast();
    const [type, setType] = useState<ReminderType>('WORKOUT_REMINDER');
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

    useEffect(() => {
        if (open) {
            setMessage('');
            setProgress(null);
        }
    }, [open]);

    const selected = REMINDER_OPTIONS.find((option) => option.value === type) ?? REMINDER_OPTIONS[0];
    const sending = progress !== null;
    const title =
        students.length === 1 ? `Enviar lembrete para ${firstName(students[0].name)}` : `Enviar lembrete para ${students.length} alunos`;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (students.length === 0 || sending) return;
        const queue = [...students];
        const failures: string[] = [];
        let done = 0;
        setProgress({ done: 0, total: queue.length });

        const worker = async () => {
            while (queue.length > 0) {
                const student = queue.shift()!;
                try {
                    await sendReminder(student.id, type, message);
                } catch (error) {
                    failures.push(`${student.name}: ${errorMessage(error)}`);
                }
                done += 1;
                setProgress({ done, total: students.length });
            }
        };
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, students.length) }, worker));

        const sent = students.length - failures.length;
        if (failures.length === 0) {
            toast.success(
                sent === 1 ? 'Lembrete enviado' : `Lembrete enviado para ${sent} alunos`,
                'O aluno recebe a notificação no app.'
            );
        } else if (sent > 0) {
            toast.warning(`Lembrete enviado para ${sent} de ${students.length} alunos`, failures.slice(0, 2).join(' · '));
        } else {
            toast.error('Não foi possível enviar o lembrete', failures[0]);
        }
        setProgress(null);
        onOpenChange(false);
        onDone?.();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
            <DialogContent className="max-w-md rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <BellRing className="h-4 w-4 text-[#F88022]" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>Notificação enviada no app do aluno.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <fieldset>
                        <legend className="mb-1.5 text-xs font-semibold text-muted-foreground">Tipo de lembrete</legend>
                        <div className="grid grid-cols-2 gap-2" role="radiogroup">
                            {REMINDER_OPTIONS.map((option) => (
                                <label
                                    key={option.value}
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#F88022]/30',
                                        type === option.value
                                            ? 'border-[#F88022] bg-[#F88022]/10 text-[#F88022]'
                                            : 'border-border text-foreground hover:bg-muted'
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name="reminder-type"
                                        value={option.value}
                                        checked={type === option.value}
                                        onChange={() => setType(option.value)}
                                        className="sr-only"
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <Field label="Mensagem (opcional)" htmlFor="reminder-message" hint="Em branco, o aluno recebe a mensagem padrão mostrada no campo.">
                        <textarea
                            id="reminder-message"
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            placeholder={selected.defaultMessage}
                            maxLength={500}
                            rows={3}
                            className={textareaClass}
                        />
                    </Field>
                    <div className="flex justify-end gap-2">
                        <button type="button" className={smallButtonClass} onClick={() => onOpenChange(false)} disabled={sending}>
                            Cancelar
                        </button>
                        <button type="submit" className={primarySmallButtonClass} disabled={sending || students.length === 0}>
                            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {sending ? `Enviando ${progress.done}/${progress.total}…` : 'Enviar lembrete'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
