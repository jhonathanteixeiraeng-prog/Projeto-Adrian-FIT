'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn, matchesSearch } from '@/lib/utils';

/** Subset of GET /api/students used by the pickers. */
export interface StudentOption {
    id: string;
    status?: string | null;
    user: { id?: string; name: string; email?: string | null; avatar?: string | null };
    workoutPlans?: { id: string; title: string }[];
}

interface StudentPickerProps {
    students: StudentOption[] | undefined;
    value: string;
    onChange: (studentId: string) => void;
    loading?: boolean;
    invalid?: boolean;
    id?: string;
    autoFocus?: boolean;
    /** Always-visible list (inside dialogs) instead of a dropdown. */
    inline?: boolean;
    placeholder?: string;
    className?: string;
}

const byName = (a: StudentOption, b: StudentOption) => a.user.name.localeCompare(b.user.name, 'pt-BR');

/** Searchable student selector (accent-insensitive, ↑/↓/Enter). Nothing is preselected. */
export function StudentPicker({
    students,
    value,
    onChange,
    loading,
    invalid,
    id,
    autoFocus,
    inline = false,
    placeholder = 'Buscar aluno pelo nome ou e-mail…',
    className,
}: StudentPickerProps) {
    const generatedId = useId();
    const inputId = id ?? `student-picker-${generatedId}`;
    const listId = `${inputId}-list`;
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(inline);
    const [highlight, setHighlight] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = students?.find((student) => student.id === value) ?? null;
    const results = useMemo(
        () =>
            (students ?? [])
                .filter((student) => matchesSearch(query, student.user.name, student.user.email))
                .sort(byName),
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
        if (!inline) {
            setOpen(false);
            inputRef.current?.blur();
        }
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((current) => Math.max(current - 1, 0));
        } else if (event.key === 'Enter') {
            const student = results[highlight];
            // Let a dialog form submit when the highlighted student is already the chosen one.
            if (student && student.id !== value) {
                event.preventDefault();
                choose(student);
            } else if (!inline) {
                event.preventDefault();
            }
        } else if (event.key === 'Escape' && !inline && open) {
            event.preventDefault();
            setOpen(false);
            setQuery('');
        }
    };

    const list = (
        <div
            ref={listRef}
            id={listId}
            role="listbox"
            className={cn(
                'overflow-y-auto',
                inline
                    ? 'mt-2 max-h-56 rounded-xl border border-border'
                    : 'absolute left-0 right-0 top-full z-40 mt-1 max-h-72 rounded-xl border border-border bg-card p-1 shadow-xl'
            )}
        >
            {loading && !students ? (
                <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando alunos…
                </p>
            ) : results.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                    {students?.length ? 'Nenhum aluno encontrado.' : 'Você ainda não tem alunos cadastrados.'}
                </p>
            ) : (
                results.map((student, index) => {
                    const isSelected = student.id === value;
                    const activePlan = student.workoutPlans?.[0];
                    return (
                        <div
                            key={student.id}
                            id={`${listId}-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(student)}
                            onMouseMove={() => setHighlight(index)}
                            className={cn(
                                'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
                                inline ? 'border-b border-border/60 last:border-0' : 'rounded-lg',
                                index === highlight && 'bg-muted',
                                isSelected && 'text-primary'
                            )}
                        >
                            <Avatar name={student.user.name} src={student.user.avatar ?? undefined} size="sm" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{student.user.name}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {activePlan ? `Ficha ativa: ${activePlan.title}` : 'Sem ficha ativa'}
                                    {student.status && student.status !== 'ACTIVE' ? ' · aluno inativo' : ''}
                                </p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0" />}
                        </div>
                    );
                })
            )}
        </div>
    );

    return (
        <div className={cn('relative', className)}>
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    id={inputId}
                    ref={inputRef}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-activedescendant={open && results[highlight] ? `${listId}-${highlight}` : undefined}
                    aria-invalid={invalid || undefined}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    value={!inline && !open && selected ? selected.user.name : query}
                    placeholder={!inline && selected ? selected.user.name : placeholder}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => {
                        if (!inline) {
                            setOpen(false);
                            setQuery('');
                        }
                    }}
                    onKeyDown={onKeyDown}
                    className={cn(
                        'h-9 w-full rounded-lg border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
                        invalid ? 'border-red-500' : 'border-border',
                        !inline && selected && !open && 'font-medium'
                    )}
                />
                {!inline && <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
            </div>
            {open && list}
        </div>
    );
}
