'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, Users } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useApi } from '@/hooks/use-api';
import { cn, matchesSearch } from '@/lib/utils';
import { STATUS_LABELS, STUDENTS_KEY } from './lib';
import type { StudentListItem } from './types';
import { smallButtonClass } from './ui';

const MAX_RESULTS = 60;

function SwitcherPanel({ currentId, onPick, onClose }: { currentId: string; onPick: (id: string) => void; onClose: () => void }) {
    // Mounted only while open: shares the cached list with the CRM and the ⌘K palette.
    const { data, isLoading } = useApi<StudentListItem[]>(STUDENTS_KEY);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const results = useMemo(() => {
        const list = Array.isArray(data) ? data : [];
        return list
            .filter((student) => matchesSearch(query, student.user?.name, student.user?.email, student.user?.phone))
            .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'pt-BR'))
            .slice(0, MAX_RESULTS);
    }, [data, query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const student = results[activeIndex];
            if (student) onPick(student.id);
        }
    };

    return (
        <div
            className="absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            onKeyDown={onKeyDown}
        >
            <div className="flex items-center gap-2 border-b border-border px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar aluno"
                    aria-label="Buscar aluno"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="student-switcher-list"
                    aria-activedescendant={results[activeIndex] ? `student-switcher-${results[activeIndex].id}` : undefined}
                    className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            </div>
            <div ref={listRef} id="student-switcher-list" role="listbox" className="max-h-80 overflow-y-auto p-1">
                {results.map((student, index) => (
                    <button
                        key={student.id}
                        id={`student-switcher-${student.id}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        data-index={index}
                        onMouseMove={() => setActiveIndex(index)}
                        onClick={() => onPick(student.id)}
                        className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                            index === activeIndex ? 'bg-primary/10 text-primary' : 'text-foreground'
                        )}
                    >
                        <Avatar name={student.user?.name || ''} src={student.user?.avatar || undefined} size="sm" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{student.user?.name || 'Aluno'}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {student.id === currentId ? 'Aberto agora' : STATUS_LABELS[student.status] ?? student.status}
                            </span>
                        </span>
                    </button>
                ))}
                {!isLoading && results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado</p>}
            </div>
        </div>
    );
}

export function StudentSwitcher({ currentId, onPick }: { currentId: string; onPick: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={smallButtonClass}
            >
                <Users className="h-3.5 w-3.5" />
                Trocar aluno
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {open && (
                <SwitcherPanel
                    currentId={currentId}
                    onClose={() => setOpen(false)}
                    onPick={(id) => {
                        setOpen(false);
                        if (id !== currentId) onPick(id);
                    }}
                />
            )}
        </div>
    );
}
