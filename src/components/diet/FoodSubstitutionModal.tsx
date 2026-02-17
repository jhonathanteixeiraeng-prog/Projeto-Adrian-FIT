'use client';

import { useState, useEffect } from 'react';
import { Search, ArrowRight, AlertCircle } from 'lucide-react';
import { Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, Badge } from '@/components/ui';

interface FoodData {
    id?: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    portion?: string;
    source?: 'local' | 'external';
}

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : fallback;
    }

    if (typeof value !== 'string') {
        return fallback;
    }

    const normalized = value.replace(',', '.').trim();
    if (!normalized) return fallback;

    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return fallback;

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value: number, decimals = 1) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function parsePortionInfo(portion?: string) {
    const raw = String(portion || '100g').replace(',', '.').trim();
    const parenthesisMatch = raw.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
    if (parenthesisMatch) {
        return {
            baseAmount: toNumber(parenthesisMatch[1], 1),
            unit: parenthesisMatch[2].toLowerCase(),
            hasNumericBase: true,
        };
    }

    const baseMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (baseMatch) {
        return {
            baseAmount: toNumber(baseMatch[1], 1),
            unit: (baseMatch[2] || 'unidade').trim() || 'unidade',
            hasNumericBase: true,
        };
    }

    return { baseAmount: 1, unit: 'unidade', hasNumericBase: false };
}

