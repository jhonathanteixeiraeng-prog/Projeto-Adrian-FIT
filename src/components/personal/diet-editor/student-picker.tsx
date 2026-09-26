'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn, matchesSearch } from '@/lib/utils';

export interface StudentOption {
    id: string;
    name: string;
    email?: string | null;
    avatar?: string | null;
    /** Texto auxiliar à direita (ex.: dieta ativa atual). */
    hint?: string | null;
}

interface StudentPickerProps {
    students: StudentOption[];
    value: string;
    onChange: (studentId: string) => void;
    id?: string;
    placeholder?: string;
    autoFocus?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    loading?: boolean;
    className?: string;
}

const MAX_RESULTS = 50;

/**
 * Para Radix Dialog: impede que o Esc feche o diálogo enquanto a lista do seletor está aberta
 * (o próprio seletor trata o Esc e fecha só a lista).
 */
export function keepDialogOpenWhileListOpen(event: KeyboardEvent) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.getAttribute('aria-expanded') === 'true' && active.getAttribute('role') === 'combobox') {
        event.preventDefault();
    }
}

/** Busca de aluno sem acento, com ↑/↓ + Enter. */
export function StudentPicker({
    students,
    value,
    onChange,
    id,
    placeholder = 'Buscar aluno por nome ou e-mail…',
    autoFocus,
    disabled,
    invalid,
    loading,
    className,
}: StudentPickerProps) {
    const selected = students.find((student) => student.id === value) ?? null;
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const listId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const matches = useMemo(
        () => students.filter((student) => matchesSearch(query, student.name, student.email)).slice(0, MAX_RESULTS),
        [students, query]
    );

    useEffect(() => {
        setHighlight(0);
    }, [query]);

    useEffect(() => {
        if (!open) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const choose = (student: StudentOption) => {
        onChange(student.id);
        setQuery('');
        setOpen(false);
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) setOpen(true);
            else setHighlight((index) => Math.min(index + 1, matches.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            if (open && matches[highlight]) {
                event.preventDefault();
                choose(matches[highlight]);
            }
        } else if (event.key === 'Escape') {
            if (open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setQuery('');
            }
        } else if (event.key === 'Tab') {
            setOpen(false);
            setQuery('');
        }
    };

    const activeOptionId = open && matches[highlight] ? `${listId}-${highlight}` : undefined;

    return (
        <div className={cn('relative', className)}>
            <div className="relative">
                {selected && !open ? (
                    <Avatar name={selected.name} src={selected.avatar ?? undefined} size="sm" className="pointer-events-none absolute left-2 top-1/2 h-6 w-6 -translate-y-1/2 text-xs" />
                ) : (
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <input
                    ref={inputRef}
                    id={id}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOptionId}
                    aria-invalid={invalid || undefined}
                    autoComplete="off"
                    autoFocus={autoFocus}
                    disabled={disabled}
                    value={open ? query : selected?.name ?? ''}
                    placeholder={loading ? 'Carregando alunos…' : placeholder}
                    onFocus={() => setOpen(true)}
                    onClick={() => setOpen(true)}
                    onBlur={() => {
                        setOpen(false);
                        setQuery('');
                    }}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={onKeyDown}
                    className={cn(
                        'h-10 w-full rounded-xl border bg-background pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60',
                        invalid ? 'border-red-500' : 'border-border'
                    )}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-xl"
                >
                    {matches.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-muted-foreground">
                            {loading ? 'Carregando alunos…' : 'Nenhum aluno encontrado.'}
                        </li>
                    ) : (
                        matches.map((student, index) => (
                            <li
                                key={student.id}
                                id={`${listId}-${index}`}
                                data-index={index}
                                role="option"
                                aria-selected={index === highlight}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setHighlight(index)}
                                onClick={() => choose(student)}
                                className={cn(
                                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm',
                                    index === highlight ? 'bg-muted' : '',
                                    student.id === value && 'font-semibold'
                                )}
                            >
                                <Avatar name={student.name} src={student.avatar ?? undefined} size="sm" className="h-7 w-7 text-xs" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-foreground">{student.name}</span>
                                    {student.email && <span className="block truncate text-xs text-muted-foreground">{student.email}</span>}
                                </span>
                                {student.hint && <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{student.hint}</span>}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
