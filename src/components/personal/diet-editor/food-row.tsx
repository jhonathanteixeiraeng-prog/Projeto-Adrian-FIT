'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Copy, CornerDownRight, MoreHorizontal, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, type MenuEntry } from './menu';
import { foodTotals, type EditorAction, type EditorFood, type FoodPatch } from './model';
import { describePortion, formatGrams, formatKcal, unitOptions, type UnitKey } from './units';

/** Grade compartilhada entre o cabeçalho de colunas e as linhas (somente em telas largas). */
export const FOOD_GRID =
    'lg:grid lg:grid-cols-[minmax(11rem,1.5fr)_4.75rem_minmax(7rem,10.5rem)_3.75rem_3.25rem_3.25rem_3.25rem_minmax(9rem,1fr)_4.75rem] lg:items-center lg:gap-x-2';

const SOURCE_BADGES: Record<string, { label: string; className: string; title: string }> = {
    custom: { label: 'Próprio', className: 'bg-primary/10 text-primary', title: 'Alimento cadastrado por você' },
    ai: { label: 'IA', className: 'bg-violet-500/10 text-violet-500', title: 'Sugerido pela IA — revise os valores' },
    rules: { label: 'Auto', className: 'bg-sky-500/10 text-sky-500', title: 'Sugerido pelo gerador automático' },
};

export interface MealRef {
    uid: string;
    name: string;
}

interface FoodRowProps {
    food: EditorFood;
    mealUid: string;
    index: number;
    count: number;
    meals: MealRef[];
    invalid: boolean;
    favorite: boolean;
    dispatch: React.Dispatch<EditorAction>;
    onMove: (mealUid: string, foodUid: string, delta: number, field: string) => void;
    onMoveToMeal: (fromMealUid: string, foodUid: string, toMealUid: string) => void;
    onDuplicate: (mealUid: string, foodUid: string) => void;
    onRemove: (mealUid: string, foodUid: string) => void;
    onAmountEnter: (mealUid: string) => void;
    onToggleFavorite: (food: EditorFood) => void;
}

const inputClass =
    'h-8 w-full rounded-md border border-transparent bg-muted/60 px-2 text-sm text-foreground placeholder:text-muted-foreground hover:border-border focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/25';

