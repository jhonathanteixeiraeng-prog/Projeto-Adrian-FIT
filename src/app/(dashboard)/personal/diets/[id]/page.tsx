'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    Search,
    X,
    ChevronDown,
    ChevronUp,
    Clock,
    Utensils,
    Flame,
    Copy,
    Loader2,
    Wand2 // Icon for auto-generate
} from 'lucide-react';
import {
    Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Avatar,
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui';
import { foodDatabase } from '@/lib/food-database';
import { generateDietPlan, type FoodInput } from '@/lib/diet-generator';

interface FoodItem {
    id: string;
    foodId: string;
    name: string; // Ensure this matches API response
    portion: string;
    quantity: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    source?: 'local' | 'external';
}

interface Meal {
    id: string;
    name: string;
    time: string;
    items: FoodItem[];
    expanded: boolean;
    notes?: string;
}

export default function EditDietPage() {
    const params = useParams();
    const router = useRouter();
    const dietPlanId = Array.isArray(params.id) ? params.id[0] : params.id;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [copyingTemplate, setCopyingTemplate] = useState(false);
    const [showFoodModal, setShowFoodModal] = useState(false);
    const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
    const [foodSearch, setFoodSearch] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [foodSearchError, setFoodSearchError] = useState('');
    const [generationFoods, setGenerationFoods] = useState<FoodInput[]>([]);

    // Student data for generation
    const [studentData, setStudentData] = useState<any>(null);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [mealToDelete, setMealToDelete] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [active, setActive] = useState(true);
    const [meals, setMeals] = useState<Meal[]>([]);

    const normalizeText = (value: string) =>
        (value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    const parseLooseNumber = (value: unknown): number | null => {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.replace(',', '.').trim();
        if (!normalized) {
            return null;
        }

        const direct = Number(normalized);
        if (Number.isFinite(direct)) {
            return direct;
        }

        const match = normalized.match(/-?\d+(?:\.\d+)?/);
        if (!match) {
            return null;
        }

        const parsed = Number(match[0]);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const getPortionBaseAmount = (portion: string) => {
        const normalized = (portion || '100g').replace(',', '.').trim();
        const parenthesisMatch = normalized.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
        if (parenthesisMatch) {
            return parseFloat(parenthesisMatch[1]) || 1;
        }

        const match = normalized.match(/^(\d+(?:\.\d+)?)/);
        if (match) {
            return parseFloat(match[1]) || 1;
        }

        return 1;
    };

    const parseQuantityAsFactor = (rawQuantity: unknown, portion: string) => {
        if (typeof rawQuantity === 'number' && Number.isFinite(rawQuantity)) {
            return Math.max(rawQuantity, 0);
        }

        if (typeof rawQuantity !== 'string') {
            return 1;
        }

        const input = rawQuantity.replace(',', '.').trim().toLowerCase();
        if (!input) return 1;

        const base = getPortionBaseAmount(portion);

        // Legacy malformed values: "3 100g" or "1.5 40g"
        const malformedMass = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(g|ml)\b/);
        if (malformedMass) {
            const first = parseFloat(malformedMass[1]);
            const second = parseFloat(malformedMass[2]);
            const amount = first * second;
            return base > 0 ? Math.max(amount / base, 0) : Math.max(amount, 0);
        }

        // Legacy malformed values: "4 1 unidade", "2 2 fatias"
        const malformedUnit = input.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/);
        if (malformedUnit) {
            const first = parseFloat(malformedUnit[1]);
            const second = parseFloat(malformedUnit[2]);
            return Math.max(first * second, 0);
        }

        const amount = parseLooseNumber(input);
        if (amount === null) return 1;

        if (input.includes('x')) return Math.max(amount, 0);

        if (/\b(g|ml)\b/.test(input)) {
            return base > 0 ? Math.max(amount / base, 0) : Math.max(amount, 0);
        }

        if (/\b(unidade|unidades|fatia|fatias|colher|colheres|scoop|copo|copos)\b/.test(input)) {
            return Math.max(amount, 0);
        }

        if (base >= 20) {
            return Math.max(amount / base, 0);
        }

        return Math.max(amount, 0);
    };

    const toNumber = (value: unknown, fallback = 0) => {
        const parsed = parseLooseNumber(value);
        return parsed ?? fallback;
    };

    const normalizeFoodItem = (item: any, index: number): FoodItem => {
        const fallbackFood = foodDatabase.find((f) => normalizeText(f.name) === normalizeText(item?.name || ''));
        const portion = (typeof item?.portion === 'string' && item.portion.trim()) || fallbackFood?.portion || '100g';
        const quantity = parseQuantityAsFactor(
            item?.quantity ?? item?.amount ?? item?.displayAmount ?? item?.multiplier,
            portion
        );

        return {
            id: item?.id || `${Date.now()}-${index}`,
            foodId: item?.foodId || fallbackFood?.id || `manual-${index}`,
            name: item?.name || fallbackFood?.name || 'Alimento',
            portion,
            quantity,
            calories: toNumber(item?.calories ?? item?.kcal, toNumber(fallbackFood?.calories, 0)),
            protein: toNumber(item?.protein ?? item?.proteins, toNumber(fallbackFood?.protein, 0)),
            carbs: toNumber(item?.carbs ?? item?.carbohydrates, toNumber(fallbackFood?.carbs, 0)),
            fat: toNumber(item?.fat ?? item?.fats ?? item?.lipids, toNumber(fallbackFood?.fat, 0)),
            source: item?.source || 'local',
        };
    };

    const parseMealFoods = (foods: unknown) => {
        if (Array.isArray(foods)) {
            return foods;
        }

        if (typeof foods !== 'string') {
            return [];
        }

        try {
            const parsed = JSON.parse(foods);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).foods)) {
                return (parsed as any).foods;
            }
        } catch (error) {
            console.warn('Invalid foods JSON in meal:', error);
        }

        return [];
    };

    const getTotalsFromMeals = (inputMeals: Meal[]) => {
        return inputMeals.reduce((acc, meal) => {
            meal.items.forEach((item) => {
                const quantity = toNumber(item.quantity, 0);
                acc.calories += toNumber(item.calories, 0) * quantity;
                acc.protein += toNumber(item.protein, 0) * quantity;
                acc.carbs += toNumber(item.carbs, 0) * quantity;
                acc.fat += toNumber(item.fat, 0) * quantity;
            });
            return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    };

    const alignMealsToStoredPlanTotals = (inputMeals: Meal[], plan: any) => {
        const computed = getTotalsFromMeals(inputMeals);
        const stored = {
            calories: toNumber(plan?.calories, 0),
            protein: toNumber(plan?.protein, 0),
            carbs: toNumber(plan?.carbs, 0),
            fat: toNumber(plan?.fat, 0),
        };

        if (stored.calories <= 0 || computed.calories <= 0) {
            return inputMeals;
        }

        const calorieDrift = Math.abs(computed.calories - stored.calories) / stored.calories;
        if (calorieDrift <= 0.15) {
            return inputMeals;
        }

        const calorieFactor = stored.calories / computed.calories;
        const proteinFactor = stored.protein > 0 && computed.protein > 0 ? stored.protein / computed.protein : calorieFactor;
        const carbFactor = stored.carbs > 0 && computed.carbs > 0 ? stored.carbs / computed.carbs : calorieFactor;
        const fatFactor = stored.fat > 0 && computed.fat > 0 ? stored.fat / computed.fat : calorieFactor;

        console.warn('Normalizando plano legado para manter consistência com totais salvos', {
            planId: plan?.id,
            stored,
            computed,
        });

        return inputMeals.map((meal) => ({
            ...meal,
            items: meal.items.map((item) => ({
                ...item,
                calories: toNumber(item.calories, 0) * calorieFactor,
                protein: toNumber(item.protein, 0) * proteinFactor,
                carbs: toNumber(item.carbs, 0) * carbFactor,
                fat: toNumber(item.fat, 0) * fatFactor,
            })),
        }));
    };

    useEffect(() => {
        if (params.id) {
            fetchDietPlan();
        }
    }, [params.id]);

    const fetchDietPlan = async () => {
        try {
            setLoading(true);
            const [response, foodsRes] = await Promise.all([
                fetch(`/api/diets/${params.id}`),
                fetch('/api/foods?systemOnly=true&limit=800')
            ]);
            const [result, foodsData] = await Promise.all([
                response.json(),
                foodsRes.json()
            ]);

            if (foodsData.success && Array.isArray(foodsData.data)) {
                setGenerationFoods(
                    foodsData.data.map((food: any) => ({
                        id: String(food.id),
                        name: String(food.name),
                        portion: String(food.portion || '100g'),
                        calories: Number(food.calories || 0),
                        protein: Number(food.protein || 0),
                        carbs: Number(food.carbs || 0),
                        fat: Number(food.fat || 0),
                    }))
                );
            }

            if (result.success && result.data) {
                const plan = result.data;
                setTitle(plan.title);
                setActive(plan.active);
                setStudentData(plan.student);

                // Transform meals and parse foods JSON
                const parsedMeals = plan.meals.map((meal: any) => ({
                    id: meal.id,
                    name: meal.name,
                    time: meal.time,
                    notes: meal.notes,
                    expanded: true,
                    items: parseMealFoods(meal.foods).map((item: any, index: number) => normalizeFoodItem(item, index))
                }));

                setMeals(alignMealsToStoredPlanTotals(parsedMeals, plan));
            } else {
                alert('Erro ao carregar plano alimentar');
                router.push('/personal/diets');
            }
        } catch (error) {
            console.error('Error fetching diet plan:', error);
            alert('Erro ao carregar plano alimentar');
        } finally {
            setLoading(false);
        }
    };

    const handleAutoGenerateClick = () => {
        if (!studentData) {
            alert('Dados do aluno não encontrados para gerar a dieta.');
            return;
        }

        // Basic validation
        const weight = Number(studentData.weight);
        const height = Number(studentData.height);
        let birthDateRaw = studentData.birthDate || studentData.user?.birthDate;

        if (!weight || !height || !birthDateRaw) {
            alert('O aluno precisa ter peso, altura e data de nascimento cadastrados para gerar a dieta.');
            return;
        }

        if (meals.length > 0) {
            setShowConfirmDialog(true);
        } else {
            generateDiet();
        }
    };

    const generateDiet = () => {
        setGenerating(true);
        setShowConfirmDialog(false);

        // Parse metrics again just to be safe/consistent
        const weight = Number(studentData.weight);
        const height = Number(studentData.height);
        let birthDateRaw = studentData.birthDate || studentData.user?.birthDate;

        setTimeout(() => {
            try {
                // Calculate age robustly
                const birthDate = new Date(birthDateRaw);
                let age = 25; // Fallback

                if (!isNaN(birthDate.getTime())) {
                    const today = new Date();
                    age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                } else {
                    console.error('Invalid birth date:', birthDateRaw);
                }

                console.log('Generating diet with:', { weight, height, age });

                const generatedPlan = generateDietPlan({
                    weight,
                    height,
                    age,
                    gender: studentData.gender || 'MALE',
                    activityLevel: studentData.anamnesis?.activityLevel || 'MODERATE',
                    goal: studentData.goal || 'MAINTENANCE',
                    foods: generationFoods,
                });

                console.log('Generated Plan:', generatedPlan);

                if (isNaN(generatedPlan.calories)) {
                    throw new Error('Generated calories is NaN');
                }

                // Update state
                const newMeals: Meal[] = generatedPlan.meals.map((m, index) => ({
                    id: Date.now().toString() + index,
                    name: m.name,
                    time: m.time,
                    expanded: true,
                    items: m.foods.map((f, fIndex) => ({
                        id: Date.now().toString() + index + fIndex,
                        foodId: f.foodId,
                        name: f.name,
                        portion: f.portion,
                        quantity: f.quantity,
                        calories: f.calories,
                        protein: f.protein,
                        carbs: f.carbs,
                        fat: f.fat
                    }))
                }));

                setMeals(newMeals);
                if (!title) setTitle(`Dieta Automática - ${Math.round(generatedPlan.calories)} kcal`);
                alert(`Dieta gerada com sucesso! (${Math.round(generatedPlan.calories)} kcal)`);
            } catch (err) {
                console.error('Error calculating diet:', err);
                alert('Erro ao gerar dieta. Verifique o console para mais detalhes.');
            } finally {
                setGenerating(false);
            }
        }, 500);
    };

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (foodSearch.length >= 2) {
                searchFoods(foodSearch);
            } else {
                setSearchResults([]);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [foodSearch]);

    const searchFoods = async (query: string) => {
        setIsSearching(true);
        setFoodSearchError('');
        try {
            const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();
            if (data.success) {
                setSearchResults(data.data);
                setFoodSearchError('');
            } else {
                setSearchResults([]);
                setFoodSearchError(data.error || 'Erro ao buscar alimentos.');
            }
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
            setFoodSearchError('Erro ao conectar com o servidor de alimentos. Tente novamente.');
        } finally {
            setIsSearching(false);
        }
    };

    // Calculate totals
    const getItemTotals = (item: FoodItem) => {
        const quantity = toNumber(item.quantity, 0);
        return {
            calories: toNumber(item.calories, 0) * quantity,
            protein: toNumber(item.protein, 0) * quantity,
            carbs: toNumber(item.carbs, 0) * quantity,
            fat: toNumber(item.fat, 0) * quantity,
        };
    };

    const calculateMealTotals = (meal: Meal) => meal.items.reduce((acc, item) => {
        const itemTotals = getItemTotals(item);
        acc.calories += itemTotals.calories;
        acc.protein += itemTotals.protein;
        acc.carbs += itemTotals.carbs;
        acc.fat += itemTotals.fat;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const totals = meals.reduce((acc, meal) => {
        const mealTotals = calculateMealTotals(meal);
        acc.calories += mealTotals.calories;
        acc.protein += mealTotals.protein;
        acc.carbs += mealTotals.carbs;
        acc.fat += mealTotals.fat;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

    const addMeal = () => {
        const mealNames = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia'];
        const mealTimes = ['07:00', '10:00', '12:30', '15:30', '19:00', '21:30'];
        const mealIndex = meals.length;

        const newMeal: Meal = {
            id: Date.now().toString(),
            name: mealNames[mealIndex] || `Refeição ${mealIndex + 1}`,
            time: mealTimes[mealIndex] || '12:00',
            items: [],
            expanded: true,
        };
        setMeals([...meals, newMeal]);
    };

    const duplicateMeal = (meal: Meal) => {
        const newMeal: Meal = {
            ...meal,
            id: Date.now().toString(),
            name: `${meal.name} (Cópia)`,
            items: meal.items.map(item => ({ ...item, id: Date.now().toString() + item.id })),
        };
        setMeals([...meals, newMeal]);
    };

    const removeMeal = (mealId: string) => {
        setMealToDelete(mealId);
    };

    const confirmDeleteMeal = () => {
        if (mealToDelete) {
            setMeals(meals.filter(m => m.id !== mealToDelete));
            setMealToDelete(null);
        }
    };

    const toggleMealExpanded = (mealId: string) => {
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, expanded: !m.expanded } : m
        ));
    };

    const updateMeal = (mealId: string, updates: Partial<Meal>) => {
        setMeals(meals.map(m =>
            m.id === mealId ? { ...m, ...updates } : m
        ));
    };

    const openFoodModal = (mealId: string) => {
        setSelectedMealId(mealId);
        setShowFoodModal(true);
        setFoodSearch('');
    };

    const addFoodToMeal = async (food: any) => {
        if (!selectedMealId) return;

        let foodId = food.id;

        // If external, save to DB first
        if (food.source === 'external') {
            try {
                const res = await fetch('/api/foods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: food.name,
                        portion: food.portion,
                        calories: food.calories,
                        protein: food.protein,
                        carbs: food.carbs,
                        fat: food.fat
                    })
                });
                const saved = await res.json();
                if (saved.success) {
                    foodId = saved.data.id;
                }
            } catch (err) {
                console.error('Error saving external food:', err);
                alert('Erro ao salvar alimento externo. Tente novamente.');
                return;
            }
        }

        const newItem: FoodItem = {
            id: Date.now().toString(),
            foodId: foodId, // stored ID
            name: food.name,
            portion: food.portion,
            quantity: 1,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
        };

        setMeals(meals.map(m =>
            m.id === selectedMealId
                ? { ...m, items: [...m.items, newItem] }
                : m
        ));
        setShowFoodModal(false);
    };

    const removeFood = (mealId: string, itemId: string) => {
        setMeals(meals.map(m =>
            m.id === mealId
                ? { ...m, items: m.items.filter(i => i.id !== itemId) }
                : m
        ));
    };

    const updateFoodQuantity = (mealId: string, itemId: string, quantity: number) => {
        const safeQuantity = Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;
        setMeals(meals.map(m =>
            m.id === mealId
                ? {
                    ...m,
                    items: m.items.map(i => i.id === itemId ? { ...i, quantity: safeQuantity } : i)
                }
                : m
        ));
    };

    const parsePortion = (portion: string) => {
        const normalized = String(portion || '100g').replace(',', '.').trim();
        const parenthesisMatch = normalized.match(/\((\d+(?:\.\d+)?)\s*(g|ml)\)/i);
        if (parenthesisMatch) {
            return {
                baseAmount: parseFloat(parenthesisMatch[1]) || 1,
                unit: parenthesisMatch[2].toLowerCase(),
            };
        }

        const match = normalized.match(/^(\d+(?:\.\d+)?)(?:\s*)?(.*)$/);
        if (match) {
            return {
                baseAmount: parseFloat(match[1]) || 1,
                unit: (match[2] || 'un').trim() || 'un',
            };
        }

        return { baseAmount: 1, unit: 'un' };
    };

    const formatAmount = (value: number) => {
        if (!Number.isFinite(value)) return '0';
        return Number.isInteger(value) ? String(value) : value.toFixed(1);
    };

    const getDisplayAmount = (item: FoodItem) => {
        const { baseAmount } = parsePortion(item.portion);
        return toNumber(item.quantity, 0) * toNumber(baseAmount, 1);
    };

    const updateFoodDisplayAmount = (mealId: string, itemId: string, displayAmount: number, portion: string) => {
        const { baseAmount } = parsePortion(portion);
        const safeDisplayAmount = Number.isFinite(displayAmount) ? Math.max(displayAmount, 0) : 0;
        const quantity = baseAmount > 0 ? safeDisplayAmount / baseAmount : safeDisplayAmount;
        updateFoodQuantity(mealId, itemId, quantity);
    };

    const handleSave = async () => {
        if (!title || meals.length === 0) {
            alert('Preencha o título e adicione pelo menos uma refeição');
            return;
        }

        try {
            setSaving(true);
            const response = await fetch(`/api/diets/${params.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    active,
                    calories: totals.calories,
                    protein: totals.protein,
                    carbs: totals.carbs,
                    fat: totals.fat,
                    meals: meals.map(m => ({
                        name: m.name,
                        time: m.time,
                        notes: m.notes,
                        foods: m.items
                    })),
                }),
            });

            const result = await response.json();

            if (result.success) {
                alert('Plano alimentar atualizado com sucesso!');
                router.push('/personal/diets');
            } else {
                alert(result.error || 'Erro ao atualizar plano');
            }
        } catch (error) {
            console.error('Error saving diet:', error);
            alert('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    const handleCopyToLibrary = async () => {
        if (!dietPlanId) {
            alert('Plano de dieta inválido para cópia.');
            return;
        }

        const suggestedTitle = `${(title || 'Plano alimentar').trim()} - Modelo`;
        const typed = window.prompt('Nome do modelo de dieta na biblioteca:', suggestedTitle);
        if (typed === null) return;

        const templateTitle = typed.trim() || suggestedTitle;

        try {
            setCopyingTemplate(true);
            const response = await fetch('/api/diet-templates/from-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: dietPlanId,
                    title: templateTitle,
                }),
            });

            const result = await response.json();
            if (result.success) {
                alert('Dieta copiada para a biblioteca com sucesso!');
            } else {
                alert(result.error || 'Erro ao copiar dieta para a biblioteca');
            }
        } catch (error) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setCopyingTemplate(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/personal/diets">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Editar Plano Alimentar</h1>
                        <p className="text-muted-foreground">{meals.length} refeições</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyToLibrary}
                        loading={copyingTemplate}
                    >
                        <Copy className="w-4 h-4" />
                        Copiar para Biblioteca
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAutoGenerateClick}
                        loading={generating}
                        className="border-[#F88022] text-[#F88022] hover:bg-[#F88022]/10"
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        Gerar Automaticamente
                    </Button>
                    <Button
                        variant={active ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => setActive(!active)}
                    >
                        {active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button onClick={handleSave} loading={saving}>
                        <Save className="w-5 h-5" />
                        Salvar
                    </Button>
                </div>
            </div>

            {/* Student Info */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <Avatar name={studentData?.user?.name || 'Aluno'} size="lg" />
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{studentData?.user?.name || 'Aluno'}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={active ? 'success' : 'default'}>
                                    {active ? 'Plano Ativo' : 'Plano Inativo'}
                                </Badge>
                                {studentData && (
                                    <span className="text-sm text-muted-foreground">
                                        | {studentData.goal || 'Objetivo não definido'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Macros Summary */}
            <Card className="bg-gradient-to-r from-secondary/10 to-accent/10 border-secondary/30">
                <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-foreground">{Math.round(totals.calories)}</p>
                            <p className="text-xs text-muted-foreground">kcal</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-red-500">{Math.round(totals.protein)}g</p>
                            <p className="text-xs text-muted-foreground">Proteína</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-blue-500">{Math.round(totals.carbs)}g</p>
                            <p className="text-xs text-muted-foreground">Carboidratos</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-yellow-500">{Math.round(totals.fat)}g</p>
                            <p className="text-xs text-muted-foreground">Gorduras</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Informações do Plano</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        label="Título do Plano"
                        placeholder="Ex: Cutting - 2000kcal"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </CardContent>
            </Card>

            {/* Meals */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Refeições</h2>
                    <Button variant="outline" onClick={addMeal}>
                        <Plus className="w-5 h-5" />
                        Adicionar Refeição
                    </Button>
                </div>

                {meals.map((meal) => {
                    const mealTotals = calculateMealTotals(meal);

                    return (
                        <Card key={meal.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1">
                                        <button
                                            onClick={() => toggleMealExpanded(meal.id)}
                                            className="text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {meal.expanded ? (
                                                <ChevronUp className="w-5 h-5" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5" />
                                            )}
                                        </button>
                                        <input
                                            type="text"
                                            value={meal.name}
                                            onChange={(e) => updateMeal(meal.id, { name: e.target.value })}
                                            className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground flex-1"
                                        />
                                        <Badge variant="info">
                                            {Math.round(mealTotals.calories)} kcal
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="w-4 h-4" />
                                            <input
                                                type="time"
                                                value={meal.time}
                                                onChange={(e) => updateMeal(meal.id, { time: e.target.value })}
                                                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-20"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => duplicateMeal(meal)}
                                            title="Duplicar refeição"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeMeal(meal.id)}
                                            className="text-red-500 hover:text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            {meal.expanded && (
                                <CardContent className="pt-2">
                                    {/* Food Items */}
                                    <div className="space-y-2">
                                        {meal.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium text-foreground">{item.name}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const { unit } = parsePortion(item.portion);
                                                        return (
                                                            <>
                                                                <input
                                                                    type="number"
                                                                    value={formatAmount(getDisplayAmount(item))}
                                                                    onChange={(e) => updateFoodDisplayAmount(
                                                                        meal.id,
                                                                        item.id,
                                                                        parseFloat(e.target.value) || 0,
                                                                        item.portion
                                                                    )}
                                                                    className="w-20 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                    min="0"
                                                                    step="1"
                                                                />
                                                                <span className="text-xs text-muted-foreground">{unit}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="text-right text-xs text-muted-foreground min-w-[80px]">
                                                    <p>{Math.round(getItemTotals(item).calories)} kcal</p>
                                                    <p>P:{Math.round(getItemTotals(item).protein)}g</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFood(meal.id, item.id)}
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Food Button */}
                                    <button
                                        onClick={() => openFoodModal(meal.id)}
                                        className="w-full mt-3 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-secondary transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus className="w-5 h-5" />
                                        Adicionar Alimento
                                    </button>

                                    {/* Meal Summary */}
                                    {meal.items.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-border">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Total da refeição:</span>
                                                <span>
                                                    {Math.round(mealTotals.calories)}kcal |
                                                    P:{Math.round(mealTotals.protein)}g |
                                                    C:{Math.round(mealTotals.carbs)}g |
                                                    G:{Math.round(mealTotals.fat)}g
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Gerar Nova Dieta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso irá substituir todas as refeições e alimentos atuais. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={generateDiet}>
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Meal Deletion Confirmation Dialog */}
            <AlertDialog open={!!mealToDelete} onOpenChange={(open) => !open && setMealToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Refeição</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja remover esta refeição? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setMealToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteMeal} className="bg-red-600 hover:bg-red-700">
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Food Selection Modal */}
            {showFoodModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Adicionar Alimento</h3>
                            <button onClick={() => setShowFoodModal(false)}>
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-border">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar alimento..."
                                    value={foodSearch}
                                    onChange={(e) => setFoodSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-96">
                            <div className="space-y-2">
                                <div className="space-y-2">
                                    {isSearching ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <>
                                            {foodSearchError && (
                                                <p className="text-center text-red-400 py-2 text-sm">
                                                    {foodSearchError}
                                                </p>
                                            )}
                                            {searchResults.map(food => (
                                                <button
                                                    key={food.id}
                                                    onClick={() => addFoodToMeal(food)}
                                                    className="w-full p-3 text-left rounded-xl hover:bg-muted transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-foreground">{food.name}</p>
                                                                {food.source === 'external' && (
                                                                    <Badge variant="outline" className="text-[10px] h-4 px-1">Web</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground">{food.portion}</p>
                                                        </div>
                                                        <div className="text-right text-xs text-muted-foreground">
                                                            <p className="font-medium text-foreground">{food.calories} kcal</p>
                                                            <p>P:{food.protein}g C:{food.carbs}g G:{food.fat}g</p>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                            {searchResults.length === 0 && foodSearch.length >= 2 && (
                                                <p className="text-center text-muted-foreground py-8">
                                                    Nenhum alimento encontrado. Verifique a ortografia ou use um termo mais específico.
                                                </p>
                                            )}
                                            {searchResults.length === 0 && foodSearch.length < 2 && (
                                                <p className="text-center text-muted-foreground py-8">
                                                    Digite pelo menos 2 caracteres para buscar
                                                </p>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
