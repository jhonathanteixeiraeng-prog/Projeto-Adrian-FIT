'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Utensils,
    Plus,
    Save,
    Trash2,
    ChevronDown,
    ChevronUp,
    Loader2,
    Clock,
    Wand2,
} from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Button,
    Input,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui';
import { calculateBMR, calculateTDEE, generateDietPlan } from '@/lib/diet-generator';

interface MealFood {
    id: string;
    name: string;
    quantity: string;
    notes: string;
    portion?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    source?: 'local' | 'external' | 'generated';
}

interface Meal {
    id: string;
    name: string;
    time: string;
    foods: MealFood[];
    notes: string;
    isExpanded: boolean;
}

type DietGoal = 'WEIGHT_LOSS' | 'MAINTENANCE' | 'MUSCLE_GAIN';
type FoodSearchResult = {
    id: string;
    name: string;
    portion?: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    source?: 'local' | 'external';
};

export default function StudentDietPage() {
    const params = useParams();
    const router = useRouter();
    const studentId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showConfirmReplace, setShowConfirmReplace] = useState(false);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [student, setStudent] = useState<any>(null);
    const [generateGoal, setGenerateGoal] = useState<DietGoal>('MAINTENANCE');
    const [generateMealCount, setGenerateMealCount] = useState(6);
    const [generateCalorieAdjustmentInput, setGenerateCalorieAdjustmentInput] = useState('0');
    const [activeFoodFieldKey, setActiveFoodFieldKey] = useState<string | null>(null);
    const [foodSearchQuery, setFoodSearchQuery] = useState('');
    const [foodSuggestions, setFoodSuggestions] = useState<FoodSearchResult[]>([]);
    const [foodSearching, setFoodSearching] = useState(false);
    const [dietPlan, setDietPlan] = useState({
        title: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
    });
    const [meals, setMeals] = useState<Meal[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!activeFoodFieldKey || foodSearchQuery.trim().length < 2) {
                setFoodSuggestions([]);
                return;
            }

            try {
                setFoodSearching(true);
                const res = await fetch(`/api/foods/search?q=${encodeURIComponent(foodSearchQuery.trim())}`);
                const data = await res.json();
                if (data.success) {
                    setFoodSuggestions(data.data || []);
                } else {
                    setFoodSuggestions([]);
                }
            } catch (error) {
                console.error('Food autocomplete error:', error);
                setFoodSuggestions([]);
            } finally {
                setFoodSearching(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [activeFoodFieldKey, foodSearchQuery]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const studentRes = await fetch(`/api/students/${studentId}`);
            const studentData = await studentRes.json();
            if (studentData.success) {
                setStudent(studentData.data);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const addMeal = () => {
        const mealNames = ['Café da Manhã', 'Lanche da Manhã', 'Almoço', 'Lanche da Tarde', 'Jantar', 'Ceia'];
        const mealTimes = ['07:00', '10:00', '12:30', '16:00', '19:30', '22:00'];
        const mealIndex = meals.length % mealNames.length;

        const newMeal: Meal = {
            id: `meal-${Date.now()}`,
            name: mealNames[mealIndex],
            time: mealTimes[mealIndex],
            foods: [],
            notes: '',
            isExpanded: true,
        };
        setMeals([...meals, newMeal]);
    };

    const removeMeal = (mealId: string) => {
        setMeals(meals.filter(m => m.id !== mealId));
    };

    const toggleMealExpanded = (mealId: string) => {
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, isExpanded: !m.isExpanded } : m
        ));
    };

    const updateMeal = (mealId: string, field: keyof Meal, value: any) => {
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, [field]: value } : m
        ));
    };

    const addFoodToMeal = (mealId: string) => {
        const newFood: MealFood = {
            id: `food-${Date.now()}`,
            name: '',
            quantity: '',
            notes: '',
        };
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, foods: [...m.foods, newFood] } : m
        ));
    };

    const removeFoodFromMeal = (mealId: string, foodId: string) => {
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, foods: m.foods.filter(f => f.id !== foodId) } : m
        ));
    };

    const updateFood = (mealId: string, foodId: string, field: keyof MealFood, value: string) => {
        setMeals(meals.map(m =>
            m.id === mealId ? {
                ...m,
                foods: m.foods.map(f =>
                    f.id === foodId ? { ...f, [field]: value } : f
                )
            } : m
        ));
    };

    const updateFoodFields = (mealId: string, foodId: string, updates: Partial<MealFood>) => {
        setMeals(meals.map(m =>
            m.id === mealId
                ? {
                    ...m,
                    foods: m.foods.map(f => (f.id === foodId ? { ...f, ...updates } : f))
                }
                : m
        ));
    };

    const getFoodFieldKey = (mealId: string, foodId: string) => `${mealId}:${foodId}`;

    const parsePortionInfo = (portion?: string) => {
        const raw = (portion || '100g').replace(',', '.').trim();
        const parenthesisMatch = raw.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
        if (parenthesisMatch) {
            return {
                baseAmount: parseFloat(parenthesisMatch[1]) || 1,
                unit: parenthesisMatch[2].toLowerCase(),
            };
        }

        const baseMatch = raw.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (baseMatch) {
            return {
                baseAmount: parseFloat(baseMatch[1]) || 1,
                unit: (baseMatch[2] || 'unidade').trim() || 'unidade',
            };
        }

        return { baseAmount: 1, unit: 'unidade' };
    };

    const parseQuantityFactor = (quantity: string, portion?: string) => {
        const input = (quantity || '').replace(',', '.').trim().toLowerCase();
        if (!input) return null;

        const valueMatch = input.match(/(\d+(?:\.\d+)?)/);
        if (!valueMatch) return null;
        const value = parseFloat(valueMatch[1]);
        if (!Number.isFinite(value) || value <= 0) return null;

        if (input.includes('x')) return value;

        const { baseAmount } = parsePortionInfo(portion);
        if (!baseAmount || baseAmount <= 0) return value;
        return value / baseAmount;
    };

    const getFoodNutritionTotals = (food: MealFood) => {
        if (
            typeof food.calories !== 'number' ||
            typeof food.protein !== 'number' ||
            typeof food.carbs !== 'number' ||
            typeof food.fat !== 'number'
        ) {
            return null;
        }

        const factor = parseQuantityFactor(food.quantity, food.portion);
        if (!factor) return null;

        return {
            calories: food.calories * factor,
            protein: food.protein * factor,
            carbs: food.carbs * factor,
            fat: food.fat * factor,
        };
    };

    const planTotals = useMemo(() => {
        return meals.reduce(
            (acc, meal) => {
                meal.foods.forEach((food) => {
                    const totals = getFoodNutritionTotals(food);
                    if (!totals) return;
                    acc.calories += totals.calories;
                    acc.protein += totals.protein;
                    acc.carbs += totals.carbs;
                    acc.fat += totals.fat;
                });
                return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    }, [meals]);

    const handleFoodSearchSelect = (mealId: string, foodId: string, food: FoodSearchResult) => {
        const portion = food.portion || '100g';
        const { baseAmount } = parsePortionInfo(portion);
        updateFoodFields(mealId, foodId, {
            name: food.name,
            portion,
            calories: Number(food.calories || 0),
            protein: Number(food.protein || 0),
            carbs: Number(food.carbs || 0),
            fat: Number(food.fat || 0),
            source: food.source || 'local',
            quantity: String(Math.round(baseAmount)),
        });
        setFoodSuggestions([]);
        setActiveFoodFieldKey(null);
        setFoodSearchQuery('');
    };

    const normalizeGoal = (rawGoal?: string | null): DietGoal => {
        const value = (rawGoal || '').toUpperCase();
        if (value.includes('WEIGHT_LOSS') || value.includes('EMAG') || value.includes('CUT')) {
            return 'WEIGHT_LOSS';
        }
        if (value.includes('MUSCLE_GAIN') || value.includes('HIPER') || value.includes('BULK')) {
            return 'MUSCLE_GAIN';
        }
        return 'MAINTENANCE';
    };

    const getGoalDelta = (goal: DietGoal) => {
        if (goal === 'WEIGHT_LOSS') return -500;
        if (goal === 'MUSCLE_GAIN') return 300;
        return 0;
    };

    const getManualAdjustment = () => {
        const parsed = parseInt(generateCalorieAdjustmentInput, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    };

    const applyCalorieAdjustment = (baseValue: number) => {
        const manualAdjustment = getManualAdjustment();
        return baseValue + getGoalDelta(generateGoal) + manualAdjustment;
    };

    const getMaintenanceCalories = () => {
        if (!student?.weight || !student?.height || !(student.birthDate || student.user?.birthDate)) {
            return null;
        }

        const birthDate = new Date(student.birthDate || student.user?.birthDate);
        if (Number.isNaN(birthDate.getTime())) {
            return null;
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        const bmr = calculateBMR(
            Number(student.weight),
            Number(student.height),
            age,
            student.gender === 'FEMALE' ? 'FEMALE' : 'MALE'
        );
        const tdee = calculateTDEE(bmr, student.anamnesis?.activityLevel || 'MODERATE');
        return Math.round(tdee);
    };

    const formatAmount = (value: number) => {
        const rounded = Math.round(value * 10) / 10;
        if (Number.isInteger(rounded)) return String(rounded);
        return rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const formatGeneratedQuantity = (multiplier: number, portion: string) => {
        const normalized = portion.replace(',', '.').trim();

        // Handle portions like "1 scoop (30g)" by using the mass/volume in parentheses.
        const parenthesisMatch = normalized.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
        if (parenthesisMatch) {
            const base = parseFloat(parenthesisMatch[1]);
            const unit = parenthesisMatch[2].toLowerCase();
            return `${formatAmount(multiplier * base)}${unit}`;
        }

        // Handle portions like "100g", "40g", "1 unidade", "2 fatias".
        const baseMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*(.+)$/i);
        if (baseMatch) {
            const base = parseFloat(baseMatch[1]);
            const unitRaw = baseMatch[2].trim();
            const total = multiplier * base;

            if (/^unidade(s)?$/i.test(unitRaw)) {
                const unit = Math.abs(total - 1) < 0.001 ? 'unidade' : 'unidades';
                return `${formatAmount(total)} ${unit}`;
            }

            return `${formatAmount(total)} ${unitRaw}`;
        }

        // Fallback when portion has no numeric base.
        return `${formatAmount(multiplier)}x ${portion}`;
    };

    const normalizeLegacyQuantityText = (quantityText: string) => {
        const value = (quantityText || '').trim();
        if (!value) return value;

        const parse = (text: string) => parseFloat(text.replace(',', '.'));

        // "3 100g" / "2 40ml"
        const compactMassMatch = value.match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)(g|ml)$/i);
        if (compactMassMatch) {
            const multiplier = parse(compactMassMatch[1]);
            const base = parse(compactMassMatch[2]);
            const unit = compactMassMatch[3].toLowerCase();
            if (Number.isFinite(multiplier) && Number.isFinite(base)) {
                return `${formatAmount(multiplier * base)} ${unit}`;
            }
        }

        // "4 1 unidade" / "2 2 fatias"
        const splitPortionMatch = value.match(/^(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i);
        if (splitPortionMatch) {
            const multiplier = parse(splitPortionMatch[1]);
            const base = parse(splitPortionMatch[2]);
            const unitRaw = splitPortionMatch[3].trim();
            if (Number.isFinite(multiplier) && Number.isFinite(base)) {
                const total = multiplier * base;
                if (/^unidade(s)?$/i.test(unitRaw)) {
                    const unit = Math.abs(total - 1) < 0.001 ? 'unidade' : 'unidades';
                    return `${formatAmount(total)} ${unit}`;
                }
                return `${formatAmount(total)} ${unitRaw}`;
            }
        }

        return value;
    };

    const handleAutoGenerateClick = () => {
        if (!student) return;

        // Basic validation of metrics
        const weight = student.weight;
        const height = student.height;
        const birthDate = student.birthDate || student.user?.birthDate;

        if (!weight || !height || !birthDate) {
            alert('O aluno precisa ter peso, altura e data de nascimento cadastrados para gerar a dieta.');
            return;
        }

        setGenerateGoal(normalizeGoal(student.goal));
        setGenerateMealCount(6);
        setGenerateCalorieAdjustmentInput('0');
        setShowGenerateModal(true);
    };

    const handleGenerateFromModal = () => {
        setShowGenerateModal(false);

        if (meals.length > 0) {
            setShowConfirmReplace(true);
        } else {
            generateDiet();
        }
    };

    const generateDiet = () => {
        if (!student) return;
        setGenerating(true);

        // Calculate age
        const birthDate = new Date(student.birthDate || student.user?.birthDate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        try {
            const result = generateDietPlan({
                weight: student.weight,
                height: student.height,
                age: age,
                gender: student.gender || 'MALE',
                activityLevel: student.anamnesis?.activityLevel || 'MODERATE',
                goal: generateGoal,
            });

            const mealCount = Math.min(Math.max(generateMealCount, 1), result.meals.length);
            const selectedMeals = result.meals.slice(0, mealCount);
            const maintenanceCalories = getMaintenanceCalories();
            const adjustedCalories = applyCalorieAdjustment(maintenanceCalories || result.calories);
            const scaling = (result.calories || 1) > 0 ? adjustedCalories / (result.calories || 1) : 1;

            setDietPlan({
                title: `Plano Gerado - ${adjustedCalories} kcal`,
                calories: adjustedCalories,
                protein: Math.round(result.protein * scaling),
                carbs: Math.round(result.carbs * scaling),
                fat: Math.round(result.fat * scaling),
            });

            setMeals(selectedMeals.map((m, idx) => ({
                id: `meal-${Date.now()}-${idx}`,
                name: m.name,
                time: m.time,
                isExpanded: true,
                notes: '',
                foods: m.foods.map((f, fIdx) => ({
                    id: `food-${Date.now()}-${idx}-${fIdx}`,
                    name: f.name,
                    quantity: formatGeneratedQuantity(
                        Math.max(0.5, Math.round((f.quantity * scaling) * 2) / 2),
                        f.portion
                    ),
                    notes: '',
                    portion: f.portion,
                    calories: f.calories,
                    protein: f.protein,
                    carbs: f.carbs,
                    fat: f.fat,
                    source: 'generated',
                })),
            })));

            setShowConfirmReplace(false);
        } catch (err) {
            console.error('Error generating diet:', err);
            alert('Erro ao gerar dieta automática.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!dietPlan.title) {
            alert('Por favor, preencha o título da dieta');
            return;
        }

        if (meals.length === 0) {
            alert('Adicione pelo menos uma refeição');
            return;
        }

        try {
            setSaving(true);
            const roundedCalories = Math.round(planTotals.calories);
            const roundedProtein = Math.round(planTotals.protein);
            const roundedCarbs = Math.round(planTotals.carbs);
            const roundedFat = Math.round(planTotals.fat);
            const normalizedTitle = /^Plano Gerado - \d+\s*kcal$/i.test(dietPlan.title.trim())
                ? `Plano Gerado - ${roundedCalories} kcal`
                : dietPlan.title;

            const response = await fetch(`/api/students/${studentId}/diet-plans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: normalizedTitle,
                    calories: roundedCalories,
                    protein: roundedProtein,
                    carbs: roundedCarbs,
                    fat: roundedFat,
                    meals: meals.map(m => ({
                        name: m.name,
                        time: m.time,
                        notes: m.notes,
                        foods: m.foods.map(f => ({
                            name: f.name,
                            quantity: f.quantity,
                            notes: f.notes,
                            portion: f.portion,
                            calories: f.calories,
                            protein: f.protein,
                            carbs: f.carbs,
                            fat: f.fat,
                        })),
                    })),
                }),
            });

            const result = await response.json();
            if (result.success) {
                alert('Dieta salva com sucesso!');
                router.push(`/personal/students/${studentId}`);
            } else {
                alert(result.error || 'Erro ao salvar dieta');
            }
        } catch (err) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    const maintenanceCalories = getMaintenanceCalories();
    const estimatedTargetCalories = maintenanceCalories ? applyCalorieAdjustment(maintenanceCalories) : null;

    return (
        <div className="space-y-6 animate-in max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href={`/personal/students/${studentId}`}
                    className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">
                        Plano Alimentar
                    </h1>
                    <p className="text-muted-foreground">
                        {student?.user?.name || 'Aluno'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleAutoGenerateClick}
                        loading={generating}
                        className="border-[#F88022] text-[#F88022] hover:bg-[#F88022]/10"
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Gerar Automaticamente
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                        loading={saving}
                    >
                        <Save className="w-5 h-5" />
                        Salvar Dieta
                    </Button>
                </div>
            </div>

            {/* Diet Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Utensils className="w-5 h-5 text-[#F88022]" />
                        Informações do Plano
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        label="Título do Plano *"
                        placeholder="Ex: Dieta Cutting 2000kcal"
                        value={dietPlan.title}
                        onChange={(e) => setDietPlan({ ...dietPlan, title: e.target.value })}
                    />

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            type="number"
                            label="Calorias (kcal)"
                            value={Math.round(planTotals.calories)}
                            readOnly
                        />
                        <Input
                            type="number"
                            label="Proteína (g)"
                            value={Math.round(planTotals.protein)}
                            readOnly
                        />
                        <Input
                            type="number"
                            label="Carboidratos (g)"
                            value={Math.round(planTotals.carbs)}
                            readOnly
                        />
                        <Input
                            type="number"
                            label="Gorduras (g)"
                            value={Math.round(planTotals.fat)}
                            readOnly
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Meals */}
            <div className="space-y-4">
                {meals.map((meal) => {
                    const mealTotals = meal.foods.reduce(
                        (acc, food) => {
                            const totals = getFoodNutritionTotals(food);
                            if (!totals) return acc;
                            acc.calories += totals.calories;
                            acc.protein += totals.protein;
                            acc.carbs += totals.carbs;
                            acc.fat += totals.fat;
                            return acc;
                        },
                        { calories: 0, protein: 0, carbs: 0, fat: 0 }
                    );

                    return (
                    <Card key={meal.id}>
                        <CardHeader
                            className="cursor-pointer"
                            onClick={() => toggleMealExpanded(meal.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#F88022]/10 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-[#F88022]" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">{meal.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">{meal.time}</p>
                                    </div>
                                    <span className="text-sm text-muted-foreground ml-2">
                                        ({meal.foods.length} alimentos)
                                    </span>
                                    {mealTotals.calories > 0 && (
                                        <span className="text-xs text-[#F88022] font-medium">
                                            {Math.round(mealTotals.calories)} kcal
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeMeal(meal.id);
                                        }}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {meal.isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {meal.isExpanded && (
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Nome da Refeição"
                                        placeholder="Ex: Café da Manhã"
                                        value={meal.name}
                                        onChange={(e) => updateMeal(meal.id, 'name', e.target.value)}
                                    />
                                    <Input
                                        type="time"
                                        label="Horário"
                                        value={meal.time}
                                        onChange={(e) => updateMeal(meal.id, 'time', e.target.value)}
                                    />
                                </div>

                                {/* Foods */}
                                <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Alimentos</h4>

                                    {meal.foods.map((food, foodIndex) => (
                                        <div
                                            key={food.id}
                                            className="p-4 bg-muted rounded-xl space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm text-muted-foreground">
                                                    Item {foodIndex + 1}
                                                </span>
                                                <button
                                                    onClick={() => removeFoodFromMeal(meal.id, food.id)}
                                                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="w-full relative">
                                                    <label className="block text-sm font-medium text-foreground mb-2">
                                                        Alimento
                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder="Ex: Arroz branco"
                                                        value={food.name}
                                                        onFocus={() => {
                                                            setActiveFoodFieldKey(getFoodFieldKey(meal.id, food.id));
                                                            setFoodSearchQuery(food.name || '');
                                                        }}
                                                        onBlur={() => {
                                                            setTimeout(() => {
                                                                setFoodSuggestions([]);
                                                                setActiveFoodFieldKey(null);
                                                            }, 150);
                                                        }}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            updateFoodFields(meal.id, food.id, {
                                                                name: value,
                                                                portion: undefined,
                                                                calories: undefined,
                                                                protein: undefined,
                                                                carbs: undefined,
                                                                fat: undefined,
                                                                source: undefined,
                                                            });
                                                            setActiveFoodFieldKey(getFoodFieldKey(meal.id, food.id));
                                                            setFoodSearchQuery(value);
                                                        }}
                                                        className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all duration-200"
                                                    />

                                                    {activeFoodFieldKey === getFoodFieldKey(meal.id, food.id) && (foodSearching || foodSuggestions.length > 0) && (
                                                        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-card shadow-lg max-h-56 overflow-y-auto">
                                                            {foodSearching && (
                                                                <div className="px-3 py-2 text-sm text-muted-foreground">Buscando...</div>
                                                            )}
                                                            {!foodSearching && foodSuggestions.map((suggestion) => (
                                                                <button
                                                                    key={suggestion.id}
                                                                    type="button"
                                                                    onMouseDown={() => handleFoodSearchSelect(meal.id, food.id, suggestion)}
                                                                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border last:border-b-0"
                                                                >
                                                                    <p className="text-sm font-medium text-foreground">{suggestion.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {suggestion.portion || '100g'} • {Math.round(suggestion.calories || 0)} kcal
                                                                    </p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <Input
                                                    label="Quantidade"
                                                    placeholder="Ex: 150g, 2 colheres"
                                                    value={food.quantity}
                                                    onChange={(e) => updateFood(meal.id, food.id, 'quantity', e.target.value)}
                                                    onBlur={(e) => {
                                                        const normalized = normalizeLegacyQuantityText(e.target.value);
                                                        if (normalized !== food.quantity) {
                                                            updateFood(meal.id, food.id, 'quantity', normalized);
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <Input
                                                label="Observações"
                                                placeholder="Ex: Pode substituir por batata doce"
                                                value={food.notes}
                                                onChange={(e) => updateFood(meal.id, food.id, 'notes', e.target.value)}
                                            />

                                            {(() => {
                                                const totals = getFoodNutritionTotals(food);
                                                if (!totals) {
                                                    return (
                                                        <p className="text-xs text-muted-foreground">
                                                            Selecione um alimento da busca e informe a quantidade para calcular os macros.
                                                        </p>
                                                    );
                                                }

                                                return (
                                                    <p className="text-xs text-muted-foreground">
                                                        {Math.round(totals.calories)} kcal | P: {Math.round(totals.protein)}g | C: {Math.round(totals.carbs)}g | G: {Math.round(totals.fat)}g
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => addFoodToMeal(meal.id)}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar Alimento
                                    </Button>
                                </div>

                                <Input
                                    label="Observações da Refeição"
                                    placeholder="Ex: Tomar 30min antes do treino"
                                    value={meal.notes}
                                    onChange={(e) => updateMeal(meal.id, 'notes', e.target.value)}
                                />

                                {mealTotals.calories > 0 && (
                                    <div className="pt-2 border-t border-border">
                                        <p className="text-sm text-muted-foreground">
                                            Total da refeição: {Math.round(mealTotals.calories)} kcal | P: {Math.round(mealTotals.protein)}g | C: {Math.round(mealTotals.carbs)}g | G: {Math.round(mealTotals.fat)}g
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>
                    );
                })}

                <Button
                    variant="outline"
                    className="w-full border-dashed border-2"
                    onClick={addMeal}
                >
                    <Plus className="w-5 h-5" />
                    Adicionar Refeição
                </Button>
            </div>

            <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
                <DialogContent className="max-w-md p-0">
                    <DialogHeader className="p-4 border-b border-border">
                        <DialogTitle>Especificações da Dieta</DialogTitle>
                    </DialogHeader>

                    <div className="p-4 space-y-4">
                        <div className="p-3 rounded-lg bg-muted/40 border border-border">
                            <p className="text-xs text-muted-foreground">Calorias para manutenção do peso</p>
                            <p className="text-base font-semibold text-foreground">
                                {maintenanceCalories ? `${maintenanceCalories} kcal/dia` : 'Dados insuficientes'}
                            </p>
                            {estimatedTargetCalories && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Meta estimada com objetivo/ajuste: {estimatedTargetCalories} kcal/dia
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Objetivo</label>
                            <select
                                value={generateGoal}
                                onChange={(e) => setGenerateGoal(e.target.value as DietGoal)}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground"
                            >
                                <option value="WEIGHT_LOSS">Emagrecimento</option>
                                <option value="MAINTENANCE">Manutenção</option>
                                <option value="MUSCLE_GAIN">Hipertrofia</option>
                            </select>
                        </div>

                        <Input
                            type="number"
                            label="Quantidade de refeições"
                            value={generateMealCount}
                            onChange={(e) => setGenerateMealCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                            min="1"
                            max="6"
                        />

                        <Input
                            type="text"
                            inputMode="numeric"
                            label="Ajuste calórico (kcal)"
                            value={generateCalorieAdjustmentInput}
                            onChange={(e) => {
                                const raw = e.target.value;
                                if (/^-?\d*$/.test(raw)) {
                                    setGenerateCalorieAdjustmentInput(raw);
                                }
                            }}
                            onBlur={() => setGenerateCalorieAdjustmentInput(String(getManualAdjustment()))}
                            placeholder="Ex: -200 ou 150"
                        />
                    </div>

                    <div className="p-4 border-t border-border flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGenerateFromModal}
                            className="bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                        >
                            Gerar Dieta
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showConfirmReplace} onOpenChange={setShowConfirmReplace}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Substituir Dieta Atual?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso irá remover todas as refeições e alimentos que você adicionou manualmente para gerar a nova sugestão. Deseja continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={generateDiet}
                            className="bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                        >
                            Substituir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
