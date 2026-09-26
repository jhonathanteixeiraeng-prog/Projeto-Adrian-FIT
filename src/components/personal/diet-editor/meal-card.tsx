'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, MessageSquareText, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FoodRow, FOOD_GRID, type MealRef } from './food-row';
import { FoodSearch } from './food-search';
import { foodKey, mealTotals, type EditorAction, type EditorFood, type EditorMeal, type FoodSnapshot } from './model';
import { formatGrams, formatKcal } from './units';

interface MealCardProps {
    meal: EditorMeal;
    index: number;
    count: number;
    meals: MealRef[];
    invalidFoods: Set<string>;
    favoriteKeys: Set<string>;
    recents: FoodSnapshot[];
    favorites: FoodSnapshot[];
    dispatch: React.Dispatch<EditorAction>;
    onActivate: (mealUid: string) => void;
    onMoveMeal: (mealUid: string, delta: number, field: string) => void;
    onDuplicateMeal: (mealUid: string) => void;
    onRemoveMeal: (mealUid: string) => void;
    onPickFood: (mealUid: string, food: FoodSnapshot) => void;
    onCreateCustomFood: (mealUid: string, name: string) => void;
    onToggleFavorite: (food: FoodSnapshot) => void;
    onToggleFoodFavorite: (food: EditorFood) => void;
    onMoveFood: (mealUid: string, foodUid: string, delta: number, field: string) => void;
    onMoveFoodToMeal: (fromMealUid: string, foodUid: string, toMealUid: string) => void;
    onDuplicateFood: (mealUid: string, foodUid: string) => void;
    onRemoveFood: (mealUid: string, foodUid: string) => void;
    onAmountEnter: (mealUid: string) => void;
}

const headerInputClass =
    'h-8 rounded-md border border-transparent bg-transparent px-2 text-foreground hover:border-border focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/25';

const iconButtonClass =
    'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

