'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DEFAULT_QUICK_REPLIES, MAX_QUICK_REPLIES, sanitizeQuickReplies } from './preferences';

const SEPARATOR = '\u0000';

const inputClass =
    'w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/30';

const iconButtonClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 lg:min-h-0 lg:min-w-0';

interface QuickRepliesFormProps {
    initial: string[];
    onSave: (replies: string[]) => void;
    onCancel?: () => void;
    saveLabel?: string;
}

/** Editable list of quick replies. A real form: Enter in a reply saves; Enter in the "nova resposta" field adds it. */
export function QuickRepliesForm({ initial, onSave, onCancel, saveLabel = 'Salvar respostas' }: QuickRepliesFormProps) {
    const initialKey = initial.join(SEPARATOR);
    const nextIdRef = useRef(0);
    const toItems = (list: string[]) => list.map((text) => ({ id: nextIdRef.current++, text }));
    const [items, setItems] = useState(() => toItems(initial));
    const [draft, setDraft] = useState('');
    const draftRef = useRef<HTMLInputElement>(null);

    // Follow the stored value when it changes outside this form (e.g. it finished loading).
    useEffect(() => {
        setItems((initialKey ? initialKey.split(SEPARATOR) : []).map((text) => ({ id: nextIdRef.current++, text })));
    }, [initialKey]);

    const cleaned = sanitizeQuickReplies([...items.map((item) => item.text), draft]);
    const isDirty = cleaned.join(SEPARATOR) !== initialKey;
    const isFull = items.length >= MAX_QUICK_REPLIES;

    const add = () => {
        const text = draft.trim();
        if (!text || isFull) return;
        setItems((current) => [...current, { id: nextIdRef.current++, text }]);
        setDraft('');
        draftRef.current?.focus();
    };

    const move = (index: number, delta: number) => {
        setItems((current) => {
            const target = index + delta;
            if (target < 0 || target >= current.length) return current;
            const next = current.slice();
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    return (
        <form
            className="space-y-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave(cleaned);
                setDraft('');
            }}
        >
            <ol className="space-y-2">
                {items.map((item, index) => (
                    <li key={item.id} className="flex items-center gap-1.5">
                        <span
                            className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground"
                            title={index < 9 ? `Atalho no chat: Alt+${index + 1}` : undefined}
                        >
                            {index + 1}
                        </span>
                        <input
                            value={item.text}
                            onChange={(event) =>
                                setItems((current) =>
                                    current.map((entry) => (entry.id === item.id ? { ...entry, text: event.target.value } : entry))
                                )
                            }
                            aria-label={`Resposta rápida ${index + 1}`}
                            className={inputClass}
                        />
                        <button type="button" className={iconButtonClass} onClick={() => move(index, -1)} disabled={index === 0} aria-label="Mover para cima" title="Mover para cima">
                            <ArrowUp className="h-4 w-4" />
                        </button>
                        <button type="button" className={iconButtonClass} onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Mover para baixo" title="Mover para baixo">
                            <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            className={cn(iconButtonClass, 'hover:bg-red-500/10 hover:text-red-500')}
                            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                            aria-label={`Remover resposta ${index + 1}`}
                            title="Remover"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </li>
                ))}
                {items.length === 0 && (
                    <li className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                        Nenhuma resposta rápida. Adicione a primeira abaixo.
                    </li>
                )}
            </ol>

            <div className="flex items-center gap-2">
                <input
                    ref={draftRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            add();
                        }
                    }}
                    placeholder={isFull ? `Limite de ${MAX_QUICK_REPLIES} respostas` : 'Nova resposta, ex.: Bora treinar, {nome}?'}
                    disabled={isFull}
                    aria-label="Nova resposta rápida"
                    className={inputClass}
                />
                <button
                    type="button"
                    onClick={add}
                    disabled={!draft.trim() || isFull}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                    Adicionar
                </button>
            </div>

            <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1 font-semibold text-foreground">{'{nome}'}</code> para inserir o primeiro nome do aluno.
                No chat, <strong>Alt+1</strong> a <strong>Alt+9</strong> inserem as nove primeiras.
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setItems(toItems(DEFAULT_QUICK_REPLIES))}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar padrão
                </button>
                <div className="flex items-center gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!isDirty}
                        className="rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#F88022]/90 disabled:opacity-50"
                    >
                        {saveLabel}
                    </button>
                </div>
            </div>
        </form>
    );
}

interface QuickRepliesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    replies: string[];
    onSave: (replies: string[]) => void;
}

export function QuickRepliesDialog({ open, onOpenChange, replies, onSave }: QuickRepliesDialogProps) {
    const { toast } = useToast();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="text-base font-bold">Respostas rápidas</DialogTitle>
                    <DialogDescription>
                        Aparecem acima do campo de mensagem, em todas as conversas deste navegador.
                    </DialogDescription>
                </DialogHeader>
                {open && (
                    <QuickRepliesForm
                        initial={replies}
                        onCancel={() => onOpenChange(false)}
                        onSave={(next) => {
                            onSave(next);
                            onOpenChange(false);
                            toast.success('Respostas rápidas salvas');
                        }}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
