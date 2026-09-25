'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Dumbbell,
    Globe2,
    LayoutGrid,
    LayoutList,
    Pencil,
    PlayCircle,
    Plus,
    Search,
    Trash2,
    UserRound,
    X,
} from 'lucide-react';
import { useDialogs, useToast } from '@/components/ui';
import { cn, matchesSearch } from '@/lib/utils';
import { useApi } from '@/hooks/use-api';
import { useHotkey } from '@/hooks/use-hotkey';
import { useUrlStateGroup } from '@/hooks/use-url-state';
import { usePageMeta } from '@/components/personal/page-meta';
import { ActionMenu } from '@/components/personal/workout-editor/action-menu';
import type { LibraryExercise } from '@/components/personal/workout-editor/editor-state';
import { ExerciseFormDialog } from '@/components/personal/exercises/exercise-form-dialog';
import { ExerciseVideoDialog } from '@/components/personal/exercises/exercise-video-dialog';
import {
    DIFFICULTIES,
    DIFFICULTY_BADGE,
    DIFFICULTY_LABELS,
    difficultyLabel,
    getExerciseThumbnail,
} from '@/components/personal/exercises/exercise-constants';

const byName = (a: LibraryExercise, b: LibraryExercise) => a.name.localeCompare(b.name, 'pt-BR');

const selectClass =
    'h-9 rounded-lg border bg-card px-2.5 text-sm focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';

function Thumbnail({ exercise, onPlay, className }: { exercise: LibraryExercise; onPlay: () => void; className?: string }) {
    const [failed, setFailed] = useState(false);
    const src = getExerciseThumbnail(exercise);
    const hasVideo = Boolean(exercise.videoUrl);
    const content =
        src && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        ) : (
            <Dumbbell className="h-4 w-4 text-muted-foreground/60" />
        );
    if (!hasVideo) {
        return <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', className)}>{content}</div>;
    }
    return (
        <button
            type="button"
            tabIndex={-1}
            onClick={(event) => {
                event.stopPropagation();
                onPlay();
            }}
            title="Ver vídeo"
            aria-label={`Ver vídeo de ${exercise.name}`}
            className={cn('group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted', className)}
        >
            {content}
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-90 transition-opacity group-hover:bg-black/40">
                <PlayCircle className="h-5 w-5 text-white drop-shadow" />
            </span>
        </button>
    );
}

function OwnerBadge({ exercise }: { exercise: LibraryExercise }) {
    return exercise.personalId ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#F88022]/10 px-2 py-0.5 text-xs font-medium text-[#F88022]">
            <UserRound className="h-3 w-3" /> Meu
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <Globe2 className="h-3 w-3" /> Global
        </span>
    );
}

function DifficultyBadge({ value }: { value: string }) {
    return (
        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', DIFFICULTY_BADGE[value] ?? 'bg-muted text-muted-foreground')}>
            {difficultyLabel(value)}
        </span>
    );
}

