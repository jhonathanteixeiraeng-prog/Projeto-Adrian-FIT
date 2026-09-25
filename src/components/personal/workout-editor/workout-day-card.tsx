'use client';

import React, { memo, useMemo } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, CopyPlus, Import, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionMenu, type ActionMenuEntry } from './action-menu';
import { ExerciseRow } from './exercise-row';
import { WEEKDAY_OPTIONS, dayLetter, type EditorDay, type EditorItem, type ItemField } from './editor-state';

export interface DayCardHandlers {
    onActivate: (dayKey: string) => void;
    onUpdateDay: (dayKey: string, patch: Partial<Pick<EditorDay, 'name' | 'dayOfWeek'>>) => void;
    onDuplicateDay: (dayKey: string) => void;
    onRemoveDay: (dayKey: string) => void;
    onMoveDay: (dayKey: string, delta: -1 | 1) => void;
    onImportIntoDay: (dayKey: string) => void;
    onAddExercise: (dayKey: string) => void;
    onItemChange: (itemKey: string, patch: Partial<EditorItem>) => void;
    onSwap: (itemKey: string) => void;
    onRemoveItem: (itemKey: string) => void;
    onDuplicateItem: (itemKey: string) => void;
    onMoveItemBy: (itemKey: string, delta: -1 | 1) => void;
    onMoveItemToDay: (itemKey: string, dayKey: string) => void;
    onItemDragStart: (itemKey: string) => void;
    onDragEnd: () => void;
    onDragOverDay: (dayKey: string, index: number) => void;
    onDropOnDay: (dayKey: string) => void;
}

interface DayCardProps extends DayCardHandlers {
    day: EditorDay;
    index: number;
    totalDays: number;
    isActive: boolean;
    isFirstDay: boolean;
    isLastDay: boolean;
    nameError?: string;
    itemIssues: Record<string, Partial<Record<ItemField, string>>>;
    flashKey: string | null;
    /** Insertion index while something is dragged over this day. */
    dropIndex: number | null;
    dragActive: boolean;
    allDays: { key: string; name: string }[];
    collapsed: boolean;
    onToggleCollapse: (dayKey: string) => void;
}

