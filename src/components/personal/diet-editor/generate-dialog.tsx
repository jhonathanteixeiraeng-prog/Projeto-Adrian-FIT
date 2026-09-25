'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui';
import { cn } from '@/lib/utils';
import { generateDietPlan } from '@/lib/diet-generator';
import { tacoFoods } from '@/lib/taco-foods';
import {
    ACTIVITY_LABELS,
    GOAL_OPTIONS,
    foodFromRaw,
    newUid,
    normalizeGoal,
    parseTarget,
    suggestTargets,
    type EditorMeal,
    type EditorTargets,
    type EnergyEstimate,
    type GoalKey,
    type StudentProfile,
} from './model';
import { formatInteger, parseAmount } from './units';

export type DraftSource = 'ai' | 'rules';

export interface DraftResult {
    source: DraftSource;
    meals: EditorMeal[];
    title?: string;
    targets?: EditorTargets;
    warnings: string[];
    append: boolean;
}

interface GenerateDraftDialogProps {
    mode: DraftSource | null;
    onClose: () => void;
    student: StudentProfile | null;
    energy: EnergyEstimate | null;
    targets: EditorTargets;
    hasFoods: boolean;
    mealCount: number;
    onDraft: (draft: DraftResult) => void;
}

// Refeições do gerador automático usadas para cada quantidade (sempre com café, almoço e jantar).
const MEAL_SUBSETS: Record<number, number[]> = {
    3: [0, 2, 4],
    4: [0, 2, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
};

const fieldClass =
    'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';
const textareaClass =
    'w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#F88022] focus:outline-none focus:ring-2 focus:ring-[#F88022]/25';

function describeStudent(student: StudentProfile | null, energy: EnergyEstimate | null, targets: EditorTargets) {
    const lines: string[] = [];
    if (student) {
        if (student.goal?.trim()) lines.push(`Objetivo: ${student.goal.trim()}.`);
        const profile = [
            student.gender === 'FEMALE' ? 'Mulher' : student.gender === 'MALE' ? 'Homem' : '',
            energy ? `${energy.age} anos` : '',
            student.weight ? `${student.weight} kg` : '',
            student.height ? `${student.height} cm` : '',
            student.activityLevel ? ACTIVITY_LABELS[student.activityLevel] ?? '' : '',
        ].filter(Boolean);
        if (profile.length) lines.push(`${profile.join(', ')}.`);
        if (student.restrictions?.trim()) lines.push(`Restrições: ${student.restrictions.trim()}.`);
    }
    const kcal = parseTarget(targets.calories);
    if (kcal) {
        const macros = [
            parseTarget(targets.protein) ? `proteína ${parseTarget(targets.protein)} g` : '',
            parseTarget(targets.carbs) ? `carboidratos ${parseTarget(targets.carbs)} g` : '',
            parseTarget(targets.fat) ? `gorduras ${parseTarget(targets.fat)} g` : '',
        ].filter(Boolean);
        lines.push(`Meta diária: ${kcal} kcal${macros.length ? ` (${macros.join(', ')})` : ''}.`);
    }
    return lines.join('\n');
}

function PlacementChoice({ value, onChange }: { value: 'replace' | 'append'; onChange: (value: 'replace' | 'append') => void }) {
    return (
        <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">O rascunho deve…</legend>
            <div className="grid gap-2 sm:grid-cols-2">
                {(
                    [
                        { value: 'replace', label: 'Substituir as refeições atuais' },
                        { value: 'append', label: 'Ser adicionado ao final' },
                    ] as const
                ).map((option) => (
                    <label
                        key={option.value}
                        className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                            value === option.value ? 'border-[#F88022] bg-[#F88022]/5 text-foreground' : 'border-border text-muted-foreground'
                        )}
                    >
                        <input
                            type="radio"
                            name="draft-placement"
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="accent-[#F88022]"
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function GenerateDraftDialog({ mode, onClose, student, energy, targets, hasFoods, mealCount, onDraft }: GenerateDraftDialogProps) {
    const [info, setInfo] = useState('');
    const [requiredFoods, setRequiredFoods] = useState('');
    const [meals, setMeals] = useState(5);
    const [placement, setPlacement] = useState<'replace' | 'append'>('replace');
    const [goal, setGoal] = useState<GoalKey>('MAINTENANCE');
    const [kcal, setKcal] = useState('');
    const [kcalTouched, setKcalTouched] = useState(false);
    const [weight, setWeight] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!mode) return;
        const studentGoal = energy?.goal ?? normalizeGoal(student?.goal);
        setInfo(describeStudent(student, energy, targets));
        setRequiredFoods('');
        setPlacement('replace');
        setGoal(studentGoal);
        const targetKcal = parseTarget(targets.calories);
        setKcal(String(targetKcal ?? energy?.targetCalories ?? ''));
        setKcalTouched(Boolean(targetKcal));
        setWeight(student?.weight ? String(student.weight) : '');
        setError(null);
        setMeals(mode === 'ai' ? Math.min(Math.max(mealCount || 5, 2), 8) : Math.min(Math.max(mealCount || 5, 3), 6));
        // Recalcula só ao abrir o diálogo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const changeGoal = (next: GoalKey) => {
        setGoal(next);
        if (!kcalTouched && energy) {
            const delta = GOAL_OPTIONS.find((option) => option.value === next)?.delta ?? 0;
            setKcal(String(Math.round((energy.tdee + delta) / 10) * 10));
        }
    };

    const generateWithAi = async () => {
        if (info.trim().length < 10) {
            setError('Descreva o aluno ou o objetivo com um pouco mais de detalhe (mínimo 10 caracteres).');
            return;
        }
        const response = await fetch('/api/diets/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: student ? 'student' : 'template',
                studentId: student?.id,
                studentInfo: info.trim(),
                requiredFoods: requiredFoods.trim(),
                mealCount: meals,
            }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) throw new Error(body?.error || 'Não foi possível gerar o rascunho agora.');
        const data = body.data;
        onDraft({
            source: 'ai',
            title: typeof data.title === 'string' ? data.title : undefined,
            warnings: Array.isArray(data.warnings) ? data.warnings : [],
            append: hasFoods && placement === 'append',
            meals: (data.meals ?? []).map((meal: any) => ({
                uid: newUid('meal'),
                name: String(meal.name || ''),
                time: String(meal.time || ''),
                notes: '',
                collapsed: false,
                foods: (meal.foods ?? []).map((food: any) => foodFromRaw(food, 'ai')),
            })),
        });
    };

    const generateWithRules = () => {
        const targetKcal = parseAmount(kcal);
        const weightValue = parseAmount(weight);
        if (!Number.isFinite(targetKcal) || targetKcal < 800 || targetKcal > 6000) {
            setError('Informe uma meta entre 800 e 6.000 kcal.');
            return;
        }
        if (!Number.isFinite(weightValue) || weightValue < 25 || weightValue > 300) {
            setError('Informe o peso (kg) — ele limita a proteína a 2,2 g/kg.');
            return;
        }
        const plan = generateDietPlan({
            weight: weightValue,
            height: Number(student?.height) || 170,
            age: energy?.age ?? 30,
            gender: student?.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
            activityLevel: (energy?.activityLevel ?? 'MODERATE') as 'SEDENTARY' | 'LIGHT' | 'MODERATE' | 'ACTIVE' | 'VERY_ACTIVE',
            goal,
            restrictions: student?.restrictions ?? '',
            targetCalories: targetKcal,
        });
        const selected = (MEAL_SUBSETS[meals] ?? MEAL_SUBSETS[5]).map((index) => plan.meals[index]).filter(Boolean);
        const selectedKcal = selected.reduce(
            (total, meal) => total + meal.foods.reduce((sum, food) => sum + food.calories * food.quantity, 0),
            0
        );
        // Menos refeições que o padrão do gerador: redistribui as porções para manter a meta do dia.
        const factor = selectedKcal > 0 ? targetKcal / selectedKcal : 1;
        const tacoById = new Map(tacoFoods.map((food) => [food.id, food]));
        onDraft({
            source: 'rules',
            title: `Plano ${formatInteger(targetKcal)} kcal`,
            warnings: [],
            append: hasFoods && placement === 'append',
            targets: suggestTargets(targetKcal, weightValue, goal),
            meals: selected.map((meal) => ({
                uid: newUid('meal'),
                name: meal.name,
                time: meal.time,
                notes: '',
                collapsed: false,
                foods: meal.foods.map((food) => {
                    const taco = tacoById.get(food.foodId);
                    const step = taco?.step ?? 0.5;
                    const max = (taco?.maxQty ?? 3) * 1.5;
                    const quantity = Math.min(Math.max(Math.round((food.quantity * factor) / step) * step, step), max);
                    return foodFromRaw({ ...food, foodId: undefined, quantity }, 'rules');
                }),
            })),
        });
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (mode === 'ai') await generateWithAi();
            else generateWithRules();
        } catch (generationError) {
            setError(generationError instanceof Error ? generationError.message : 'Não foi possível gerar o rascunho.');
        } finally {
            setLoading(false);
        }
    };

    const isAi = mode === 'ai';

    return (
        <Dialog open={mode !== null} onOpenChange={(open) => !open && !loading && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border-border bg-card" onCloseAutoFocus={(event) => event.preventDefault()}>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            {isAi ? <Sparkles className="h-5 w-5 text-[#F88022]" /> : <Wand2 className="h-5 w-5 text-[#F88022]" />}
                            {isAi ? 'Gerar rascunho com IA' : 'Gerar rascunho automático'}
                        </DialogTitle>
                        <DialogDescription>
                            O rascunho aparece no editor para você revisar. Nada é salvo e os dados do aluno não são alterados.
                        </DialogDescription>
                    </DialogHeader>

                    {isAi ? (
                        <>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-foreground">{student ? 'Informações e necessidades do aluno' : 'Perfil e objetivo do modelo'}</span>
                                <textarea
                                    autoFocus
                                    rows={5}
                                    maxLength={4000}
                                    value={info}
                                    onChange={(event) => setInfo(event.target.value)}
                                    placeholder="Ex.: objetivo de emagrecimento, treina às 18h, precisa de refeições simples para levar ao trabalho…"
                                    className={textareaClass}
                                />
                                <span className="block text-xs text-muted-foreground">
                                    A IA também recebe o cadastro e a anamnese do aluno. Inclua rotina, preferências e horários.
                                </span>
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-foreground">Alimentos que devem aparecer (opcional)</span>
                                <textarea
                                    rows={2}
                                    maxLength={2000}
                                    value={requiredFoods}
                                    onChange={(event) => setRequiredFoods(event.target.value)}
                                    placeholder="Ex.: arroz, feijão, frango, ovos, banana e aveia"
                                    className={textareaClass}
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-sm font-medium text-foreground">Número de refeições</span>
                                <select value={meals} onChange={(event) => setMeals(Number(event.target.value))} className={fieldClass}>
                                    {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                                        <option key={count} value={count}>
                                            {count} refeições
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </>
                    ) : (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-foreground">Objetivo</span>
                                    <select autoFocus value={goal} onChange={(event) => changeGoal(event.target.value as GoalKey)} className={fieldClass}>
                                        {GOAL_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-foreground">Número de refeições</span>
                                    <select value={meals} onChange={(event) => setMeals(Number(event.target.value))} className={fieldClass}>
                                        {[3, 4, 5, 6].map((count) => (
                                            <option key={count} value={count}>
                                                {count} refeições
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-foreground">Meta diária (kcal)</span>
                                    <input
                                        inputMode="numeric"
                                        value={kcal}
                                        onChange={(event) => {
                                            setKcal(event.target.value);
                                            setKcalTouched(true);
                                        }}
                                        className={cn(fieldClass, 'tabular-nums')}
                                        placeholder="Ex.: 2000"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-foreground">Peso (kg)</span>
                                    <input
                                        inputMode="decimal"
                                        value={weight}
                                        onChange={(event) => setWeight(event.target.value)}
                                        className={cn(fieldClass, 'tabular-nums')}
                                        placeholder="Ex.: 70"
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {energy
                                    ? `Gasto estimado do aluno: ${formatInteger(energy.tdee)} kcal/dia (${ACTIVITY_LABELS[energy.activityLevel] ?? 'atividade moderada'}${energy.activityAssumed ? ', assumida' : ''}).`
                                    : 'Sem peso, altura e nascimento no cadastro não há gasto estimado — informe a meta manualmente.'}{' '}
                                Usa a base TACO curada, respeitando as restrições da anamnese.
                            </p>
                        </>
                    )}

                    {hasFoods && <PlacementChoice value={placement} onChange={setPlacement} />}

                    {error && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F88022] px-4 py-2 text-sm font-semibold text-white hover:bg-[#F88022]/90 disabled:opacity-60"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading && isAi ? 'Gerando… (até 1 min)' : 'Gerar rascunho'}
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
