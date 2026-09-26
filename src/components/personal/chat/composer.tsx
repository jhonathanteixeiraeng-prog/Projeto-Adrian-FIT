'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pencil, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { modKeyLabel } from '@/hooks/use-hotkey';
import { fillQuickReply, useEnterSends, useQuickReplies } from './preferences';
import { QuickRepliesDialog } from './quick-replies';

// Unsent text per conversation, kept while switching conversations in this tab.
const drafts = new Map<string, string>();

const MAX_TEXTAREA_HEIGHT = 176;

interface ComposerProps {
    /** Student id: drafts are kept per conversation. */
    conversationKey: string;
    studentName: string;
    onSend: (text: string) => void;
}

export function Composer({ conversationKey, studentName, onSend }: ComposerProps) {
    const [text, setText] = useState(() => drafts.get(conversationKey) ?? '');
    const [enterSends] = useEnterSends();
    const [replies, setReplies] = useQuickReplies();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [modLabel, setModLabel] = useState('Ctrl');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => setModLabel(modKeyLabel()), []);

    useLayoutEffect(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.style.height = 'auto';
        element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
        element.style.overflowY = element.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }, [text]);

    // On desktop the cursor is ready as soon as a conversation opens.
    useEffect(() => {
        if (window.matchMedia('(min-width: 1024px)').matches) {
            textareaRef.current?.focus({ preventScroll: true });
        }
    }, [conversationKey]);

    const updateText = (value: string) => {
        setText(value);
        if (value) drafts.set(conversationKey, value);
        else drafts.delete(conversationKey);
    };

    const submit = () => {
        const value = text.trim();
        if (!value) return;
        onSend(value);
        updateText('');
        textareaRef.current?.focus();
    };

    const insertReply = (template: string) => {
        const filled = fillQuickReply(template, studentName);
        const current = text.trimEnd();
        updateText(current ? `${current} ${filled}` : filled);
        requestAnimationFrame(() => {
            const element = textareaRef.current;
            if (!element) return;
            element.focus();
            element.setSelectionRange(element.value.length, element.value.length);
        });
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'Enter') {
            const withModifier = event.metaKey || event.ctrlKey;
            if (withModifier || (enterSends && !event.shiftKey && !event.altKey)) {
                event.preventDefault();
                submit();
            }
            return;
        }
        if (event.key === 'Escape') {
            event.currentTarget.blur();
            return;
        }
        // Alt+1..9 inserts the matching quick reply only when event.key is the digit itself.
        if (event.altKey && !event.metaKey && !event.ctrlKey && /^[1-9]$/.test(event.key)) {
            const reply = replies[Number(event.key) - 1];
            if (reply) {
                event.preventDefault();
                insertReply(reply);
            }
        }
    };

    const placeholder = enterSends
        ? 'Escreva uma mensagem… (Enter envia, Shift+Enter quebra a linha)'
        : `Escreva uma mensagem… (${modLabel}+Enter envia)`;

    return (
        <div className="border-t border-border bg-card">
            <div className="flex items-center gap-1.5 overflow-x-auto px-3 pt-2.5 sm:px-4 lg:flex-wrap lg:overflow-visible">
                {replies.map((reply, index) => {
                    const filled = fillQuickReply(reply, studentName);
                    return (
                        <button
                            key={`${index}-${reply}`}
                            type="button"
                            onClick={() => insertReply(reply)}
                            title={index < 9 ? `${filled}  (Alt+${index + 1})` : filled}
                            className="max-w-[240px] shrink-0 truncate rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:min-h-0 lg:min-w-0"
                        >
                            {filled}
                        </button>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setIsEditorOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:min-h-0 lg:min-w-0"
                    title="Editar respostas rápidas"
                >
                    {replies.length === 0 ? <Plus className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                    {replies.length === 0 ? 'Criar respostas rápidas' : 'Editar'}
                </button>
            </div>

            <form
                className="flex items-end gap-2 p-3 sm:px-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(event) => updateText(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={placeholder}
                    aria-label="Mensagem"
                    className="max-h-44 min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-2.5 text-base leading-snug text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
                <button
                    type="submit"
                    disabled={!text.trim()}
                    className={cn(
                        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
                        'disabled:cursor-not-allowed disabled:opacity-40'
                    )}
                    aria-label="Enviar mensagem"
                    title="Enviar"
                >
                    <Send className="h-5 w-5" />
                </button>
            </form>

            <QuickRepliesDialog open={isEditorOpen} onOpenChange={setIsEditorOpen} replies={replies} onSave={setReplies} />
        </div>
    );
}
