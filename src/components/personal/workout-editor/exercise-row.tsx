'use client';

import React, { memo, useRef } from 'react';
import { ArrowDown, ArrowUp, CopyPlus, CornerDownRight, GripVertical, Replace, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActionMenu, type ActionMenuEntry } from './action-menu';
import { repsSetsMismatch, type EditorItem, type ItemField } from './editor-state';

export interface ExerciseRowProps {
    item: EditorItem;
    index: number;
    issues?: Partial<Record<ItemField, string>>;
    /** Brief highlight right after the row was added. */
    flash: boolean;
    dropIndicator: 'before' | 'after' | null;
    canMoveUp: boolean;
    canMoveDown: boolean;
    otherDays: { key: string; name: string }[];
    onChange: (itemKey: string, patch: Partial<EditorItem>) => void;
    onSwap: (itemKey: string) => void;
    onRemove: (itemKey: string) => void;
    onDuplicate: (itemKey: string) => void;
    onMoveBy: (itemKey: string, delta: -1 | 1) => void;
    onMoveToDay: (itemKey: string, dayKey: string) => void;
    onDragStart: (itemKey: string) => void;
    onDragEnd: () => void;
}

/** Desktop column template shared by the rows and the column header. */
export const ROW_GRID_MD =
    'md:grid-cols-[16px_22px_minmax(160px,2fr)_52px_minmax(72px,0.7fr)_minmax(60px,0.5fr)_minmax(100px,1.1fr)_32px]';

const inputBase =
    'h-8 w-full min-w-0 rounded-md border bg-muted/40 px-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-border focus:border-[#F88022] focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#F88022]/20';

function fieldClass(error?: string, warning?: string | null) {
    return cn(
        inputBase,
        error ? 'border-red-500 bg-red-500/5' : warning ? 'border-amber-400' : 'border-transparent'
    );
}

