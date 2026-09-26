'use client';

import React from 'react';
import { Keyboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { modKeyLabel } from '@/hooks/use-hotkey';

/** Destinations for the "G then <key>" navigation sequences (handled in the personal layout). */
export const GO_TO_SHORTCUTS: { key: string; href: string; label: string }[] = [
    { key: 'd', href: '/personal/dashboard', label: 'Dashboard' },
    { key: 'a', href: '/personal/students', label: 'Alunos (CRM)' },
    { key: 't', href: '/personal/workouts', label: 'Fichas de treino' },
    { key: 'n', href: '/personal/diets', label: 'Planos de dieta' },
    { key: 'e', href: '/personal/exercises', label: 'Exercícios' },
    { key: 'c', href: '/personal/chat', label: 'Chat' },
];

function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="inline-flex min-w-[24px] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-foreground">
            {children}
        </kbd>
    );
}

/** `sequence` keys are pressed one after the other; otherwise they are alternatives. */
function Row({ keys, label, sequence = false }: { keys: React.ReactNode[]; label: string; sequence?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4 py-1.5">
            <span className="text-sm text-foreground">{label}</span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {keys.map((key, index) => (
                    <React.Fragment key={index}>
                        {index > 0 && <span>{sequence ? 'depois' : '/'}</span>}
                        <Kbd>{key}</Kbd>
                    </React.Fragment>
                ))}
            </span>
        </div>
    );
}

export function ShortcutsHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const mod = modKeyLabel();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl rounded-2xl border-border bg-card">
                <DialogHeader className="text-left">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold">
                        <Keyboard className="h-5 w-5 text-primary" />
                        Atalhos de teclado
                    </DialogTitle>
                    <DialogDescription>Use o teclado para trabalhar mais rápido no painel.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 sm:grid-cols-2">
                    <section>
                        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Geral</h3>
                        <div className="divide-y divide-border/60">
                            <Row keys={[`${mod} K`]} label="Buscar aluno ou comando" />
                            <Row keys={['?']} label="Mostrar atalhos" />
                            <Row keys={['[']} label="Recolher / expandir menu" />
                            <Row keys={['Esc']} label="Fechar janela ou painel" />
                        </div>
                        <h3 className="mb-1 mt-5 text-xs font-medium text-muted-foreground">Ir para</h3>
                        <div className="divide-y divide-border/60">
                            {GO_TO_SHORTCUTS.map((item) => (
                                <Row key={item.key} keys={['G', item.key.toUpperCase()]} label={item.label} sequence />
                            ))}
                        </div>
                    </section>
                    <section>
                        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Nas telas</h3>
                        <div className="divide-y divide-border/60">
                            <Row keys={['/']} label="Focar a busca da lista" />
                            <Row keys={['↑', '↓']} label="Navegar na lista" />
                            <Row keys={['Enter']} label="Abrir item selecionado" />
                            <Row keys={['X']} label="Selecionar aluno (CRM)" />
                            <Row keys={['Shift Enter']} label="Abrir a ficha do aluno (CRM)" />
                            <Row keys={['J', 'K']} label="Próximo / anterior aluno (na ficha)" />
                            <Row keys={['Alt ↑', 'Alt ↓']} label="Conversa anterior / próxima (chat)" />
                            <Row keys={['Alt 1…9']} label="Inserir resposta rápida (chat)" />
                        </div>
                        <h3 className="mb-1 mt-5 text-xs font-medium text-muted-foreground">Editores de treino e dieta</h3>
                        <div className="divide-y divide-border/60">
                            <Row keys={[`${mod} S`]} label="Salvar sem sair da tela" />
                            <Row keys={['Enter']} label="Adicionar item selecionado na busca" />
                            <Row keys={['Esc']} label="Limpar a busca (de novo: sair dela)" />
                            <Row keys={['Alt ↑', 'Alt ↓']} label="Mover linha para cima / baixo" />
                            <Row keys={[`${mod} Z`]} label="Desfazer remoção de exercício" />
                        </div>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    );
}
