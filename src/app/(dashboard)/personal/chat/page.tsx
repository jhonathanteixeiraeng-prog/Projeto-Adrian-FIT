'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { usePageMeta } from '@/components/personal/page-meta';

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-foreground">
            {children}
        </kbd>
    );
}

const TIPS: { keys: string[]; label: string }[] = [
    { keys: ['/'], label: 'Buscar aluno ou mensagem' },
    { keys: ['↑', '↓'], label: 'Navegar pela lista' },
    { keys: ['Enter'], label: 'Abrir conversa' },
    { keys: ['Alt ↑', 'Alt ↓'], label: 'Conversa anterior / próxima' },
    { keys: ['Alt 1…9'], label: 'Inserir resposta rápida' },
    { keys: ['Shift Enter'], label: 'Quebrar linha na mensagem' },
];

/** Right pane of the inbox when no conversation is open (on mobile the layout shows the list instead). */
export default function PersonalChatPage() {
    usePageMeta({ title: 'Chat', breadcrumbs: [{ label: 'Chat' }] });

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <MessageCircle className="h-8 w-8" />
            </div>
            <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-foreground">Selecione uma conversa</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                    Escolha um aluno na lista para ver o histórico e responder. As conversas com mensagens novas ficam no topo.
                </p>
            </div>
            <ul className="w-full max-w-sm space-y-2 rounded-2xl border border-border bg-card p-4 text-left">
                {TIPS.map((tip) => (
                    <li key={tip.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">{tip.label}</span>
                        <span className="flex shrink-0 items-center gap-1">
                            {tip.keys.map((key) => (
                                <Kbd key={key}>{key}</Kbd>
                            ))}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