function MealCardComponent({
    meal,
    index,
    count,
    meals,
    invalidFoods,
    favoriteKeys,
    recents,
    favorites,
    dispatch,
    onActivate,
    onMoveMeal,
    onDuplicateMeal,
    onRemoveMeal,
    onPickFood,
    onCreateCustomFood,
    onToggleFavorite,
    onToggleFoodFavorite,
    onMoveFood,
    onMoveFoodToMeal,
    onDuplicateFood,
    onRemoveFood,
    onAmountEnter,
}: MealCardProps) {
    const [notesOpen, setNotesOpen] = useState(false);
    const totals = mealTotals(meal);
    const showNotes = notesOpen || Boolean(meal.notes);
    const hasInvalid = meal.foods.some((food) => invalidFoods.has(food.uid));

    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (!event.altKey || event.metaKey || event.ctrlKey) return;
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const field = (event.target as HTMLElement).dataset?.field || 'name';
        onMoveMeal(meal.uid, event.key === 'ArrowUp' ? -1 : 1, field);
    };

    return (
        <section
            aria-label={meal.name || `Refeição ${index + 1}`}
            data-meal={meal.uid}
            onFocusCapture={() => onActivate(meal.uid)}
            onKeyDown={onKeyDown}
            className={cn(
                'rounded-2xl border bg-card shadow-sm transition-colors',
                hasInvalid ? 'border-red-500/60' : 'border-border focus-within:border-primary/40'
            )}
        >
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/70 px-2 py-1.5">
                <button
                    type="button"
                    data-field="collapse"
                    aria-expanded={!meal.collapsed}
                    aria-label={meal.collapsed ? 'Expandir refeição' : 'Recolher refeição'}
                    onClick={() => dispatch({ type: 'updateMeal', mealUid: meal.uid, patch: { collapsed: !meal.collapsed } })}
                    className={iconButtonClass}
                >
                    {meal.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-md bg-primary/10 px-1 text-xs font-bold text-primary">
                    {index + 1}
                </span>
                <input
                    data-field="name"
                    data-focus-id={`${meal.uid}:name`}
                    aria-label="Nome da refeição"
                    value={meal.name}
                    placeholder="Nome da refeição"
                    onChange={(event) => dispatch({ type: 'updateMeal', mealUid: meal.uid, patch: { name: event.target.value } })}
                    className={cn(headerInputClass, 'min-w-[10rem] flex-1 text-base font-semibold sm:max-w-xs')}
                />
                <input
                    type="time"
                    data-field="time"
                    data-focus-id={`${meal.uid}:time`}
                    aria-label="Horário da refeição"
                    value={meal.time}
                    onChange={(event) => dispatch({ type: 'updateMeal', mealUid: meal.uid, patch: { time: event.target.value } })}
                    className={cn(headerInputClass, 'w-[6.5rem] text-sm tabular-nums')}
                />
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground tabular-nums">
                    <span className="text-sm font-semibold text-foreground">{formatKcal(totals.calories)} kcal</span>
                    <span>P {formatGrams(totals.protein)} g</span>
                    <span>C {formatGrams(totals.carbs)} g</span>
                    <span>G {formatGrams(totals.fat)} g</span>
                    {meal.collapsed && <span>· {meal.foods.length} {meal.foods.length === 1 ? 'alimento' : 'alimentos'}</span>}
                </p>
                <div className="ml-auto flex items-center gap-0.5">
                    <button
                        type="button"
                        data-field="notes-toggle"
                        aria-label="Observação da refeição"
                        title="Observação da refeição"
                        aria-expanded={showNotes}
                        onClick={() => setNotesOpen((open) => !open || Boolean(meal.notes))}
                        className={cn(iconButtonClass, meal.notes && 'text-primary')}
                    >
                        <MessageSquareText className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        data-field="move-up"
                        aria-label="Mover refeição para cima (Alt ↑)"
                        title="Mover para cima (Alt ↑)"
                        disabled={index === 0}
                        onClick={() => onMoveMeal(meal.uid, -1, 'move-up')}
                        className={iconButtonClass}
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        data-field="move-down"
                        aria-label="Mover refeição para baixo (Alt ↓)"
                        title="Mover para baixo (Alt ↓)"
                        disabled={index === count - 1}
                        onClick={() => onMoveMeal(meal.uid, 1, 'move-down')}
                        className={iconButtonClass}
                    >
                        <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Duplicar refeição"
                        title="Duplicar refeição"
                        onClick={() => onDuplicateMeal(meal.uid)}
                        className={iconButtonClass}
                    >
                        <Copy className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="Remover refeição"
                        title="Remover refeição"
                        onClick={() => onRemoveMeal(meal.uid)}
                        className={cn(iconButtonClass, 'hover:bg-red-500/10 hover:text-red-500')}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {!meal.collapsed && (
                <div className="space-y-1 px-2 pb-2.5 pt-1.5">
                    {showNotes && (
                        <input
                            data-field="notes"
                            data-focus-id={`${meal.uid}:notes`}
                            aria-label="Observação da refeição"
                            autoFocus={notesOpen && !meal.notes}
                            value={meal.notes}
                            placeholder="Observação da refeição (ex.: 30 min antes do treino)"
                            onChange={(event) => dispatch({ type: 'updateMeal', mealUid: meal.uid, patch: { notes: event.target.value } })}
                            onBlur={() => {
                                if (!meal.notes.trim()) setNotesOpen(false);
                            }}
                            className="mb-1 h-8 w-full rounded-md border border-border bg-muted/40 px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/25"
                        />
                    )}

                    {meal.foods.length > 0 && (
                        <div
                            aria-hidden
                            className={cn(
                                'hidden px-1.5 pb-0.5 text-xs font-medium text-muted-foreground lg:grid',
                                FOOD_GRID
                            )}
                        >
                            <span>Alimento</span>
                            <span className="text-right">Qtd.</span>
                            <span>Unidade</span>
                            <span className="text-right">kcal</span>
                            <span className="text-right">P</span>
                            <span className="text-right">C</span>
                            <span className="text-right">G</span>
                            <span>Observação</span>
                            <span />
                        </div>
                    )}

                    {meal.foods.map((food, foodIndex) => (
                        <FoodRow
                            key={food.uid}
                            food={food}
                            mealUid={meal.uid}
                            index={foodIndex}
                            count={meal.foods.length}
                            meals={meals}
                            invalid={invalidFoods.has(food.uid)}
                            favorite={favoriteKeys.has(foodKey(food))}
                            dispatch={dispatch}
                            onMove={onMoveFood}
                            onMoveToMeal={onMoveFoodToMeal}
                            onDuplicate={onDuplicateFood}
                            onRemove={onRemoveFood}
                            onAmountEnter={onAmountEnter}
                            onToggleFavorite={onToggleFoodFavorite}
                        />
                    ))}

                    <div className="pt-1">
                        <FoodSearch
                            mealUid={meal.uid}
                            mealName={meal.name}
                            recents={recents}
                            favorites={favorites}
                            favoriteKeys={favoriteKeys}
                            onToggleFavorite={onToggleFavorite}
                            onPick={onPickFood}
                            onCreateCustom={onCreateCustomFood}
                        />
                        {meal.foods.length === 0 && (
                            <p className="px-1 pt-1.5 text-xs text-muted-foreground">
                                Digite o nome do alimento e pressione Enter. Depois ajuste a quantidade e Enter volta para a busca.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

export const MealCard = React.memo(MealCardComponent);