export default function ExercisesPage() {
    usePageMeta({ title: 'Exercícios', breadcrumbs: [{ label: 'Exercícios' }] });
    const { toast } = useToast();
    const { confirm } = useDialogs();
    const { data, error, isLoading, mutate } = useApi<LibraryExercise[]>('/api/exercises');

    const [filters, setFilters] = useUrlStateGroup({
        q: '',
        muscle: '',
        equipment: '',
        difficulty: '',
        owner: 'all',
        view: 'table',
        sort: 'name',
    });
    const [query, setQuery] = useState(filters.q);
    const [highlight, setHighlight] = useState(-1);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<LibraryExercise | null>(null);
    const [playing, setPlaying] = useState<LibraryExercise | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Search updates the URL shortly after typing (no router work on every keystroke).
    useEffect(() => {
        if (query === filters.q) return;
        const id = window.setTimeout(() => setFilters({ q: query }), 300);
        return () => window.clearTimeout(id);
    }, [query, filters.q, setFilters]);

    const exercises = useMemo(() => data ?? [], [data]);
    const muscleGroups = useMemo(
        () => Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [exercises]
    );
    const equipments = useMemo(
        () =>
            Array.from(new Set(exercises.map((exercise) => exercise.equipment?.trim() || '').filter(Boolean))).sort((a, b) =>
                a.localeCompare(b, 'pt-BR')
            ),
        [exercises]
    );

    const results = useMemo(() => {
        const filtered = exercises.filter(
            (exercise) =>
                matchesSearch(query, exercise.name, exercise.muscleGroup, exercise.equipment) &&
                (!filters.muscle || exercise.muscleGroup === filters.muscle) &&
                (!filters.equipment || (exercise.equipment?.trim() || '') === filters.equipment) &&
                (!filters.difficulty || exercise.difficulty === filters.difficulty) &&
                (filters.owner === 'all' || (filters.owner === 'mine' ? Boolean(exercise.personalId) : !exercise.personalId))
        );
        if (filters.sort === 'group') {
            return filtered.sort((a, b) => a.muscleGroup.localeCompare(b.muscleGroup, 'pt-BR') || byName(a, b));
        }
        if (filters.sort === 'recent') {
            return filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byName(a, b));
        }
        return filtered.sort(byName);
    }, [exercises, query, filters.muscle, filters.equipment, filters.difficulty, filters.owner, filters.sort]);

    useEffect(() => {
        setHighlight(-1);
    }, [query, filters.muscle, filters.equipment, filters.difficulty, filters.owner, filters.sort]);

    useEffect(() => {
        if (highlight < 0) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight]);

    const stats = useMemo(
        () => ({
            total: exercises.length,
            withVideo: exercises.filter((exercise) => exercise.videoUrl).length,
            mine: exercises.filter((exercise) => exercise.personalId).length,
        }),
        [exercises]
    );

    const filtersActive = Boolean(query || filters.muscle || filters.equipment || filters.difficulty || filters.owner !== 'all');
    const clearFilters = () => {
        setQuery('');
        setFilters({ q: '', muscle: '', equipment: '', difficulty: '', owner: 'all' });
    };

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const openEdit = (exercise: LibraryExercise) => {
        setEditing(exercise);
        setFormOpen(true);
    };

    const handleSaved = (saved: LibraryExercise, mode: 'create' | 'update') => {
        void mutate(
            (current) => [...(current ?? []).filter((exercise) => exercise.id !== saved.id), saved].sort(byName),
            { revalidate: false }
        );
        toast.success(mode === 'create' ? 'Exercício criado' : 'Exercício atualizado', saved.name);
    };

    const handleDelete = async (exercise: LibraryExercise) => {
        const ok = await confirm({
            title: `Excluir “${exercise.name}”?`,
            description: exercise.personalId
                ? 'O exercício sai da sua biblioteca. Exercícios usados em fichas, modelos ou no histórico de cargas não podem ser excluídos.'
                : 'Este é um exercício da biblioteca global: ele deixa de aparecer para todos os personais. Exercícios em uso não podem ser excluídos.',
            confirmText: 'Excluir exercício',
            variant: 'danger',
        });
        if (!ok) return;
        try {
            const response = await fetch(`/api/exercises/${exercise.id}`, { method: 'DELETE' });
            const result = await response.json().catch(() => null);
            if (!response.ok || result?.success === false) {
                toast.error('Não foi possível excluir', result?.error || 'Tente novamente em instantes.');
                return;
            }
            void mutate((current) => (current ?? []).filter((item) => item.id !== exercise.id), { revalidate: false });
            toast.success('Exercício excluído', exercise.name);
        } catch {
            toast.error('Não foi possível excluir', 'Erro de conexão. Verifique sua internet.');
        }
    };

    useHotkey('/', () => {
        searchRef.current?.focus();
        searchRef.current?.select();
    });
    useHotkey(['arrowdown', 'arrowup'], (event) => {
        if (!results.length) return;
        setHighlight((current) =>
            event.key === 'ArrowDown' ? Math.min(current + 1, results.length - 1) : Math.max(current - 1, 0)
        );
    });
    useHotkey(
        'enter',
        (event) => {
            // Leave Enter alone on focused buttons/links (their own action).
            const active = document.activeElement;
            if (active && active !== document.body && active.closest('button, a, [role="menu"]')) return;
            if (highlight < 0 || !results[highlight]) return;
            event.preventDefault();
            openEdit(results[highlight]);
        },
        { enabled: highlight >= 0, preventDefault: false }
    );

    const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((current) =>
                event.key === 'ArrowDown' ? Math.min(current + 1, results.length - 1) : Math.max(current - 1, 0)
            );
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const target = results[Math.max(highlight, 0)];
            if (target) openEdit(target);
        } else if (event.key === 'Escape') {
            if (query) {
                event.preventDefault();
                setQuery('');
            } else {
                searchRef.current?.blur();
            }
        }
    };

    const rowMenu = (exercise: LibraryExercise) => [
        { label: 'Editar', icon: Pencil, onSelect: () => openEdit(exercise) },
        ...(exercise.videoUrl ? [{ label: 'Ver vídeo', icon: PlayCircle, onSelect: () => setPlaying(exercise) }] : []),
        { type: 'separator' as const },
        { label: 'Excluir', icon: Trash2, danger: true, onSelect: () => void handleDelete(exercise) },
    ];

    const view = filters.view === 'cards' ? 'cards' : 'table';

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Biblioteca de exercícios</h1>
                    <p className="text-sm text-muted-foreground">
                        {isLoading
                            ? 'Carregando…'
                            : `${stats.total} exercícios · ${stats.withVideo} com vídeo · ${stats.mine} criados por você`}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#F88022]/90"
                >
                    <Plus className="h-4 w-4" /> Novo exercício
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        ref={searchRef}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onSearchKeyDown}
                        placeholder="Buscar por nome, músculo ou equipamento"
                        aria-label="Buscar exercício"
                        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25"
                    />
                    {query ? (
                        <button
                            type="button"
                            aria-label="Limpar busca"
                            onClick={() => setQuery('')}
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
                <select
                    aria-label="Grupo muscular"
                    value={filters.muscle}
                    onChange={(event) => setFilters({ muscle: event.target.value })}
                    className={cn(selectClass, filters.muscle ? 'border-[#F88022] text-foreground' : 'border-border text-muted-foreground')}
                >
                    <option value="">Todos os músculos</option>
                    {muscleGroups.map((group) => (
                        <option key={group} value={group}>
                            {group}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Equipamento"
                    value={filters.equipment}
                    onChange={(event) => setFilters({ equipment: event.target.value })}
                    className={cn(selectClass, 'max-w-[200px]', filters.equipment ? 'border-[#F88022] text-foreground' : 'border-border text-muted-foreground')}
                >
                    <option value="">Qualquer equipamento</option>
                    {equipments.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
                <select
                    aria-label="Dificuldade"
                    value={filters.difficulty}
                    onChange={(event) => setFilters({ difficulty: event.target.value })}
                    className={cn(selectClass, filters.difficulty ? 'border-[#F88022] text-foreground' : 'border-border text-muted-foreground')}
                >
                    <option value="">Todas as dificuldades</option>
                    {DIFFICULTIES.map((difficulty) => (
                        <option key={difficulty} value={difficulty}>
                            {DIFFICULTY_LABELS[difficulty]}
                        </option>
                    ))}
                </select>
                <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Origem">
                    {[
                        { value: 'all', label: 'Todos' },
                        { value: 'mine', label: 'Meus' },
                        { value: 'global', label: 'Globais' },
                    ].map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilters({ owner: option.value })}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-sm font-medium',
                                filters.owner === option.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <select
                    aria-label="Ordenar"
                    value={filters.sort}
                    onChange={(event) => setFilters({ sort: event.target.value })}
                    className={cn(selectClass, 'border-border text-muted-foreground')}
                >
                    <option value="name">Nome (A–Z)</option>
                    <option value="group">Grupo muscular</option>
                    <option value="recent">Mais recentes</option>
                </select>
                <div className="flex rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Visualização">
                    <button
                        type="button"
                        onClick={() => setFilters({ view: 'table' })}
                        aria-pressed={view === 'table'}
                        title="Lista"
                        className={cn('rounded-md p-1.5', view === 'table' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                        <LayoutList className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilters({ view: 'cards' })}
                        aria-pressed={view === 'cards'}
                        title="Cards"
                        className={cn('rounded-md p-1.5', view === 'cards' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {filtersActive && !isLoading && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>
                        {results.length} de {exercises.length} exercícios
                    </span>
                    <button type="button" onClick={clearFilters} className="font-semibold text-[#F88022] hover:underline">
                        Limpar filtros
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2" aria-busy="true">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={index} className="skeleton-shimmer h-14" />
                    ))}
                </div>
            ) : error && !data ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
                    <AlertCircle className="h-6 w-6 text-red-500" />
                    <p className="text-sm text-muted-foreground">Não foi possível carregar os exercícios. {error.message}</p>
                    <button type="button" onClick={() => void mutate()} className="text-sm font-semibold text-[#F88022] hover:underline">
                        Tentar novamente
                    </button>
                </div>
            ) : exercises.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <Dumbbell className="h-8 w-8 text-muted-foreground" />
                    <p className="font-semibold text-foreground">Nenhum exercício na biblioteca</p>
                    <p className="text-sm text-muted-foreground">Cadastre o primeiro exercício para usá-lo nas fichas.</p>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#F88022] px-3 py-1.5 text-sm font-semibold text-white"
                    >
                        <Plus className="h-4 w-4" /> Novo exercício
                    </button>
                </div>
            ) : results.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
                    <p className="font-semibold text-foreground">Nenhum exercício encontrado</p>
                    <p className="text-sm text-muted-foreground">Ajuste a busca ou os filtros.</p>
                    <div className="mt-2 flex gap-2">
                        <button type="button" onClick={clearFilters} className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted">
                            Limpar filtros
                        </button>
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F88022] px-3 py-1.5 text-sm font-semibold text-white"
                        >
                            <Plus className="h-4 w-4" /> Criar exercício
                        </button>
                    </div>
                </div>
            ) : view === 'table' ? (
                <div ref={listRef} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="hidden grid-cols-[64px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_120px_96px_72px] items-center gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                        <span />
                        <span>Exercício</span>
                        <span>Grupo</span>
                        <span>Equipamento</span>
                        <span>Dificuldade</span>
                        <span>Origem</span>
                        <span />
                    </div>
                    <div className="divide-y divide-border/70">
                        {results.map((exercise, index) => (
                            <div
                                key={exercise.id}
                                data-index={index}
                                onClick={() => openEdit(exercise)}
                                onMouseMove={() => highlight !== index && setHighlight(index)}
                                className={cn(
                                    'grid cursor-pointer grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 md:grid-cols-[64px_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_120px_96px_72px]',
                                    index === highlight ? 'bg-muted/70' : 'hover:bg-muted/40'
                                )}
                            >
                                <Thumbnail exercise={exercise} onPlay={() => setPlaying(exercise)} className="h-9 w-14 md:w-16" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{exercise.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        <span className="md:hidden">
                                            {exercise.muscleGroup}
                                            {exercise.equipment ? ` · ${exercise.equipment}` : ''} · {difficultyLabel(exercise.difficulty)}
                                        </span>
                                        <span className="hidden md:inline">{exercise.instructions || 'Sem instruções cadastradas'}</span>
                                    </p>
                                </div>
                                <span className="hidden truncate text-sm text-foreground md:block">{exercise.muscleGroup}</span>
                                <span className="hidden truncate text-sm text-muted-foreground md:block">{exercise.equipment || '—'}</span>
                                <span className="hidden md:block">
                                    <DifficultyBadge value={exercise.difficulty} />
                                </span>
                                <span className="hidden md:block">
                                    <OwnerBadge exercise={exercise} />
                                </span>
                                <div className="flex items-center justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
                                    <button
                                        type="button"
                                        onClick={() => openEdit(exercise)}
                                        className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
                                        aria-label={`Editar ${exercise.name}`}
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <ActionMenu entries={rowMenu(exercise)} label={`Ações de ${exercise.name}`} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div ref={listRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {results.map((exercise, index) => (
                        <div
                            key={exercise.id}
                            data-index={index}
                            className={cn(
                                'overflow-hidden rounded-2xl border bg-card transition-colors',
                                index === highlight ? 'border-[#F88022]/60' : 'border-border hover:border-[#F88022]/40'
                            )}
                        >
                            <Thumbnail exercise={exercise} onPlay={() => setPlaying(exercise)} className="aspect-video w-full rounded-none" />
                            <div className="space-y-2 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(exercise)}
                                        className="min-w-0 text-left text-sm font-semibold text-foreground hover:text-[#F88022]"
                                    >
                                        {exercise.name}
                                    </button>
                                    <ActionMenu entries={rowMenu(exercise)} label={`Ações de ${exercise.name}`} />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                                        {exercise.muscleGroup}
                                    </span>
                                    <DifficultyBadge value={exercise.difficulty} />
                                    <OwnerBadge exercise={exercise} />
                                </div>
                                <p className="truncate text-xs text-muted-foreground">{exercise.equipment || 'Sem equipamento definido'}</p>
                                {exercise.instructions && <p className="line-clamp-2 text-xs text-muted-foreground">{exercise.instructions}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="hidden text-xs text-muted-foreground lg:block">
                Atalhos: / busca · ↑↓ navega · Enter edita
            </p>

            <ExerciseFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                exercise={editing}
                knownMuscleGroups={muscleGroups}
                knownEquipments={equipments}
                onSaved={handleSaved}
            />
            <ExerciseVideoDialog exercise={playing} onOpenChange={(open) => !open && setPlaying(null)} />
        </div>
    );
}
