'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog';

/**
 * Promise-based replacements for window.confirm / window.prompt that match the app's look,
 * close with Esc / click outside and confirm with Enter.
 *
 *   const { confirm, prompt } = useDialogs();
 *   if (!(await confirm({ title: 'Excluir plano?', variant: 'danger', confirmText: 'Excluir' }))) return;
 *   const name = await prompt({ title: 'Nome do modelo', defaultValue: plan.title });
 *   if (name === null) return; // cancelled
 */

export interface ConfirmOptions {
    title: string;
    description?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'danger';
}

export interface PromptOptions {
    title: string;
    description?: React.ReactNode;
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    confirmText?: string;
    cancelText?: string;
    /** Return an error message to block submission, or null when valid. Empty input is always blocked. */
    validate?: (value: string) => string | null;
}

interface DialogsContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    prompt: (options: PromptOptions) => Promise<string | null>;
}

type PendingDialog =
    | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
    | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

const DialogsContext = createContext<DialogsContextValue | undefined>(undefined);

export function useDialogs(): DialogsContextValue {
    const context = useContext(DialogsContext);
    if (!context) {
        throw new Error('useDialogs must be used within a DialogsProvider');
    }
    return context;
}

const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50';

export function DialogsProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<PendingDialog | null>(null);
    const [promptValue, setPromptValue] = useState('');
    const [promptError, setPromptError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const confirm = useCallback(
        (options: ConfirmOptions) =>
            new Promise<boolean>((resolve) => {
                setPending({ kind: 'confirm', options, resolve });
            }),
        []
    );

    const prompt = useCallback(
        (options: PromptOptions) =>
            new Promise<string | null>((resolve) => {
                setPromptValue(options.defaultValue ?? '');
                setPromptError(null);
                setPending({ kind: 'prompt', options, resolve });
            }),
        []
    );

    const close = useCallback(
        (result: boolean | string | null) => {
            if (!pending) return;
            if (pending.kind === 'confirm') pending.resolve(Boolean(result));
            else pending.resolve(typeof result === 'string' ? result : null);
            setPending(null);
        },
        [pending]
    );

    const submitPrompt = () => {
        if (!pending || pending.kind !== 'prompt') return;
        const value = promptValue.trim();
        if (!value) {
            setPromptError('Preencha este campo.');
            return;
        }
        const error = pending.options.validate?.(value) ?? null;
        if (error) {
            setPromptError(error);
            return;
        }
        close(value);
    };

    useEffect(() => {
        if (pending?.kind === 'prompt') {
            const id = window.setTimeout(() => inputRef.current?.select(), 30);
            return () => window.clearTimeout(id);
        }
    }, [pending]);

    const options = pending?.options;
    const isDanger = pending?.kind === 'confirm' && pending.options.variant === 'danger';

    return (
        <DialogsContext.Provider value={{ confirm, prompt }}>
            {children}
            <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && close(pending?.kind === 'confirm' ? false : null)}>
                <DialogContent className="max-w-md rounded-2xl border-border bg-card">
                    {pending && options && (
                        <form
                            className="space-y-5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (pending.kind === 'confirm') close(true);
                                else submitPrompt();
                            }}
                        >
                            <DialogHeader className="text-left">
                                <div className="flex items-start gap-3">
                                    {isDanger && (
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <DialogTitle className="text-base font-bold text-foreground">{options.title}</DialogTitle>
                                        {options.description && (
                                            <DialogDescription className="text-sm text-muted-foreground">
                                                {options.description}
                                            </DialogDescription>
                                        )}
                                    </div>
                                </div>
                            </DialogHeader>

                            {pending.kind === 'prompt' && (
                                <div className="space-y-1.5">
                                    {pending.options.label && (
                                        <label htmlFor="dialogs-prompt-input" className="text-sm font-medium text-foreground">
                                            {pending.options.label}
                                        </label>
                                    )}
                                    <input
                                        id="dialogs-prompt-input"
                                        ref={inputRef}
                                        value={promptValue}
                                        placeholder={pending.options.placeholder}
                                        onChange={(event) => {
                                            setPromptValue(event.target.value);
                                            if (promptError) setPromptError(null);
                                        }}
                                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                    {promptError && <p className="text-xs text-red-500">{promptError}</p>}
                                </div>
                            )}

                            <DialogFooter className="gap-2 sm:space-x-0">
                                <button
                                    type="button"
                                    onClick={() => close(pending.kind === 'confirm' ? false : null)}
                                    className={cn(buttonBase, 'border border-border bg-transparent text-foreground hover:bg-muted')}
                                >
                                    {options.cancelText ?? 'Cancelar'}
                                </button>
                                <button
                                    type="submit"
                                    autoFocus={pending.kind === 'confirm'}
                                    className={cn(
                                        buttonBase,
                                        isDanger
                                            ? 'bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    )}
                                >
                                    {options.confirmText ?? (pending.kind === 'confirm' ? 'Confirmar' : 'Salvar')}
                                </button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </DialogsContext.Provider>
    );
}