function parseQuantityFactor(quantity: unknown, portion?: string) {
    if (typeof quantity === 'number') {
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    }

    if (typeof quantity !== 'string') {
        return 0;
    }

    const input = quantity.replace(',', '.').trim().toLowerCase();
    if (!input) return 0;

    const { baseAmount } = parsePortionInfo(portion);
    const amount = toNumber(input, 0);
    if (amount <= 0) return 0;

    if (input.includes('x')) return amount;

    if (/\b(g|ml)\b/.test(input)) {
        return baseAmount > 0 ? amount / baseAmount : amount;
    }

    if (/\b(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/.test(input)) {
        return amount;
    }

    if (baseAmount >= 20) {
        return amount / baseAmount;
    }

    return amount;
}

function formatAmount(value: number) {
    if (!Number.isFinite(value)) return '0';
    const rounded = round(value, 1);
    return Number.isInteger(rounded)
        ? String(rounded)
        : rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatQuantityFromFactor(factor: number, portion?: string) {
    const parsedPortion = parsePortionInfo(portion);
    const safeFactor = Math.max(factor, 0.1);

    if (!parsedPortion.hasNumericBase) {
        return `${formatAmount(safeFactor)}x ${String(portion || 'porção')}`;
    }

    const total = safeFactor * parsedPortion.baseAmount;
    const unit = parsedPortion.unit.toLowerCase();

    if (/^unidade(s)?$/.test(unit)) {
        const label = Math.abs(total - 1) < 0.001 ? 'unidade' : 'unidades';
        return `${formatAmount(total)} ${label}`;
    }

    if (/^fatia(s)?$/.test(unit)) {
        const label = Math.abs(total - 1) < 0.001 ? 'fatia' : 'fatias';
        return `${formatAmount(total)} ${label}`;
    }

    return `${formatAmount(total)} ${parsedPortion.unit}`;
}

function calculateTotals(perUnit: { calories: number; protein: number; carbs: number; fat: number }, factor: number) {
    return {
        calories: perUnit.calories * factor,
        protein: perUnit.protein * factor,
        carbs: perUnit.carbs * factor,
        fat: perUnit.fat * factor,
    };
}

function relativeDiff(current: number, target: number, floor = 1) {
    const denominator = Math.max(Math.abs(target), floor);
    return Math.abs(current - target) / denominator;
}

function findBestFactor(
    targetTotals: { calories: number; protein: number; carbs: number; fat: number },
    newFoodPerUnit: { calories: number; protein: number; carbs: number; fat: number }
) {
    const candidates = new Set<number>();

    if (newFoodPerUnit.calories > 0) candidates.add(targetTotals.calories / newFoodPerUnit.calories);
    if (newFoodPerUnit.protein > 0) candidates.add(targetTotals.protein / newFoodPerUnit.protein);
    if (newFoodPerUnit.carbs > 0) candidates.add(targetTotals.carbs / newFoodPerUnit.carbs);
    if (newFoodPerUnit.fat > 0) candidates.add(targetTotals.fat / newFoodPerUnit.fat);

    const arr = Array.from(candidates).filter((v) => Number.isFinite(v) && v > 0);
    const avg = arr.length > 0 ? arr.reduce((acc, v) => acc + v, 0) / arr.length : 1;
    arr.push(avg, 1);

    let bestFactor = 1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const factor of arr) {
        const safeFactor = Math.max(0.1, Math.min(factor, 20));
        const totals = calculateTotals(newFoodPerUnit, safeFactor);
        const score =
            (relativeDiff(totals.calories, targetTotals.calories, 50) * 0.45) +
            (relativeDiff(totals.protein, targetTotals.protein, 8) * 0.2) +
            (relativeDiff(totals.carbs, targetTotals.carbs, 8) * 0.2) +
            (relativeDiff(totals.fat, targetTotals.fat, 5) * 0.15);

        if (score < bestScore) {
            bestScore = score;
            bestFactor = safeFactor;
        }
    }

    return round(bestFactor, 2);
}

interface FoodSubstitutionModalProps {
    isOpen: boolean;
    onClose: () => void;
    originalFood: any; // The food item being replaced
    mealId: string;
    onSubstitute: (result: any) => void;
}

export function FoodSubstitutionModal({ isOpen, onClose, originalFood, mealId, onSubstitute }: FoodSubstitutionModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<FoodData[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFood, setSelectedFood] = useState<FoodData | null>(null);
    const [calculation, setCalculation] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length >= 2) {
                searchFoods();
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const searchFoods = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/foods/search?q=${encodeURIComponent(searchTerm)}`);
            const data = await response.json();
            if (data.success) {
                setSearchResults(data.data);
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFood = (food: FoodData) => {
        setSelectedFood(food);

        const originalPerUnit = {
            calories: toNumber(originalFood?.calories, 0),
            protein: toNumber(originalFood?.protein, 0),
            carbs: toNumber(originalFood?.carbs, 0),
            fat: toNumber(originalFood?.fat, 0),
        };
        const originalFactor = parseQuantityFactor(originalFood?.quantity, originalFood?.portion) || 1;
        const targetTotals = {
            calories: toNumber(originalFood?.totalCalories, originalPerUnit.calories * originalFactor),
            protein: toNumber(originalFood?.totalProtein, originalPerUnit.protein * originalFactor),
            carbs: toNumber(originalFood?.totalCarbs, originalPerUnit.carbs * originalFactor),
            fat: toNumber(originalFood?.totalFat, originalPerUnit.fat * originalFactor),
        };

        const newFoodPerUnit = {
            calories: toNumber(food.calories, 0),
            protein: toNumber(food.protein, 0),
            carbs: toNumber(food.carbs, 0),
            fat: toNumber(food.fat, 0),
        };

        const factor = findBestFactor(targetTotals, newFoodPerUnit);
        const matchedTotals = calculateTotals(newFoodPerUnit, factor);
        const quantityLabel = formatQuantityFromFactor(factor, food.portion || '100g');

        setCalculation({
            factor,
            quantityLabel,
            targetCalories: round(targetTotals.calories, 1),
            targetProtein: round(targetTotals.protein, 1),
            targetCarbs: round(targetTotals.carbs, 1),
            targetFat: round(targetTotals.fat, 1),
            calories: round(matchedTotals.calories, 1),
            protein: round(matchedTotals.protein, 1),
            carbs: round(matchedTotals.carbs, 1),
            fat: round(matchedTotals.fat, 1),
        });
    };

    const handleConfirm = async () => {
        if (!selectedFood) return;
        setSubmitting(true);

        try {
            const response = await fetch('/api/student/diet/substitute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mealId,
                    originalFoodIndex: originalFood.index,
                    originalFood: originalFood,
                    newFood: selectedFood
                })
            });

            const data = await response.json();
            if (data.success) {
                onSubstitute(data.data);
                handleClose();
            } else {
                alert('Erro: ' + data.error);
            }
        } catch (error) {
            console.error('Substitution error:', error);
            alert('Erro ao realizar substituição');
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setSelectedFood(null);
        setCalculation(null);
        setSearchTerm('');
        setSearchResults([]);
        setLoading(false);
        setSubmitting(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            reset();
        }
    }, [isOpen, originalFood?.id, originalFood?.name]);

    return (
        <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Substituir Alimento</DialogTitle>
                </DialogHeader>

                {!selectedFood ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar novo alimento..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                            {loading && <p className="text-center text-sm text-muted-foreground">Buscando...</p>}

                            {!loading && searchResults.length === 0 && searchTerm.length >= 2 && (
                                <p className="text-center text-sm text-muted-foreground">Nenhum alimento encontrado.</p>
                            )}

                            {searchResults.map((food) => (
                                <div
                                    key={food.id || food.name}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                                    onClick={() => handleSelectFood(food)}
                                >
                                    <div>
                                        <p className="font-medium">{food.name}</p>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                            <span>{food.calories} kcal</span>
                                            <span>P: {food.protein}g</span>
                                            <span>C: {food.carbs}g</span>
                                            <span>G: {food.fat}g</span>
                                        </div>
                                    </div>
                                    {food.source === 'external' && <Badge variant="outline" className="text-[10px]">Online</Badge>}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Comparison View */}
                        <div className="flex items-center justify-between">
                            <div className="flex-1 text-center p-2 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">Original</p>
                                <p className="font-medium text-sm truncate">{originalFood.name}</p>
                                <p className="text-xs font-bold mt-1">{originalFood.quantityDisplay || originalFood.quantity}</p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground mx-2" />
                            <div className="flex-1 text-center p-2 bg-secondary/10 border border-secondary/20 rounded-lg">
                                <p className="text-xs text-secondary font-medium">Novo</p>
                                <p className="font-medium text-sm truncate">{selectedFood.name}</p>
                                <p className="text-xs font-bold text-secondary mt-1">
                                    {calculation ? calculation.quantityLabel : 'Calculando...'}
                                </p>
                            </div>
                        </div>

                        {calculation && (
                            <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="p-2 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground">Kcal</p>
                                    <p className="text-xs font-bold">{calculation.calories}</p>
                                </div>
                                <div className="p-2 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground">Prot</p>
                                    <p className="text-xs font-bold">{calculation.protein}g</p>
                                </div>
                                <div className="p-2 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground">Carb</p>
                                    <p className="text-xs font-bold">{calculation.carbs}g</p>
                                </div>
                                <div className="p-2 bg-muted rounded-lg">
                                    <p className="text-[10px] text-muted-foreground">Gord</p>
                                    <p className="text-xs font-bold">{calculation.fat}g</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-yellow-500/10 p-3 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                A quantidade será ajustada automaticamente para manter calorias e macronutrientes o mais próximo possível do alimento original.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={reset} className="flex-1">
                                Voltar
                            </Button>
                            <Button onClick={handleConfirm} disabled={submitting} className="flex-1" variant="secondary">
                                {submitting ? 'Confirmando...' : 'Confirmar Troca'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
