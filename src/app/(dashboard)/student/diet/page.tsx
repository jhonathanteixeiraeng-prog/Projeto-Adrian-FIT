'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    ChevronDown,
    ChevronUp,
    Flame
} from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { FoodSubstitutionModal } from '@/components/diet/FoodSubstitutionModal';
import { RefreshCw } from 'lucide-react';

export default function DietPage() {
    const [diet, setDiet] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
    const [substitutionModalOpen, setSubstitutionModalOpen] = useState(false);
    const [substitutionTarget, setSubstitutionTarget] = useState<any>(null); // { mealId, food, index }

    useEffect(() => {
        const fetchDiet = async () => {
            try {
                const response = await fetch('/api/student/diet');
                const data = await response.json();
                if (data.success) {
                    setDiet(data.data);
                }
            } catch (error) {
                console.error('Erro ao buscar dieta:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDiet();
    }, []);

    const toNumber = (value: unknown, fallback = 0) => {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : fallback;
        }

        if (typeof value === 'string') {
            const normalized = value.replace(',', '.').trim();
            if (!normalized) return fallback;

            const direct = Number(normalized);
            if (Number.isFinite(direct)) return direct;

            const match = normalized.match(/-?\d+(?:\.\d+)?/);
            if (!match) return fallback;

            const parsed = Number(match[0]);
            return Number.isFinite(parsed) ? parsed : fallback;
        }

        return fallback;
    };

    const parsePortionInfo = (portion?: string) => {
        const raw = String(portion || '100g').replace(',', '.').trim();
        const parenthesisMatch = raw.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
        if (parenthesisMatch) {
            return {
                baseAmount: toNumber(parenthesisMatch[1], 1),
                unit: parenthesisMatch[2].toLowerCase(),
            };
        }

        const baseMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (baseMatch) {
            return {
                baseAmount: toNumber(baseMatch[1], 1),
                unit: (baseMatch[2] || 'unidade').trim() || 'unidade',
            };
        }

        return { baseAmount: 1, unit: 'unidade' };
    };

    const parseQuantityFactor = (quantity: unknown, portion?: string) => {
        if (typeof quantity === 'number') {
            return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
        }

        if (typeof quantity !== 'string') {
            return 0;
        }

        const input = quantity.replace(',', '.').trim().toLowerCase();
        if (!input) return 0;

        const { baseAmount } = parsePortionInfo(portion);

        const malformedMass = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(g|ml)\b/);
        if (malformedMass) {
            const first = toNumber(malformedMass[1], 0);
            const second = toNumber(malformedMass[2], 0);
            const amount = first * second;
            return baseAmount > 0 ? amount / baseAmount : amount;
        }

        const malformedUnit = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/);
        if (malformedUnit) {
            const first = toNumber(malformedUnit[1], 0);
            const second = toNumber(malformedUnit[2], 0);
            return first * second;
        }

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
    };

    const formatAmount = (value: number) => {
        if (!Number.isFinite(value)) return '0';
        const rounded = Math.round(value * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const formatFoodQuantity = (food: any) => {
        const rawQuantity = food?.quantity;
        if (typeof rawQuantity === 'string' && /[a-zA-Z]/.test(rawQuantity.trim())) {
            return rawQuantity.trim();
        }

        const factor = parseQuantityFactor(rawQuantity, food?.portion);
        if (!factor || factor <= 0) return '0';

        const { baseAmount, unit } = parsePortionInfo(food?.portion);
        const totalAmount = factor * baseAmount;
        const normalizedUnit = unit.toLowerCase();

        if (/^unidade(s)?$/.test(normalizedUnit)) {
            const label = Math.abs(totalAmount - 1) < 0.001 ? 'unidade' : 'unidades';
            return `${formatAmount(totalAmount)} ${label}`;
        }

        return `${formatAmount(totalAmount)} ${unit}`;
    };

    const getFoodNutritionTotals = (food: any) => {
        const factor = parseQuantityFactor(food?.quantity, food?.portion);
        const calories = toNumber(food?.calories, 0) * factor;
        const protein = toNumber(food?.protein, 0) * factor;
        const carbs = toNumber(food?.carbs, 0) * factor;
        const fat = toNumber(food?.fat, 0) * factor;
        return { calories, protein, carbs, fat };
    };

    const normalizedDiet = useMemo(() => {
        if (!diet) return null;

        const meals = (diet.meals || []).map((meal: any) => {
            const foods = (meal.foods || []).map((food: any) => {
                const totals = getFoodNutritionTotals(food);
                return {
                    ...food,
                    quantityDisplay: formatFoodQuantity(food),
                    totalCalories: totals.calories,
                    totalProtein: totals.protein,
                    totalCarbs: totals.carbs,
                    totalFat: totals.fat,
                };
            });

            const computedMealCalories = foods.reduce((acc: number, food: any) => acc + toNumber(food.totalCalories, 0), 0);

            return {
                ...meal,
                foods,
                calories: Math.round(computedMealCalories),
            };
        });

        return {
            ...diet,
            meals,
        };
    }, [diet]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!normalizedDiet) {
        return (
            <div className="space-y-6 animate-in pb-8">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-bold text-foreground">Minha Dieta</h1>
                </div>
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        <p>Você ainda não possui uma dieta ativa.</p>
                        <p className="text-sm mt-2">Aguarde seu personal trainer criar um plano para você.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const completedMeals = normalizedDiet.meals ? normalizedDiet.meals.filter((m: any) => m.completed).length : 0;
    const consumedCalories = normalizedDiet.meals
        ? normalizedDiet.meals
            .filter((m: any) => m.completed)
            .reduce((acc: number, m: any) => acc + (m.calories || 0), 0)
        : 0;

    const toggleMeal = (mealId: string) => {
        // Optimistic update
        setDiet((prev: any) => ({
            ...prev,
            meals: prev.meals.map((m: any) =>
                m.id === mealId ? { ...m, completed: !m.completed } : m
            ),
        }));

        // TODO: Implement API call to persist meal completion
    };

    const openSubstitution = (mealId: string, food: any, index: number) => {
        setSubstitutionTarget({ mealId, food, index });
        setSubstitutionModalOpen(true);
    };

    const handleSubstitution = (result: any) => {
        // Optimistic update or refresh content
        // The result contains the updated meal and substitution details
        if (result.updatedMeal) {
            setDiet((prev: any) => ({
                ...prev,
                meals: prev.meals.map((m: any) =>
                    m.id === result.updatedMeal.id ? { ...m, foods: result.updatedMeal.foods } : m
                )
            }));
        }
    };

    const closeSubstitutionModal = () => {
        setSubstitutionModalOpen(false);
        setSubstitutionTarget(null);
    };

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground">Minha Dieta</h1>
                    <p className="text-sm text-muted-foreground">{normalizedDiet.title}</p>
                </div>
            </div>

            {/* Macros Overview */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Flame className="w-5 h-5 text-orange-500" />
                            <span className="font-semibold text-foreground">Calorias de Hoje</span>
                        </div>
                        <Badge variant={consumedCalories >= (normalizedDiet.calories || 2000) * 0.8 ? 'success' : 'info'}>
                            {Math.round(consumedCalories)} / {normalizedDiet.calories || 0} kcal
                        </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-4">
                        <div
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min((consumedCalories / (normalizedDiet.calories || 1)) * 100, 100)}%` }}
                        />
                    </div>

                    {/* Macros Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-3 bg-muted rounded-xl">
                            <p className="text-lg font-bold text-blue-500">{normalizedDiet.protein || 0}g</p>
                            <p className="text-xs text-muted-foreground">Proteína</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-xl">
                            <p className="text-lg font-bold text-yellow-500">{normalizedDiet.carbs || 0}g</p>
                            <p className="text-xs text-muted-foreground">Carboidratos</p>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-xl">
                            <p className="text-lg font-bold text-red-500">{normalizedDiet.fat || 0}g</p>
                            <p className="text-xs text-muted-foreground">Gordura</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Meals List */}
            <div className="space-y-3">
                {normalizedDiet.meals && normalizedDiet.meals.map((meal: any) => (
                    <Card
                        key={meal.id}
                        className={meal.completed ? 'bg-accent/10 border-accent/30' : ''}
                    >
                        <CardContent className="p-4">
                            {/* Meal Header */}
                            <div
                                className="flex items-center gap-4 cursor-pointer"
                                onClick={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${meal.completed
                                    ? 'bg-accent text-white'
                                    : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {meal.completed ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                    ) : (
                                        <Clock className="w-5 h-5" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-semibold ${meal.completed ? 'text-accent' : 'text-foreground'}`}>
                                        {meal.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {meal.time} • {meal.calories} kcal
                                    </p>
                                </div>
                                {expandedMeal === meal.id ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>

                            {/* Expanded Foods */}
                            {expandedMeal === meal.id && (
                                <div className="mt-4 pt-4 border-t border-border animate-in">
                                    <div className="space-y-2 mb-4">
                                        {meal.foods.map((food: any, index: number) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg group"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-foreground text-sm">{food.name}</p>
                                                        {food.isSubstitution && (
                                                            <Badge variant="outline" className="text-[10px] h-4 px-1">Substituído</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{food.quantityDisplay}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm text-muted-foreground">{Math.round(food.totalCalories || 0)} kcal</span>
                                                    {!meal.completed && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2 text-[11px]"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openSubstitution(meal.id, { ...food, index }, index);
                                                            }}
                                                            title="Substituir alimento"
                                                        >
                                                            <RefreshCw className="w-3 h-3" />
                                                            Substituir
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        variant={meal.completed ? 'outline' : 'accent'}
                                        className="w-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleMeal(meal.id);
                                        }}
                                    >
                                        {meal.completed ? (
                                            <>Desmarcar Refeição</>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                Marcar como Concluída
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Summary */}
            <Card className="bg-gradient-to-r from-accent/10 to-secondary/10">
                <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        {completedMeals} de {normalizedDiet.meals.length} refeições concluídas
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                        {consumedCalories} kcal consumidas
                    </p>
                </CardContent>
            </Card>
            {/* Substitution Modal */}
            {substitutionTarget && (
                <FoodSubstitutionModal
                    isOpen={substitutionModalOpen}
                    onClose={closeSubstitutionModal}
                    originalFood={substitutionTarget.food}
                    mealId={substitutionTarget.mealId}
                    onSubstitute={handleSubstitution}
                />
            )}
        </div>
    );
}
