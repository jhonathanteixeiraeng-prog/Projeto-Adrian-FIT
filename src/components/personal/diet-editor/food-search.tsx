'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Clock, Loader2, Plus, Search, Star } from 'lucide-react';
import { cn, normalizeText } from '@/lib/utils';
import { foodKey, type FoodSnapshot } from './model';
import { formatGrams, formatKcal } from './units';

const SEARCH_DEBOUNCE_MS = 200;
const resultCache = new Map<string, FoodSnapshot[]>();

/** Limpa o cache da busca (ex.: depois de cadastrar um alimento próprio). */
export function clearFoodSearchCache() {
    resultCache.clear();
}

function toSnapshot(raw: any): FoodSnapshot {
    return {
        id: typeof raw?.id === 'string' ? raw.id : undefined,
        name: String(raw?.name || ''),
        portion: String(raw?.portion || '100g'),
        calories: Number(raw?.calories) || 0,
        protein: Number(raw?.protein) || 0,
        carbs: Number(raw?.carbs) || 0,
        fat: Number(raw?.fat) || 0,
        isSystem: raw?.isSystem !== false,
        source: raw?.isSystem === false ? 'custom' : undefined,
    };
}

type Option =
    | { kind: 'food'; food: FoodSnapshot; section?: 'Favoritos' | 'Recentes' }
    | { kind: 'create'; name: string };

interface FoodSearchProps {
    mealUid: string;
    mealName: string;
    recents: FoodSnapshot[];
    favorites: FoodSnapshot[];
    favoriteKeys: Set<string>;
    onToggleFavorite: (food: FoodSnapshot) => void;
    onPick: (mealUid: string, food: FoodSnapshot) => void;
    onCreateCustom: (mealUid: string, name: string) => void;
}

/**
 * Busca inline "Adicionar alimento" de uma refeição: ↑/↓ + Enter adiciona; Esc limpa/fecha.
 * Enter antes de a busca terminar adiciona o primeiro resultado assim que ele chegar.
 */
