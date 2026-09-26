'use client';

import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, CornerDownLeft, Plus, Replace, Search, Star, X } from 'lucide-react';
import { cn, matchesSearch, normalizeText } from '@/lib/utils';
import { useLocalStorageState } from '@/hooks/use-local-storage';
import type { LibraryExercise } from './editor-state';

type LibraryTab = 'all' | 'recent' | 'favorites';

interface ExerciseLibraryProps {
    exercises: LibraryExercise[] | undefined;
    isLoading: boolean;
    error?: Error;
    onRetry?: () => void;
    /** Name of the day that receives the exercises. */
    targetLabel: string;
    /** When set, picking replaces this exercise instead of adding. */
    swapTargetName: string | null;
    onCancelSwap: () => void;
    /** exerciseId → how many times it is already in the target day. */
    countsInTarget: Record<string, number>;
    recentIds: string[];
    onPick: (exercises: LibraryExercise[]) => void;
    onRequestCreate: (name: string) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    autoFocus?: boolean;
    onDragExercises?: (exercises: LibraryExercise[]) => void;
    onDragEnd?: () => void;
    /** Esc with an empty search. */
    onEscapeEmpty?: () => void;
    className?: string;
}

export const FAVORITES_STORAGE_KEY = 'personal:exercise-favorites';

function rank(exercise: LibraryExercise, query: string) {
    if (!query) return 0;
    const name = normalizeText(exercise.name);
    if (name.startsWith(query)) return 0;
    if (name.includes(` ${query}`)) return 1;
    return 2;
}