function ExerciseRowComponent({
    item,
    index,
    issues,
    flash,
    dropIndicator,
    canMoveUp,
    canMoveDown,
    otherDays,
    onChange,
    onSwap,
    onRemove,
    onDuplicate,
    onMoveBy,
    onMoveToDay,
    onDragStart,
    onDragEnd,
}: ExerciseRowProps) {
    const rowRef = useRef<HTMLDivElement>(null);
    const mismatch = repsSetsMismatch(item);
    const hasIssues = Boolean(issues && Object.keys(issues).length);

    const armDrag = (armed: boolean) => {
        if (armed) rowRef.current?.setAttribute('draggable', 'true');
        else rowRef.current?.removeAttribute('draggable');
    };

    const menu: ActionMenuEntry[] = [
        { label: 'Trocar exercício', icon: Replace, onSelect: () => onSwap(item.key) },
        { label: 'Duplicar linha', icon: CopyPlus, onSelect: () => onDuplicate(item.key) },
        { label: 'Mover para cima', icon: ArrowUp, hint: 'Alt ↑', disabled: !canMoveUp, onSelect: () => onMoveBy(item.key, -1) },
        { label: 'Mover para baixo', icon: ArrowDown, hint: 'Alt ↓', disabled: !canMoveDown, onSelect: () => onMoveBy(item.key, 1) },
        ...(otherDays.length
            ? ([
                  { type: 'label', label: 'Mover para o dia' },
                  ...otherDays.map((day) => ({
                      label: day.name || 'Sem nome',
                      icon: CornerDownRight,
                      onSelect: () => onMoveToDay(item.key, day.key),
                  })),
              ] as ActionMenuEntry[])
            : []),
        { type: 'separator' },
        { label: 'Remover exercício', icon: Trash2, danger: true, onSelect: () => onRemove(item.key) },
    ];

    return (
        <div
            ref={rowRef}
            data-row-key={item.key}
            data-row-index={index}
            onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.exerciseName);
                onDragStart(item.key);
            }}
            onDragEnd={() => {
                armDrag(false);
                onDragEnd();
            }}
            className={cn(
                'group relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-x-2 gap-y-1.5 rounded-lg px-1.5 py-1.5 transition-colors md:gap-y-0 md:py-0.5',
                ROW_GRID_MD,
                flash ? 'bg-[#F88022]/10' : 'hover:bg-muted/40',
                hasIssues && 'bg-red-500/5'
            )}
        >
            {dropIndicator && (
                <span
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-[#F88022]',
                        dropIndicator === 'before' ? '-top-px' : '-bottom-px'
                    )}
                />
            )}

            <span
                onMouseDown={() => armDrag(true)}
                onMouseUp={() => armDrag(false)}
                title="Arraste para reordenar ou mover para outro dia"
                className="hidden h-8 cursor-grab items-center justify-center text-muted-foreground/50 hover:text-foreground active:cursor-grabbing md:flex"
            >
                <GripVertical className="h-4 w-4" />
            </span>

            <span
                className={cn(
                    'hidden text-center text-xs font-semibold tabular-nums md:block',
                    hasIssues ? 'text-red-500' : 'text-muted-foreground'
                )}
            >
                {index + 1}
            </span>

            <button
                type="button"
                tabIndex={-1}
                data-item-key={item.key}
                data-field="exercise"
                onClick={() => onSwap(item.key)}
                title="Clique para trocar o exercício"
                className="col-span-3 flex min-w-0 items-baseline gap-2 rounded-md px-1 py-1 text-left hover:bg-muted md:col-span-1"
            >
                <span className="text-xs font-semibold tabular-nums text-muted-foreground md:hidden">{index + 1}.</span>
                <span className={cn('truncate text-sm font-medium', issues?.exercise ? 'text-red-500' : 'text-foreground')}>
                    {item.exerciseName || 'Selecione o exercício'}
                </span>
                {item.muscleGroup && <span className="hidden shrink-0 truncate text-xs text-muted-foreground xl:inline">{item.muscleGroup}</span>}
            </button>

            <div className="col-start-4 row-start-1 flex justify-end md:order-last md:col-start-auto md:row-start-auto">
                <ActionMenu entries={menu} label={`Ações de ${item.exerciseName}`} tabIndex={-1} />
            </div>

            <label className="flex min-w-0 flex-col gap-0.5 md:block">
                <span className="text-xs text-muted-foreground md:sr-only">Séries</span>
                <input
                    data-item-key={item.key}
                    data-field="sets"
                    inputMode="numeric"
                    aria-label="Séries"
                    aria-invalid={Boolean(issues?.sets) || undefined}
                    title={issues?.sets}
                    value={item.sets}
                    placeholder="3"
                    min={1}
                    max={12}
                    onChange={(event) => onChange(item.key, { sets: event.target.value.replace(/[^\d]/g, '').slice(0, 2) })}
                    className={cn(fieldClass(issues?.sets), 'text-center tabular-nums')}
                />
            </label>

            <label className="flex min-w-0 flex-col gap-0.5 md:block">
                <span className="text-xs text-muted-foreground md:sr-only">Repetições</span>
                <input
                    data-item-key={item.key}
                    data-field="reps"
                    aria-label="Repetições"
                    aria-invalid={Boolean(issues?.reps) || undefined}
                    title={issues?.reps ?? mismatch ?? 'Ex.: 12 · 10-12 · 12/10/8 · até a falha'}
                    value={item.reps}
                    placeholder="10-12"
                    maxLength={60}
                    onChange={(event) => onChange(item.key, { reps: event.target.value })}
                    className={fieldClass(issues?.reps, mismatch)}
                />
            </label>

            <label className="flex min-w-0 flex-col gap-0.5 md:block">
                <span className="text-xs text-muted-foreground md:sr-only">Descanso (s)</span>
                <input
                    data-item-key={item.key}
                    data-field="rest"
                    inputMode="numeric"
                    aria-label="Descanso em segundos"
                    aria-invalid={Boolean(issues?.rest) || undefined}
                    title={issues?.rest ?? 'Segundos. Por série: 60/90/120'}
                    value={item.rest}
                    placeholder="60"
                    min={0}
                    max={600}
                    maxLength={40}
                    onChange={(event) => onChange(item.key, { rest: event.target.value })}
                    className={cn(fieldClass(issues?.rest), 'tabular-nums')}
                />
            </label>

            <label className="col-span-3 flex min-w-0 flex-col gap-0.5 md:col-span-1 md:block">
                <span className="text-xs text-muted-foreground md:sr-only">Observações</span>
                <input
                    data-item-key={item.key}
                    data-field="notes"
                    aria-label="Observações"
                    aria-invalid={Boolean(issues?.notes) || undefined}
                    title={issues?.notes ?? 'Enter volta para a busca de exercícios'}
                    value={item.notes}
                    placeholder="Cadência, técnica, carga…"
                    maxLength={1000}
                    onChange={(event) => onChange(item.key, { notes: event.target.value })}
                    className={fieldClass(issues?.notes)}
                />
            </label>
        </div>
    );
}

export const ExerciseRow = memo(ExerciseRowComponent);