function FoodRowComponent({
    food,
    mealUid,
    index,
    count,
    meals,
    invalid,
    favorite,
    dispatch,
    onMove,
    onMoveToMeal,
    onDuplicate,
    onRemove,
    onAmountEnter,
    onToggleFavorite,
}: FoodRowProps) {
    const [substitutionOpen, setSubstitutionOpen] = useState(false);
    const options = unitOptions(describePortion(food.portion));
    const totals = foodTotals(food);
    const badge = food.source ? SOURCE_BADGES[food.source] : undefined;
    const showSubstitution = substitutionOpen || Boolean(food.substitutionNote);
    const massOption = options.find((option) => option.key === 'g' || option.key === 'ml');

    const update = (patch: FoodPatch) => dispatch({ type: 'updateFood', mealUid, foodUid: food.uid, patch });

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!event.altKey || event.metaKey || event.ctrlKey) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        event.stopPropagation();
        const field = (event.target as HTMLElement).dataset?.field || 'amount';
        onMove(mealUid, food.uid, event.key === 'ArrowUp' ? -1 : 1, field);
    };

    const otherMeals = meals.filter((meal) => meal.uid !== mealUid);
    const menuItems: MenuEntry[] = [
        { key: 'duplicate', label: 'Duplicar', icon: Copy, onSelect: () => onDuplicate(mealUid, food.uid) },
        { key: 'up', label: 'Mover para cima', icon: ArrowUp, hint: 'Alt ↑', disabled: index === 0, onSelect: () => onMove(mealUid, food.uid, -1, 'amount') },
        { key: 'down', label: 'Mover para baixo', icon: ArrowDown, hint: 'Alt ↓', disabled: index === count - 1, onSelect: () => onMove(mealUid, food.uid, 1, 'amount') },
        {
            key: 'favorite',
            label: favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos',
            icon: Star,
            onSelect: () => onToggleFavorite(food),
        },
        ...(otherMeals.length > 0
            ? ([
                { type: 'separator', key: 'sep-move' },
                { type: 'label', key: 'move-label', label: 'Mover para' },
                ...otherMeals.map<MenuEntry>((meal) => ({
                    key: `move-${meal.uid}`,
                    label: meal.name || 'Refeição sem nome',
                    icon: CornerDownRight,
                    onSelect: () => onMoveToMeal(mealUid, food.uid, meal.uid),
                })),
            ] as MenuEntry[])
            : []),
        { type: 'separator', key: 'sep-remove' },
        { key: 'remove', label: 'Remover alimento', icon: Trash2, danger: true, onSelect: () => onRemove(mealUid, food.uid) },
    ];

    return (
        <div
            role="group"
            aria-label={food.name}
            data-row={food.uid}
            onKeyDown={onKeyDown}
            className="group/row rounded-lg px-1.5 py-1 transition-colors focus-within:bg-primary/[0.04] hover:bg-muted/40"
        >
            <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1.5', FOOD_GRID)}>
                <div className="flex min-w-0 basis-full items-center gap-2 lg:basis-auto" title={`${food.name} — porção base: ${food.portion}`}>
                    <span className="truncate text-sm font-medium text-foreground">{food.name}</span>
                    {badge && (
                        <span title={badge.title} className={cn('shrink-0 rounded-md px-1.5 text-xs font-semibold', badge.className)}>
                            {badge.label}
                        </span>
                    )}
                </div>

                <input
                    data-focus-id={`${food.uid}:amount`}
                    data-field="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Quantidade de ${food.name}`}
                    aria-invalid={invalid || undefined}
                    value={food.amount}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => update({ amount: event.target.value })}
                    onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                        if (event.key === 'Enter' && !event.altKey && !event.metaKey && !event.ctrlKey) {
                            event.preventDefault();
                            onAmountEnter(mealUid);
                        }
                    }}
                    className={cn(inputClass, 'w-20 text-right tabular-nums lg:w-full', invalid && 'border-red-500 bg-red-500/5')}
                />

                {options.length > 1 ? (
                    <select
                        data-field="unit"
                        data-focus-id={`${food.uid}:unit`}
                        aria-label={`Unidade de ${food.name}`}
                        value={food.unit}
                        onChange={(event) => update({ unit: event.target.value as UnitKey })}
                        className={cn(inputClass, 'w-32 cursor-pointer pr-1 lg:w-full')}
                    >
                        {options.map((option) => (
                            <option key={option.key} value={option.key}>
                                {option.key === 'un' && massOption
                                    ? `${option.label} (${formatGrams(massOption.perPortion / option.perPortion)} ${massOption.label})`
                                    : option.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span className="w-32 truncate px-2 text-sm text-muted-foreground lg:w-full" title={options[0]?.label}>
                        {options[0]?.label}
                    </span>
                )}

                <span className="w-14 text-right text-sm font-semibold tabular-nums text-foreground lg:w-auto">{formatKcal(totals.calories)}</span>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground lg:w-auto">{formatGrams(totals.protein)}</span>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground lg:w-auto">{formatGrams(totals.carbs)}</span>
                <span className="w-12 text-right text-sm tabular-nums text-muted-foreground lg:w-auto">{formatGrams(totals.fat)}</span>

                <input
                    data-field="notes"
                    data-focus-id={`${food.uid}:notes`}
                    aria-label={`Observação de ${food.name}`}
                    value={food.notes}
                    placeholder="Observação (ex.: sem óleo)"
                    onChange={(event) => update({ notes: event.target.value })}
                    className={cn(inputClass, 'min-w-0 flex-1 basis-48 lg:basis-auto')}
                />

                <div className="ml-auto flex items-center justify-end gap-0.5 lg:ml-0">
                    <button
                        type="button"
                        data-field="substitution-toggle"
                        aria-expanded={showSubstitution}
                        aria-label={showSubstitution ? 'Ocultar substituições' : 'Adicionar substituições'}
                        title="Substituições (opções de troca para o aluno)"
                        onClick={() => {
                            if (showSubstitution && !food.substitutionNote) setSubstitutionOpen(false);
                            else setSubstitutionOpen(true);
                        }}
                        className={cn(
                            'rounded-md p-1.5 transition-colors hover:bg-muted',
                            food.substitutionNote ? 'text-primary' : 'text-muted-foreground'
                        )}
                    >
                        <ArrowLeftRight className="h-4 w-4" />
                    </button>
                    <DropdownMenu
                        label={`Ações de ${food.name}`}
                        items={menuItems}
                        buttonClassName="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenu>
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Remover ${food.name}`}
                        title="Remover alimento"
                        onClick={() => onRemove(mealUid, food.uid)}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-red-500/10 hover:text-red-500 focus:opacity-100 group-hover/row:opacity-100"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {showSubstitution && (
                <div className="mt-1 flex items-center gap-2 lg:pl-4">
                    <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <input
                        data-field="substitution"
                        data-focus-id={`${food.uid}:substitution`}
                        aria-label={`Substituições de ${food.name}`}
                        autoFocus={substitutionOpen && !food.substitutionNote}
                        value={food.substitutionNote}
                        placeholder="Substituições para o aluno (ex.: pode trocar por 150 g de batata-doce)"
                        onChange={(event) => update({ substitutionNote: event.target.value })}
                        onBlur={() => {
                            if (!food.substitutionNote.trim()) setSubstitutionOpen(false);
                        }}
                        className={cn(inputClass, 'flex-1')}
                    />
                </div>
            )}
        </div>
    );
}

export const FoodRow = React.memo(FoodRowComponent);