function ExerciseLibraryComponent({
    exercises,
    isLoading,
    error,
    onRetry,
    targetLabel,
    swapTargetName,
    onCancelSwap,
    countsInTarget,
    recentIds,
    onPick,
    onRequestCreate,
    inputRef,
    autoFocus,
    onDragExercises,
    onDragEnd,
    onEscapeEmpty,
    className,
}: ExerciseLibraryProps) {
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState<LibraryTab>('all');
    const [muscle, setMuscle] = useState('');
    const [equipment, setEquipment] = useState('');
    const [highlight, setHighlight] = useState(0);
    const [selected, setSelected] = useState<string[]>([]);
    const [favorites, setFavorites] = useLocalStorageState<string[]>(FAVORITES_STORAGE_KEY, []);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = `exercise-library-${useId().replace(/:/g, '')}`;

    const all = useMemo(() => exercises ?? [], [exercises]);
    const byId = useMemo(() => new Map(all.map((exercise) => [exercise.id, exercise])), [all]);
    const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
    const muscleGroups = useMemo(
        () => Array.from(new Set(all.map((exercise) => exercise.muscleGroup).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [all]
    );
    const equipments = useMemo(
        () =>
            Array.from(new Set(all.map((exercise) => exercise.equipment?.trim() || '').filter(Boolean))).sort((a, b) =>
                a.localeCompare(b, 'pt-BR')
            ),
        [all]
    );

    const recents = useMemo(
        () => recentIds.map((id) => byId.get(id)).filter((exercise): exercise is LibraryExercise => Boolean(exercise)),
        [recentIds, byId]
    );

    const results = useMemo(() => {
        const base = tab === 'recent' ? recents : tab === 'favorites' ? all.filter((exercise) => favoriteSet.has(exercise.id)) : all;
        const normalizedQuery = normalizeText(query);
        const filtered = base.filter(
            (exercise) =>
                (!muscle || exercise.muscleGroup === muscle) &&
                (!equipment || (exercise.equipment?.trim() || '') === equipment) &&
                matchesSearch(query, exercise.name, exercise.muscleGroup, exercise.equipment)
        );
        if (tab === 'recent' && !normalizedQuery) return filtered;
        return filtered
            .map((exercise) => ({ exercise, score: rank(exercise, normalizedQuery) }))
            .sort((a, b) => a.score - b.score || a.exercise.name.localeCompare(b.exercise.name, 'pt-BR'))
            .map((entry) => entry.exercise);
    }, [tab, recents, all, favoriteSet, query, muscle, equipment]);

    useEffect(() => {
        setHighlight(0);
    }, [query, tab, muscle, equipment]);

    useEffect(() => {
        if (highlight > 0 && highlight >= results.length) setHighlight(Math.max(results.length - 1, 0));
    }, [results.length, highlight]);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight]);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus, inputRef]);

    const filtersActive = Boolean(muscle || equipment || tab !== 'all');
    const selectedExercises = selected.map((id) => byId.get(id)).filter((exercise): exercise is LibraryExercise => Boolean(exercise));

    const pick = (list: LibraryExercise[]) => {
        if (!list.length) return;
        onPick(list);
        setSelected([]);
        inputRef.current?.focus();
    };

    const toggleSelected = (id: string) => {
        setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
        inputRef.current?.focus();
    };

    const toggleFavorite = (id: string) => {
        setFavorites((current) => (current.includes(id) ? current.filter((value) => value !== id) : [id, ...current]));
        inputRef.current?.focus();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'PageDown' || event.key === 'PageUp') {
            event.preventDefault();
            const step = event.key === 'PageDown' ? 8 : event.key === 'PageUp' ? -8 : event.key === 'ArrowDown' ? 1 : -1;
            setHighlight((current) => Math.max(0, Math.min(current + step, results.length - 1)));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (event.nativeEvent.isComposing) return;
            if (selectedExercises.length && !swapTargetName) pick(selectedExercises);
            else if (results[highlight]) pick([results[highlight]]);
            else if (query.trim()) onRequestCreate(query.trim());
        } else if (event.key === 'Escape') {
            if (swapTargetName) {
                event.preventDefault();
                onCancelSwap();
            } else if (query) {
                event.preventDefault();
                setQuery('');
            } else {
                onEscapeEmpty?.();
            }
        }
    };

    const chip = (active: boolean) =>
        cn(
            'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
            active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
        );

    const tabButton = (value: LibraryTab, label: string, count?: number) => (
        <button
            type="button"
            tabIndex={-1}
            onClick={() => setTab(value)}
            className={cn(
                'flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                tab === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
        >
            {label}
            {count !== undefined && <span className="ml-1 font-normal text-muted-foreground">{count}</span>}
        </button>
    );

    return (
        <div className={cn('flex min-h-0 flex-col', className)}>
            <div className="space-y-2.5 border-b border-border p-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Biblioteca de exercícios</h2>
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onRequestCreate(query.trim())}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                        <Plus className="h-3.5 w-3.5" /> Novo
                    </button>
                </div>

                {swapTargetName ? (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <Replace className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <p className="min-w-0 flex-1">
                            Trocando <strong className="font-semibold">{swapTargetName}</strong>: escolha o novo exercício.
                        </p>
                        <button type="button" onClick={onCancelSwap} className="font-semibold underline-offset-2 hover:underline">
                            Cancelar
                        </button>
                    </div>
                ) : (
                    <p className="truncate text-xs text-muted-foreground">
                        Adicionando em <strong className="font-semibold text-foreground">{targetLabel}</strong>
                    </p>
                )}

                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        role="combobox"
                        aria-label="Buscar exercício"
                        aria-expanded
                        aria-controls={listId}
                        aria-activedescendant={results[highlight] ? `${listId}-${results[highlight].id}` : undefined}
                        autoComplete="off"
                        spellCheck={false}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Buscar exercício, músculo ou equipamento"
                        className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    {query ? (
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label="Limpar busca"
                            onClick={() => {
                                setQuery('');
                                inputRef.current?.focus();
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 text-xs text-muted-foreground">
                            /
                        </kbd>
                    )}
                </div>

                <div className="flex rounded-lg bg-muted p-0.5">
                    {tabButton('all', 'Todos', all.length)}
                    {tabButton('recent', 'Recentes', recents.length)}
                    {tabButton('favorites', 'Favoritos', favorites.filter((id) => byId.has(id)).length)}
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button type="button" tabIndex={-1} className={chip(!muscle)} onClick={() => setMuscle('')}>
                        Todos
                    </button>
                    {muscleGroups.map((group) => (
                        <button
                            key={group}
                            type="button"
                            tabIndex={-1}
                            className={chip(muscle === group)}
                            onClick={() => setMuscle(muscle === group ? '' : group)}
                        >
                            {group}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <select
                        aria-label="Filtrar por equipamento"
                        tabIndex={-1}
                        value={equipment}
                        onChange={(event) => setEquipment(event.target.value)}
                        className={cn(
                            'h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs focus:border-primary focus:outline-none',
                            equipment ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
                        )}
                    >
                        <option value="">Qualquer equipamento</option>
                        {equipments.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                    {filtersActive && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => {
                                setMuscle('');
                                setEquipment('');
                                setTab('all');
                            }}
                            className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                            Limpar filtros
                        </button>
                    )}
                </div>
            </div>

            <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
                {isLoading && !exercises ? (
                    <div className="space-y-1.5 p-1.5">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="skeleton-shimmer h-10" />
                        ))}
                    </div>
                ) : error && !exercises ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Não foi possível carregar os exercícios.
                        {onRetry && (
                            <button type="button" onClick={onRetry} className="font-semibold text-primary hover:underline">
                                Tentar novamente
                            </button>
                        )}
                    </div>
                ) : results.length === 0 ? (
                    <div className="space-y-3 px-4 py-8 text-center text-sm text-muted-foreground">
                        <p>
                            {tab === 'favorites' && !query && !muscle && !equipment
                                ? 'Marque exercícios com ★ para vê-los aqui.'
                                : tab === 'recent' && !query && !muscle && !equipment
                                  ? 'Os exercícios que você adicionar aparecem aqui.'
                                  : query
                                    ? `Nenhum exercício encontrado para “${query}”.`
                                    : 'Nenhum exercício com esses filtros.'}
                        </p>
                        {query.trim() && (
                            <button
                                type="button"
                                onClick={() => onRequestCreate(query.trim())}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                                <Plus className="h-4 w-4" />
                                Criar exercício “{query.trim()}”
                            </button>
                        )}
                        {filtersActive && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMuscle('');
                                    setEquipment('');
                                    setTab('all');
                                }}
                                className="block w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    results.map((exercise, index) => {
                        const isHighlighted = index === highlight;
                        const isSelected = selected.includes(exercise.id);
                        const inDay = countsInTarget[exercise.id] ?? 0;
                        const isFavorite = favoriteSet.has(exercise.id);
                        return (
                            <div
                                key={exercise.id}
                                id={`${listId}-${exercise.id}`}
                                data-index={index}
                                role="option"
                                aria-selected={isHighlighted}
                                draggable={Boolean(onDragExercises)}
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'copyMove';
                                    event.dataTransfer.setData('text/plain', exercise.name);
                                    onDragExercises?.(isSelected ? selectedExercises : [exercise]);
                                }}
                                onDragEnd={onDragEnd}
                                onMouseDown={(event) => {
                                    // Keep focus in the search box while clicking results (Firefox cancels drags
                                    // when mousedown is prevented, so only do it where dragging is off).
                                    if (!onDragExercises && (event.target as HTMLElement).tagName !== 'INPUT') event.preventDefault();
                                }}
                                onMouseMove={() => !isHighlighted && setHighlight(index)}
                                onClick={() => pick([exercise])}
                                title={swapTargetName ? 'Clique para trocar' : `Clique ou Enter para adicionar em ${targetLabel}`}
                                className={cn(
                                    'group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5',
                                    isHighlighted ? 'bg-muted' : 'hover:bg-muted/60',
                                    isSelected && 'bg-primary/10'
                                )}
                            >
                                {isHighlighted && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
                                {!swapTargetName && (
                                    <input
                                        type="checkbox"
                                        tabIndex={-1}
                                        aria-label={`Selecionar ${exercise.name}`}
                                        checked={isSelected}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={() => toggleSelected(exercise.id)}
                                        className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-border accent-primary"
                                    />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">{exercise.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {exercise.muscleGroup}
                                        {exercise.equipment ? ` · ${exercise.equipment}` : ''}
                                    </p>
                                </div>
                                {inDay > 0 && !swapTargetName && (
                                    <span
                                        className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                        title={`Já está em ${targetLabel}`}
                                    >
                                        <Check className="h-3 w-3" />
                                        {inDay > 1 ? `×${inDay}` : 'no dia'}
                                    </span>
                                )}
                                {isHighlighted && (
                                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                )}
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    aria-label={isFavorite ? `Remover ${exercise.name} dos favoritos` : `Favoritar ${exercise.name}`}
                                    title={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleFavorite(exercise.id);
                                    }}
                                    className={cn(
                                        'shrink-0 rounded p-0.5 transition-colors',
                                        isFavorite ? 'text-amber-500' : 'text-muted-foreground/40 opacity-0 hover:text-amber-500 group-hover:opacity-100'
                                    )}
                                >
                                    <Star className={cn('h-3.5 w-3.5', isFavorite && 'fill-current')} />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {selected.length > 0 && !swapTargetName ? (
                <div className="flex items-center gap-2 border-t border-border bg-primary/5 p-2">
                    <button
                        type="button"
                        onClick={() => pick(selectedExercises)}
                        className="flex-1 truncate rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                        Adicionar {selected.length} em {targetLabel}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelected([])}
                        className="rounded-lg px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        Limpar
                    </button>
                </div>
            ) : (
                <p className="hidden border-t border-border px-3 py-2 text-xs text-muted-foreground lg:block">
                    ↑↓ navegar · Enter adicionar · Esc limpa a busca · arraste para um dia
                </p>
            )}
        </div>
    );
}

export const ExerciseLibrary = memo(ExerciseLibraryComponent);