export function FoodSearch({
    mealUid,
    mealName,
    recents,
    favorites,
    favoriteKeys,
    onToggleFavorite,
    onPick,
    onCreateCustom,
}: FoodSearchProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const [results, setResults] = useState<FoodSnapshot[]>([]);
    const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const pendingPickRef = useRef(false);
    const listRef = useRef<HTMLUListElement>(null);
    const listId = useId();
    const trimmed = query.trim();
    const searching = trimmed.length >= 2;

    useEffect(() => {
        pendingPickRef.current = false;
        if (!searching) {
            setResults([]);
            setStatus('idle');
            return;
        }
        const key = normalizeText(trimmed);
        const cached = resultCache.get(key);
        if (cached) {
            setResults(cached);
            setStatus('done');
            setHighlight(0);
            return;
        }
        setStatus('loading');
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/foods/search?q=${encodeURIComponent(trimmed)}&limit=20`, {
                    signal: controller.signal,
                    cache: 'no-store',
                });
                const body = await response.json().catch(() => null);
                if (!response.ok || !body?.success) throw new Error(body?.error || 'Erro ao buscar alimentos');
                const foods = (Array.isArray(body.data) ? body.data : []).map(toSnapshot);
                resultCache.set(key, foods);
                setResults(foods);
                setStatus('done');
                setHighlight(0);
            } catch (error) {
                if ((error as Error)?.name === 'AbortError') return;
                setResults([]);
                setStatus('error');
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [trimmed, searching]);

    const options = useMemo<Option[]>(() => {
        if (searching) {
            const list: Option[] = results.map((food) => ({ kind: 'food', food }));
            list.push({ kind: 'create', name: trimmed });
            return list;
        }
        const favoriteOptions: Option[] = favorites.map((food) => ({ kind: 'food', food, section: 'Favoritos' }));
        const recentOptions: Option[] = recents
            .filter((food) => !favoriteKeys.has(foodKey(food)))
            .map((food) => ({ kind: 'food', food, section: 'Recentes' }));
        return [...favoriteOptions, ...recentOptions];
    }, [searching, results, trimmed, favorites, recents, favoriteKeys]);

    useEffect(() => {
        if (highlight >= options.length) setHighlight(Math.max(options.length - 1, 0));
    }, [options.length, highlight]);

    useEffect(() => {
        if (!open) return;
        listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const select = (option: Option | undefined) => {
        if (!option) return;
        if (option.kind === 'create') {
            onCreateCustom(mealUid, option.name);
        } else {
            onPick(mealUid, option.food);
        }
        setQuery('');
        setOpen(false);
        setHighlight(0);
    };

    const selectRef = useRef(select);
    selectRef.current = select;

    // Enter pressionado enquanto a busca carregava: usa o primeiro resultado quando chegar
    // (ou o cadastro de alimento próprio, única opção quando nada é encontrado).
    useEffect(() => {
        if (status !== 'done' || !pendingPickRef.current) return;
        pendingPickRef.current = false;
        selectRef.current(results[0] ? { kind: 'food', food: results[0] } : { kind: 'create', name: trimmed });
    }, [status, results, trimmed]);

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        // Alt+↑/↓ move a refeição (tratado no cartão da refeição).
        if (event.altKey) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setHighlight((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (searching && status === 'loading') {
                pendingPickRef.current = true;
                return;
            }
            if (open && options[highlight]) select(options[highlight]);
        } else if (event.key === 'Escape') {
            if (query) {
                event.preventDefault();
                setQuery('');
            } else if (open) {
                event.preventDefault();
                setOpen(false);
            }
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    };

    const showList = open && (searching || options.length > 0);
    const activeOptionId = showList && options[highlight] ? `${listId}-${highlight}` : undefined;

    return (
        <div className="relative">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    data-focus-id={`${mealUid}:search`}
                    data-field="search"
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOptionId}
                    aria-label={`Adicionar alimento em ${mealName || 'refeição'}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={query}
                    placeholder="Adicionar alimento… digite para buscar ( / )"
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        setHighlight(0);
                    }}
                    onKeyDown={onKeyDown}
                    className="h-9 w-full rounded-lg border border-dashed border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-solid focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25"
                />
                {status === 'loading' && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
                )}
            </div>

            {showList && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label="Alimentos"
                    className="absolute left-0 top-full z-30 mt-1 max-h-80 w-full min-w-[20rem] max-w-2xl overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-xl"
                >
                    {searching && status === 'loading' && results.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Buscando “{trimmed}”…</li>
                    )}
                    {searching && status === 'error' && (
                        <li className="px-3 py-2 text-sm text-red-500">Não foi possível buscar agora. Tente novamente.</li>
                    )}
                    {searching && status === 'done' && results.length === 0 && (
                        <li className="px-3 py-2 text-sm text-muted-foreground">Nenhum alimento encontrado para “{trimmed}”.</li>
                    )}
                    {options.map((option, index) => {
                        const previous = options[index - 1];
                        const section = option.kind === 'food' ? option.section : undefined;
                        const showSection = section && (!previous || previous.kind !== 'food' || previous.section !== section);
                        const highlighted = index === highlight;
                        return (
                            <React.Fragment key={option.kind === 'food' ? `${section ?? 'r'}-${foodKey(option.food)}-${index}` : 'create'}>
                                {showSection && (
                                    <li role="presentation" className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        {section === 'Favoritos' ? <Star className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                        {section}
                                    </li>
                                )}
                                <li
                                    id={`${listId}-${index}`}
                                    data-index={index}
                                    role="option"
                                    aria-selected={highlighted}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseEnter={() => setHighlight(index)}
                                    onClick={() => select(option)}
                                    className={cn(
                                        'group flex cursor-pointer items-center gap-3 px-3 py-2',
                                        highlighted && 'bg-muted',
                                        option.kind === 'create' && 'border-t border-border'
                                    )}
                                >
                                    {option.kind === 'create' ? (
                                        <>
                                            <Plus className="h-4 w-4 shrink-0 text-[#F88022]" />
                                            <span className="text-sm text-foreground">
                                                Cadastrar alimento próprio “<strong>{option.name}</strong>”
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="truncate text-sm font-medium text-foreground">{option.food.name}</span>
                                                    {option.food.source === 'custom' && (
                                                        <span className="shrink-0 rounded-md bg-[#F88022]/10 px-1.5 text-xs font-semibold text-[#F88022]">Próprio</span>
                                                    )}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {option.food.portion} · {formatKcal(option.food.calories)} kcal · P {formatGrams(option.food.protein)} · C{' '}
                                                    {formatGrams(option.food.carbs)} · G {formatGrams(option.food.fat)}
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                aria-label={favoriteKeys.has(foodKey(option.food)) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                                title={favoriteKeys.has(foodKey(option.food)) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onToggleFavorite(option.food);
                                                }}
                                                className={cn(
                                                    'shrink-0 rounded-md p-1 transition-colors hover:bg-background',
                                                    favoriteKeys.has(foodKey(option.food))
                                                        ? 'text-amber-500'
                                                        : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                                                )}
                                            >
                                                <Star className={cn('h-4 w-4', favoriteKeys.has(foodKey(option.food)) && 'fill-current')} />
                                            </button>
                                        </>
                                    )}
                                </li>
                            </React.Fragment>
                        );
                    })}
                    {!searching && options.length > 0 && (
                        <li role="presentation" className="border-t border-border px-3 pt-2 pb-1 text-xs text-muted-foreground">
                            Digite ao menos 2 letras para buscar na base TACO e nos seus alimentos.
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
