'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Clock, Dumbbell, Utensils } from 'lucide-react';
import { normalizeDietFood, type NormalizedDietFood } from '@/lib/diet-normalizer';
import { cn, getDayOfWeekName } from '@/lib/utils';
import { parsePerSetReps } from '@/lib/workout-reps';
import { formatDate, formatNumber, planEndInfo, toneText } from './lib';
import type { DietPlanFull, WorkoutItem, WorkoutPlanFull } from './types';

function formatRest(seconds: number | null | undefined): string {
    if (!seconds) return '—';
    if (seconds < 60) return `${seconds} s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

function formatVolume(item: WorkoutItem): string {
    const perSet = parsePerSetReps(item.reps);
    if (perSet.length > 1) return `${item.sets} × (${perSet.join(' / ')})`;
    return `${item.sets} × ${item.reps || '—'}`;
}

function PlanHeader({
    title,
    startDate,
    endDate,
    activeCount,
    kind,
}: {
    title: string;
    startDate?: string | null;
    endDate?: string | null;
    activeCount: number;
    kind: 'treino' | 'dieta';
}) {
    const end = planEndInfo(endDate);
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground">
                    {formatDate(startDate)} – {formatDate(endDate)}
                    {end && <span className={cn('ml-2 font-semibold', toneText[end.tone])}>{end.label}</span>}
                </p>
            </div>
            {activeCount > 1 && (
                <p className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Este aluno tem {activeCount} {kind === 'treino' ? 'treinos ativos' : 'dietas ativas'}; exibindo {kind === 'treino' ? 'o mais recente' : 'a mais recente'}.
                </p>
            )}
        </div>
    );
}

export function WorkoutPlanView({ plan, activeCount }: { plan: WorkoutPlanFull; activeCount: number }) {
    const days = useMemo(
        () => [...plan.workoutDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek || (a.order ?? 0) - (b.order ?? 0)),
        [plan.workoutDays]
    );
    const totalExercises = days.reduce((sum, day) => sum + day.items.length, 0);

    return (
        <div className="space-y-4">
            <PlanHeader title={plan.title} startDate={plan.startDate} endDate={plan.endDate} activeCount={activeCount} kind="treino" />
            <p className="text-sm text-muted-foreground">
                {days.length} {days.length === 1 ? 'dia' : 'dias'} de treino · {totalExercises} exercícios
            </p>
            {days.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Este treino ainda não tem dias cadastrados.
                </p>
            )}
            <div className="grid gap-3 2xl:grid-cols-2">
                {days.map((day) => {
                    const sets = day.items.reduce((sum, item) => sum + (item.sets || 0), 0);
                    return (
                        <section key={day.id} className="overflow-hidden rounded-xl border border-border">
                            <header className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
                                <h4 className="min-w-0 truncate text-sm font-bold text-foreground">
                                    <span className="mr-2 text-xs font-bold uppercase tracking-wider text-[#F88022]">
                                        {getDayOfWeekName(day.dayOfWeek)}
                                    </span>
                                    {day.name}
                                </h4>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {day.items.length} exercícios · {sets} séries
                                </span>
                            </header>
                            {day.items.length === 0 ? (
                                <p className="px-3 py-3 text-sm text-muted-foreground">Sem exercícios neste dia.</p>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-left text-xs text-muted-foreground">
                                        <tr className="border-b border-border/70">
                                            <th scope="col" className="w-8 px-3 py-1.5 font-semibold">#</th>
                                            <th scope="col" className="px-2 py-1.5 font-semibold">Exercício</th>
                                            <th scope="col" className="px-2 py-1.5 font-semibold">Séries × reps</th>
                                            <th scope="col" className="px-2 py-1.5 font-semibold">Descanso</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {[...day.items]
                                            .sort((a, b) => a.order - b.order)
                                            .map((item, index) => (
                                                <tr key={item.id} className="align-top">
                                                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{index + 1}</td>
                                                    <td className="px-2 py-1.5">
                                                        <p className="font-medium text-foreground">{item.exercise?.name ?? 'Exercício removido'}</p>
                                                        {(item.exercise?.muscleGroup || item.notes) && (
                                                            <p className="text-xs text-muted-foreground">
                                                                {item.exercise?.muscleGroup}
                                                                {item.exercise?.muscleGroup && item.notes && ' · '}
                                                                {item.notes && <span className="italic">{item.notes}</span>}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="whitespace-nowrap px-2 py-1.5 font-semibold text-foreground">{formatVolume(item)}</td>
                                                    <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{formatRest(item.rest)}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}

function parseFoods(raw: string): NormalizedDietFood[] {
    try {
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed.map(normalizeDietFood) : [];
    } catch {
        return [];
    }
}

/** "150 g" for mass portions, otherwise "2 × 1 unidade (50g)". */
function describeAmount(food: NormalizedDietFood): string {
    const portion = (food.portion || '').trim();
    const mass = portion.replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(g|ml)$/i);
    if (mass) return `${formatNumber(Number(mass[1]) * food.quantity)} ${mass[2].toLowerCase()}`;
    if (Math.abs(food.quantity - 1) < 0.001) return portion;
    return `${formatNumber(food.quantity)} × ${portion}`;
}

export function DietPlanView({ plan, activeCount }: { plan: DietPlanFull; activeCount: number }) {
    const meals = useMemo(
        () =>
            [...plan.meals]
                .sort((a, b) => a.order - b.order)
                .map((meal) => {
                    const foods = parseFoods(meal.foods);
                    return {
                        ...meal,
                        parsedFoods: foods,
                        calories: foods.reduce((sum, food) => sum + food.totalCalories, 0),
                        protein: foods.reduce((sum, food) => sum + food.totalProtein, 0),
                        carbs: foods.reduce((sum, food) => sum + food.totalCarbs, 0),
                        fat: foods.reduce((sum, food) => sum + food.totalFat, 0),
                    };
                }),
        [plan.meals]
    );

    const totals = {
        calories: plan.calories ?? Math.round(meals.reduce((sum, meal) => sum + meal.calories, 0)),
        protein: plan.protein ?? Math.round(meals.reduce((sum, meal) => sum + meal.protein, 0)),
        carbs: plan.carbs ?? Math.round(meals.reduce((sum, meal) => sum + meal.carbs, 0)),
        fat: plan.fat ?? Math.round(meals.reduce((sum, meal) => sum + meal.fat, 0)),
    };

    return (
        <div className="space-y-4">
            <PlanHeader title={plan.title} startDate={plan.startDate} endDate={plan.endDate} activeCount={activeCount} kind="dieta" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    { label: 'Calorias', value: `${formatNumber(totals.calories)} kcal`, className: 'text-[#F88022]' },
                    { label: 'Proteínas', value: `${formatNumber(totals.protein)} g`, className: 'text-red-500' },
                    { label: 'Carboidratos', value: `${formatNumber(totals.carbs)} g`, className: 'text-amber-500' },
                    { label: 'Gorduras', value: `${formatNumber(totals.fat)} g`, className: 'text-blue-500' },
                ].map((macro) => (
                    <div key={macro.label} className="rounded-xl border border-border bg-muted/40 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{macro.label}</p>
                        <p className={cn('text-lg font-bold', macro.className)}>{macro.value}</p>
                    </div>
                ))}
            </div>
            {meals.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Este plano ainda não tem refeições.
                </p>
            )}
            <div className="grid gap-3 xl:grid-cols-2">
                {meals.map((meal) => (
                    <section key={meal.id} className="overflow-hidden rounded-xl border border-border">
                        <header className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
                            <h4 className="min-w-0 truncate text-sm font-bold text-foreground">
                                <span className="mr-2 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {meal.time || '--:--'}
                                </span>
                                {meal.name}
                            </h4>
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{Math.round(meal.calories)} kcal</span>
                        </header>
                        {meal.parsedFoods.length === 0 ? (
                            <p className="px-3 py-3 text-sm text-muted-foreground">Sem alimentos nesta refeição.</p>
                        ) : (
                            <ul className="divide-y divide-border/50">
                                {meal.parsedFoods.map((food, index) => (
                                    <li key={`${meal.id}-${index}`} className="flex items-start justify-between gap-3 px-3 py-1.5 text-sm">
                                        <span className="min-w-0">
                                            <span className="font-medium text-foreground">{food.name}</span>
                                            <span className="ml-1.5 text-muted-foreground">{describeAmount(food)}</span>
                                            {food.notes && <span className="block text-xs italic text-muted-foreground">{food.notes}</span>}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">{Math.round(food.totalCalories)} kcal</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {meal.notes && <p className="border-t border-border/60 px-3 py-1.5 text-xs text-muted-foreground">{meal.notes}</p>}
                    </section>
                ))}
            </div>
        </div>
    );
}

export function EmptyPlan({ kind, action }: { kind: 'treino' | 'dieta'; action: React.ReactNode }) {
    const Icon = kind === 'treino' ? Dumbbell : Utensils;
    return (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Icon className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 font-semibold text-foreground">{kind === 'treino' ? 'Nenhum treino ativo' : 'Nenhuma dieta ativa'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
                {kind === 'treino'
                    ? 'Prescreva do zero, use um modelo da biblioteca ou clone o treino de outro aluno.'
                    : 'Crie o plano alimentar do zero ou atribua um modelo da biblioteca.'}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>
        </div>
    );
}
