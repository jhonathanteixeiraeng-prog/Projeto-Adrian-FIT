'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, FilePlus2, Pencil, UserPlus, Utensils } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui';
import { describePortion, formatAmount, formatKcal, quantityToAmount, resolveUnit } from './units';

export interface TemplateFood {
    name: string;
    portion?: string;
    quantity?: number;
    displayUnit?: string;
    notes?: string;
    substitutionNote?: string;
    totalCalories?: number;
}

export interface TemplateMealPreview {
    id: string;
    name: string;
    time: string;
    notes?: string | null;
    items?: TemplateFood[];
}

export interface TemplatePreview {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    meals: TemplateMealPreview[];
}

function quantityLabel(food: TemplateFood) {
    const option = resolveUnit(describePortion(food.portion), food.displayUnit);
    const amount = formatAmount(quantityToAmount(Number(food.quantity) || 1, option), option.key);
    return `${amount} ${option.label}`;
}

export function TemplatePreviewDialog({
    template,
    onClose,
    onAssign,
}: {
    template: TemplatePreview | null;
    onClose: () => void;
    onAssign: (template: TemplatePreview) => void;
}) {
    return (
        <Dialog open={template !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl border-border bg-card">
                {template && (
                    <>
                        <DialogHeader className="text-left">
                            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                                <Utensils className="h-5 w-5 text-primary" />
                                {template.title}
                            </DialogTitle>
                            <DialogDescription className="tabular-nums">
                                {formatKcal(template.calories ?? 0)} kcal · P {template.protein ?? 0} g · C {template.carbs ?? 0} g · G {template.fat ?? 0} g ·{' '}
                                {template.meals.length} {template.meals.length === 1 ? 'refeição' : 'refeições'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3">
                            {template.meals.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma refeição neste modelo.</p>}
                            {template.meals.map((meal, index) => (
                                <section key={meal.id || index} className="rounded-xl border border-border bg-muted/30 p-3">
                                    <header className="flex items-center justify-between gap-2">
                                        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                                                {index + 1}
                                            </span>
                                            {meal.name}
                                        </h4>
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3.5 w-3.5 text-primary" />
                                            {meal.time}
                                        </span>
                                    </header>
                                    {meal.notes && <p className="mt-1 text-xs text-muted-foreground">{meal.notes}</p>}
                                    <ul className="mt-2 divide-y divide-border/60">
                                        {(meal.items ?? []).map((food, foodIndex) => (
                                            <li key={foodIndex} className="flex items-start justify-between gap-4 py-1.5 text-sm">
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">{food.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {quantityLabel(food)}
                                                        {food.notes ? ` · ${food.notes}` : ''}
                                                    </p>
                                                    {food.substitutionNote && <p className="text-xs text-primary">↔ {food.substitutionNote}</p>}
                                                </div>
                                                <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                                                    {formatKcal(Number(food.totalCalories) || 0)} kcal
                                                </span>
                                            </li>
                                        ))}
                                        {(meal.items ?? []).length === 0 && <li className="py-1.5 text-xs text-muted-foreground">Sem alimentos.</li>}
                                    </ul>
                                </section>
                            ))}
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                            <Link
                                href={`/personal/diets/templates/${template.id}`}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                            >
                                <Pencil className="h-4 w-4" />
                                Editar modelo
                            </Link>
                            <Link
                                href={`/personal/diets/new?templateId=${template.id}`}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                            >
                                <FilePlus2 className="h-4 w-4" />
                                Usar modelo
                            </Link>
                            <button
                                type="button"
                                onClick={() => onAssign(template)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                            >
                                <UserPlus className="h-4 w-4" />
                                Atribuir a aluno
                            </button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

