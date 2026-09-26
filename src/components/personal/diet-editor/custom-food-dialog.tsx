'use client';

import React, { useEffect, useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { invalidateApi } from '@/hooks/use-api';
import { clearFoodSearchCache } from './food-search';
import type { FoodSnapshot } from './model';
import { formatInteger, parseAmount } from './units';

interface CustomFoodDialogProps {
    open: boolean;
    initialName: string;
    onClose: () => void;
    onCreated: (food: FoodSnapshot) => void;
}

const fieldClass =
    'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

const MACRO_FIELDS = [
    { key: 'calories', label: 'Calorias (kcal)' },
    { key: 'protein', label: 'Proteína (g)' },
    { key: 'carbs', label: 'Carboidrato (g)' },
    { key: 'fat', label: 'Gordura (g)' },
] as const;

type MacroField = (typeof MACRO_FIELDS)[number]['key'];

/** Cadastra um alimento próprio (fica disponível nas próximas buscas deste personal e dos alunos dele). */
export function CustomFoodDialog({ open, initialName, onClose, onCreated }: CustomFoodDialogProps) {
    const { toast } = useToast();
    const [name, setName] = useState(initialName);
    const [portion, setPortion] = useState('100g');
    const [values, setValues] = useState<Record<MacroField, string>>({ calories: '', protein: '', carbs: '', fat: '' });
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(initialName);
        setPortion('100g');
        setValues({ calories: '', protein: '', carbs: '', fat: '' });
        setError(null);
    }, [open, initialName]);

    const parsed = (key: MacroField) => {
        const value = parseAmount(values[key] || '0');
        return Number.isFinite(value) ? value : NaN;
    };
    const estimatedKcal = (parsed('protein') || 0) * 4 + (parsed('carbs') || 0) * 4 + (parsed('fat') || 0) * 9;

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const macros = {
            calories: parsed('calories'),
            protein: parsed('protein'),
            carbs: parsed('carbs'),
            fat: parsed('fat'),
        };
        if (!name.trim()) {
            setError('Informe o nome do alimento.');
            return;
        }
        if (Object.values(macros).some((value) => !Number.isFinite(value) || value < 0)) {
            setError('Use apenas números nos valores nutricionais (ex.: 12,5).');
            return;
        }
        if (macros.calories <= 0 && estimatedKcal <= 0) {
            setError('Informe as calorias ou os macronutrientes da porção.');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const response = await fetch('/api/foods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim(),
                    portion: portion.trim() || '100g',
                    calories: macros.calories > 0 ? macros.calories : Math.round(estimatedKcal),
                    protein: macros.protein,
                    carbs: macros.carbs,
                    fat: macros.fat,
                }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Não foi possível cadastrar o alimento.');
            clearFoodSearchCache();
            invalidateApi('/api/foods');
            const food = body.data;
            onCreated({
                id: food.id,
                name: food.name,
                portion: food.portion,
                calories: Number(food.calories) || 0,
                protein: Number(food.protein) || 0,
                carbs: Number(food.carbs) || 0,
                fat: Number(food.fat) || 0,
                isSystem: false,
                source: 'custom',
            });
            toast.success('Alimento cadastrado', `“${food.name}” já aparece nas suas buscas.`);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : 'Não foi possível cadastrar o alimento.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
            <DialogContent className="max-w-lg rounded-2xl border-border bg-card" onCloseAutoFocus={(event) => event.preventDefault()}>
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-base font-bold">Cadastrar alimento próprio</DialogTitle>
                        <DialogDescription>
                            Valores por porção base. Ele entra nesta refeição e fica disponível nas suas próximas buscas.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-foreground">Nome</span>
                            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Ex.: Pão de queijo caseiro" />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-foreground">Porção base</span>
                            <input value={portion} onChange={(event) => setPortion(event.target.value)} className={fieldClass} placeholder="100g" />
                        </label>
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground">
                        Use “100g”, “30g” ou uma medida com o peso entre parênteses, como “1 unidade (50g)”, para poder prescrever em gramas.
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {MACRO_FIELDS.map((field) => (
                            <label key={field.key} className="space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
                                <input
                                    inputMode="decimal"
                                    value={values[field.key]}
                                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                                    className={cn(fieldClass, 'text-right tabular-nums')}
                                    placeholder="0"
                                />
                            </label>
                        ))}
                    </div>

                    {estimatedKcal > 0 && (
                        <button
                            type="button"
                            onClick={() => setValues((current) => ({ ...current, calories: String(Math.round(estimatedKcal)) }))}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                            <Calculator className="h-3.5 w-3.5" />
                            Usar {formatInteger(estimatedKcal)} kcal calculadas pelos macros (4/4/9)
                        </button>
                    )}

                    {error && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:space-x-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cadastrar e adicionar
                        </button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