function DayCardComponent(props: DayCardProps) {
    const {
        day,
        index,
        totalDays,
        isActive,
        isFirstDay,
        isLastDay,
        nameError,
        itemIssues,
        flashKey,
        dropIndex,
        dragActive,
        allDays,
        collapsed,
    } = props;
    const totalSets = day.items.reduce((sum, item) => sum + (Number.parseInt(item.sets, 10) || 0), 0);
    // Stable reference so memoized rows don't re-render on every keystroke.
    const otherDays = useMemo(() => allDays.filter((other) => other.key !== day.key), [allDays, day.key]);

    const menu: ActionMenuEntry[] = [
        { label: 'Adicionar exercício', icon: Plus, onSelect: () => props.onAddExercise(day.key) },
        { label: 'Importar de outra ficha ou modelo…', icon: Import, onSelect: () => props.onImportIntoDay(day.key) },
        { label: 'Duplicar dia', icon: CopyPlus, onSelect: () => props.onDuplicateDay(day.key) },
        { label: 'Mover dia para cima', icon: ArrowUp, disabled: index === 0, onSelect: () => props.onMoveDay(day.key, -1) },
        { label: 'Mover dia para baixo', icon: ArrowDown, disabled: index === totalDays - 1, onSelect: () => props.onMoveDay(day.key, 1) },
        { type: 'separator' },
        { label: 'Remover dia', icon: Trash2, danger: true, onSelect: () => props.onRemoveDay(day.key) },
    ];

    const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
        if (!dragActive) return;
        event.preventDefault();
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-row-index]');
        let target = day.items.length;
        if (row) {
            const rowIndex = Number(row.dataset.rowIndex);
            const rect = row.getBoundingClientRect();
            target = event.clientY < rect.top + rect.height / 2 ? rowIndex : rowIndex + 1;
        }
        props.onDragOverDay(day.key, target);
    };

    return (
        <section
            aria-label={day.name || `Dia ${index + 1}`}
            data-day-key={day.key}
            onMouseDownCapture={() => props.onActivate(day.key)}
            onFocusCapture={() => props.onActivate(day.key)}
            onDragOver={handleDragOver}
            onDrop={(event) => {
                if (!dragActive) return;
                event.preventDefault();
                props.onDropOnDay(day.key);
            }}
            className={cn(
                'rounded-2xl border bg-card transition-shadow',
                isActive ? 'border-[#F88022]/60 shadow-[0_0_0_3px_rgba(248,128,34,0.12)]' : 'border-border',
                dropIndex !== null && 'border-[#F88022]'
            )}
        >
            <header className="flex flex-wrap items-center gap-2 px-3 py-1.5 sm:flex-nowrap">
                <span
                    className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                        isActive ? 'bg-[#F88022] text-white' : 'bg-muted text-muted-foreground'
                    )}
                    aria-hidden
                >
                    {dayLetter(index)}
                </span>
                <input
                    data-day-name={day.key}
                    aria-label="Nome do treino"
                    aria-invalid={Boolean(nameError) || undefined}
                    title={nameError}
                    value={day.name}
                    maxLength={80}
                    placeholder="Nome do treino"
                    onChange={(event) => props.onUpdateDay(day.key, { name: event.target.value })}
                    className={cn(
                        'h-8 min-w-[160px] flex-1 rounded-md border bg-transparent px-2 text-sm font-semibold sm:min-w-0 text-foreground placeholder:font-normal hover:border-border focus:border-[#F88022] focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#F88022]/20',
                        nameError ? 'border-red-500' : 'border-transparent'
                    )}
                />
                <select
                    aria-label="Dia da semana"
                    value={day.dayOfWeek}
                    onChange={(event) => props.onUpdateDay(day.key, { dayOfWeek: Number(event.target.value) })}
                    className="h-8 shrink-0 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/20"
                >
                    {WEEKDAY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {day.items.length} {day.items.length === 1 ? 'exercício' : 'exercícios'} · {totalSets} séries
                </span>
                {isActive && (
                    <span className="hidden shrink-0 rounded-full bg-[#F88022]/10 px-2 py-0.5 text-xs font-semibold text-[#F88022] lg:inline">
                        Adicionando aqui
                    </span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-0.5">
                    <ActionMenu entries={menu} label={`Ações do ${day.name || 'dia'}`} tabIndex={-1} />
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => props.onToggleCollapse(day.key)}
                        aria-label={collapsed ? 'Expandir dia' : 'Recolher dia'}
                        aria-expanded={!collapsed}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
                    </button>
                </div>
            </header>

            {!collapsed && (
                <div className="border-t border-border/70 px-1.5 pb-1.5 pt-1">
                    <div className="space-y-0.5">
                        {day.items.map((item, itemIndex) => (
                            <ExerciseRow
                                key={item.key}
                                item={item}
                                index={itemIndex}
                                issues={itemIssues[item.key]}
                                flash={flashKey === item.key}
                                dropIndicator={
                                    dropIndex === itemIndex ? 'before' : dropIndex === itemIndex + 1 && itemIndex === day.items.length - 1 ? 'after' : null
                                }
                                canMoveUp={itemIndex > 0 || !isFirstDay}
                                canMoveDown={itemIndex < day.items.length - 1 || !isLastDay}
                                otherDays={otherDays}
                                onChange={props.onItemChange}
                                onSwap={props.onSwap}
                                onRemove={props.onRemoveItem}
                                onDuplicate={props.onDuplicateItem}
                                onMoveBy={props.onMoveItemBy}
                                onMoveToDay={props.onMoveItemToDay}
                                onDragStart={props.onItemDragStart}
                                onDragEnd={props.onDragEnd}
                            />
                        ))}
                    </div>

                    {day.items.length === 0 ? (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => props.onAddExercise(day.key)}
                            className={cn(
                                'mt-1 flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm transition-colors',
                                dropIndex !== null ? 'border-[#F88022] bg-[#F88022]/5 text-[#F88022]' : 'border-border text-muted-foreground hover:border-[#F88022]/50 hover:text-foreground'
                            )}
                        >
                            <span className="font-semibold">Nenhum exercício neste dia</span>
                            <span className="text-xs">
                                <span className="hidden lg:inline">Busque na biblioteca ( / ) e tecle Enter, ou arraste exercícios para cá.</span>
                                <span className="lg:hidden">Toque para adicionar exercícios.</span>
                            </span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => props.onAddExercise(day.key)}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-[#F88022] lg:hidden"
                        >
                            <Plus className="h-3.5 w-3.5" /> Adicionar exercício
                        </button>
                    )}
                </div>
            )}
            {collapsed && day.items.length > 0 && (
                <p className="truncate border-t border-border/70 px-4 py-2 text-xs text-muted-foreground">
                    {day.items.map((item) => item.exerciseName).join(' · ')}
                </p>
            )}
        </section>
    );
}

export const WorkoutDayCard = memo(DayCardComponent);
