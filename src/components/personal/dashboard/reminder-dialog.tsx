'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fillQuickReply } from '@/components/personal/chat/preferences';

export type ReminderType = 'WORKOUT_REMINDER' | 'CHECKIN_REMINDER' | 'MEAL_REMINDER' | 'WATER_REMINDER' | 'PAYMENT_REMINDER';

export const REMINDER_TYPES: { value: ReminderType; label: string; template: string }[] = [
    {
        value: 'WORKOUT_REMINDER',
        label: 'Treino',
        template: 'Oi {nome}! Seu treino já está no app. Bora manter a constância essa semana? 💪',
    },
    {
        value: 'CHECKIN_REMINDER',
        label: 'Check-in',
        template: 'Oi {nome}! Falta o seu check-in: atualize peso, medidas e fotos no app para eu acompanhar sua evolução. 📋',
    },
    {
        value: 'MEAL_REMINDER',
        label: 'Dieta',
        template: 'Oi {nome}! Lembre-se de seguir e registrar suas refeições de hoje no app. 🍽️',
    },
    {
        value: 'WATER_REMINDER',
        label: 'Hidratação',
        template: 'Oi {nome}! Não esqueça de beber água ao longo do dia. 💧',
    },
    {
        value: 'PAYMENT_REMINDER',
        label: 'Renovação',
        template: 'Oi {nome}! Seu plano de acompanhamento está vencendo. Me chama para renovarmos e seguirmos juntos! 💳',
    },
];

const templateFor = (type: ReminderType) => REMINDER_TYPES.find((item) => item.value === type)?.template ?? '';

export interface ReminderTarget {
    studentId: string;
    name: string;
}

interface ReminderDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    targets: ReminderTarget[];
    defaultType: ReminderType;
    /** Called with the ids that were notified. */
    onSent?: (studentIds: string[]) => void;
}

/**
 * In-app reminder (notification) to one student or to a group, with an editable message.
 * `{nome}` is replaced by each student's first name on the server.
 */
export function ReminderDialog({ open, onOpenChange, targets, defaultType, onSent }: ReminderDialogProps) {
    const { toast } = useToast();
    const [type, setType] = useState<ReminderType>(defaultType);
    const [message, setMessage] = useState(templateFor(defaultType));
    const [sending, setSending] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const isBulk = targets.length > 1;
    const single = targets[0];

    useEffect(() => {
        if (!open) return;
        setType(defaultType);
        setMessage(templateFor(defaultType));
        setSending(false);
    }, [open, defaultType]);

    const changeType = (next: ReminderType) => {
        // Swap the text only if it wasn't edited, so a custom message is never lost.
        if (message.trim() === templateFor(type).trim()) setMessage(templateFor(next));
        setType(next);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (sending || targets.length === 0 || !message.trim()) return;
        setSending(true);
        try {
            const response = await fetch('/api/personal/reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(isBulk ? { studentIds: targets.map((target) => target.studentId) } : { studentId: single.studentId }),
                    type,
                    customMessage: message.trim(),
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Erro ao enviar lembrete');
            toast.success(isBulk ? `Lembrete enviado para ${body.count ?? targets.length} alunos` : `Lembrete enviado para ${single.name}`, 'O aluno recebe a notificação no app.');
            onSent?.(Array.isArray(body.studentIds) ? body.studentIds : targets.map((target) => target.studentId));
            onOpenChange(false);
        } catch (reason) {
            toast.error('Não foi possível enviar o lembrete', reason instanceof Error ? reason.message : undefined);
            setSending(false);
        }
    };

    const preview = single && !isBulk ? fillQuickReply(message, single.name) : null;
    const names = targets.slice(0, 4).map((target) => target.name.split(' ')[0]).join(', ');

    return (
        <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card">
                <form ref={formRef} onSubmit={submit} className="space-y-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Bell className="h-4 w-4 text-primary" />
                            {isBulk ? `Lembrar ${targets.length} alunos` : `Lembrete para ${single?.name ?? 'aluno'}`}
                        </DialogTitle>
                        <DialogDescription>
                            {isBulk
                                ? `${targets.length} alunos serão notificados no app (${names}${targets.length > 4 ? ` e mais ${targets.length - 4}` : ''}).`
                                : 'O aluno recebe uma notificação no app.'}
                        </DialogDescription>
                    </DialogHeader>

                    <fieldset className="space-y-1.5">
                        <legend className="text-sm font-medium text-foreground">Tipo</legend>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de lembrete">
                            {REMINDER_TYPES.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={type === item.value}
                                    onClick={() => changeType(item.value)}
                                    className={cn(
                                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors lg:min-h-0 lg:min-w-0',
                                        type === item.value
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <div className="space-y-1.5">
                        <label htmlFor="reminder-message" className="text-sm font-medium text-foreground">
                            Mensagem
                        </label>
                        <textarea
                            id="reminder-message"
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                    event.preventDefault();
                                    formRef.current?.requestSubmit();
                                }
                            }}
                            rows={4}
                            maxLength={2000}
                            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-xs text-muted-foreground">
                            <code className="rounded bg-muted px-1 font-semibold text-foreground">{'{nome}'}</code> vira o primeiro nome do aluno.
                        </p>
                        {preview && (
                            <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Prévia: </span>
                                {preview}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={sending}
                            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={sending || !message.trim() || targets.length === 0}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isBulk ? `Enviar para ${targets.length} alunos` : 'Enviar lembrete'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
