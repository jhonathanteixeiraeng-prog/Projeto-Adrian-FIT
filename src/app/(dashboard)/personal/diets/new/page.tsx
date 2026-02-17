'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    Library,
    Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge } from '@/components/ui';

// Common food items
const foodDatabase = [
    { id: '1', name: 'Frango grelhado', portion: '100g', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    { id: '2', name: 'Arroz branco', portion: '100g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
    { id: '3', name: 'Batata doce', portion: '100g', calories: 86, protein: 1.6, carbs: 20, fat: 0.1 },
    { id: '4', name: 'Brócolis', portion: '100g', calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
    { id: '5', name: 'Ovo inteiro', portion: '1 unidade', calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
    { id: '6', name: 'Aveia', portion: '40g', calories: 150, protein: 5, carbs: 27, fat: 3 },
    { id: '7', name: 'Whey Protein', portion: '1 scoop (30g)', calories: 120, protein: 24, carbs: 3, fat: 1.5 },
    { id: '8', name: 'Banana', portion: '1 unidade', calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    { id: '9', name: 'Azeite de oliva', portion: '1 colher (15ml)', calories: 120, protein: 0, carbs: 0, fat: 14 },
    { id: '10', name: 'Pão integral', portion: '2 fatias', calories: 140, protein: 6, carbs: 24, fat: 2 },
    { id: '11', name: 'Carne bovina magra', portion: '100g', calories: 150, protein: 26, carbs: 0, fat: 5 },
    { id: '12', name: 'Salmão', portion: '100g', calories: 208, protein: 20, carbs: 0, fat: 13 },
    { id: '13', name: 'Queijo cottage', portion: '100g', calories: 98, protein: 11, carbs: 3.4, fat: 4.3 },
    { id: '14', name: 'Iogurte grego', portion: '170g', calories: 100, protein: 17, carbs: 6, fat: 0.7 },
    { id: '15', name: 'Amendoim', portion: '30g', calories: 170, protein: 7, carbs: 5, fat: 14 },
];

interface FoodItem {
    id: string;
    foodId: string;
    name: string;
    portion: string;
    quantity: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

interface Meal {
    id: string;
    name: string;
    time: string;
    items: FoodItem[];
    expanded: boolean;
}

interface Student {
    id: string;
    user: {
        name: string;
    };
}

export default function NewDietPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [showFoodModal, setShowFoodModal] = useState(false);
    const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
    const [foodSearch, setFoodSearch] = useState('');

    // AI Generation State
    const [showAIModal, setShowAIModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiGoal, setAiGoal] = useState('cutting');
    const [aiPreference, setAiPreference] = useState('none');
    const [aiMealCount, setAiMealCount] = useState(4);

    const [aiCalorieReduction, setAiCalorieReduction] = useState(0);

    // Data
    const [students, setStudents] = useState<Student[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [studentId, setStudentId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [meals, setMeals] = useState<Meal[]>([]);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const response = await fetch('/api/students');
            const result = await response.json();
            if (result.success) {
                setStudents(result.data.map((s: any) => ({
                    id: s.id,
                    user: { name: s.user.name }
                })));
            }
        } catch (error) {
            console.error("Failed to fetch students");
        }
    };

    const filteredFoods = foodDatabase.filter(food =>
        food.name.toLowerCase().includes(foodSearch.toLowerCase())
    );

    // Calculate totals
    const totals = meals.reduce((acc, meal) => {
        meal.items.forEach(item => {
            acc.calories += item.calories * item.quantity;
            acc.protein += item.protein * item.quantity;
            acc.carbs += item.carbs * item.quantity;
            acc.fat += item.fat * item.quantity;
        });
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

    const removeMeal = (mealId: string) => {
        setMeals(meals.filter(m => m.id !== mealId));
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

    const addFoodToMeal = (food: typeof foodDatabase[0]) => {
        if (!selectedMealId) return;

        const newItem: FoodItem = {
            id: Date.now().toString(),
            foodId: food.id,
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
        setMeals(meals.map(m =>
            m.id === mealId
                ? {
                    ...m,
                    items: m.items.map(i => i.id === itemId ? { ...i, quantity } : i)
                }
                : m
        ));
    };

    const parsePortion = (portion: string) => {
        const normalized = portion.replace(',', '.').trim();
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
        return item.quantity * baseAmount;
    };

    const updateFoodDisplayAmount = (mealId: string, itemId: string, displayAmount: number, portion: string) => {
        const { baseAmount } = parsePortion(portion);
        const quantity = baseAmount > 0 ? displayAmount / baseAmount : displayAmount;
        updateFoodQuantity(mealId, itemId, quantity);
    };

    // AI Generation Logic (Mock)
    const handleGenerateDiet = async () => {
        setIsGenerating(true);

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generate items based on goal
        const generateItems = (mealType: string): FoodItem[] => {
            const items: FoodItem[] = [];

            // Adjust portions based on goal
            let portionMultiplier = aiGoal === 'bulking' ? 1.3 : (aiGoal === 'cutting' ? 0.75 : 1);

            // Apply calorie reduction factor (simple heuristc: 0.1 reduction per 200kcal)
            if (aiCalorieReduction > 0) {
                const reductionFactor = 1 - (aiCalorieReduction / 2500); // Assuming base ~2500
                portionMultiplier *= Math.max(0.5, reductionFactor); // Floor at 50%
            }

            // Basic selection (simplified logic)
            if (mealType.includes('Café')) {
                const eggs = foodDatabase.find(f => f.name === 'Ovo inteiro')!;
                const oats = foodDatabase.find(f => f.name === 'Aveia')!;
                const fruit = foodDatabase.find(f => f.name === 'Banana')!;

                items.push({
                    id: Date.now().toString() + '1',
                    foodId: eggs.id,
                    name: eggs.name,
                    portion: eggs.portion,
                    quantity: parseFloat((3 * portionMultiplier).toFixed(1)),
                    calories: eggs.calories,
                    protein: eggs.protein,
                    carbs: eggs.carbs,
                    fat: eggs.fat
                });

                items.push({
                    id: Date.now().toString() + '2',
                    foodId: oats.id,
                    name: oats.name,
                    portion: oats.portion,
                    quantity: parseFloat((1.5 * portionMultiplier).toFixed(1)),
                    calories: oats.calories,
                    protein: oats.protein,
                    carbs: oats.carbs,
                    fat: oats.fat
                });

                items.push({
                    id: Date.now().toString() + '3',
                    foodId: fruit.id,
                    name: fruit.name,
                    portion: fruit.portion,
                    quantity: 1,
                    calories: fruit.calories,
                    protein: fruit.protein,
                    carbs: fruit.carbs,
                    fat: fruit.fat
                });
            } else if (mealType.includes('Almoço') || mealType.includes('Jantar')) {
                const meat = foodDatabase.find(f => f.name === 'Frango grelhado')!;
                const rice = foodDatabase.find(f => f.name === 'Arroz branco')!;
                const veg = foodDatabase.find(f => f.name === 'Brócolis')!;
                const oil = foodDatabase.find(f => f.name === 'Azeite de oliva')!;

                items.push({
                    id: Date.now().toString() + '4',
                    foodId: meat.id,
                    name: meat.name,
                    portion: meat.portion,
                    quantity: parseFloat((2 * portionMultiplier).toFixed(1)),
                    calories: meat.calories,
                    protein: meat.protein,
                    carbs: meat.carbs,
                    fat: meat.fat
                });

                items.push({
                    id: Date.now().toString() + '5',
                    foodId: rice.id,
                    name: rice.name,
                    portion: rice.portion,
                    quantity: parseFloat((2 * portionMultiplier).toFixed(1)),
                    calories: rice.calories,
                    protein: rice.protein,
                    carbs: rice.carbs,
                    fat: rice.fat
                });

                items.push({
                    id: Date.now().toString() + '6',
                    foodId: veg.id,
                    name: veg.name,
                    portion: veg.portion,
                    quantity: 1,
                    calories: veg.calories,
                    protein: veg.protein,
                    carbs: veg.carbs,
                    fat: veg.fat
                });

                items.push({
                    id: Date.now().toString() + '7',
                    foodId: oil.id,
                    name: oil.name,
                    portion: oil.portion,
                    quantity: 1,
                    calories: oil.calories,
                    protein: oil.protein,
                    carbs: oil.carbs,
                    fat: oil.fat
                });

            } else {
                const fruit = foodDatabase.find(f => f.name === 'Banana')!;
                const whey = foodDatabase.find(f => f.name === 'Whey Protein')!;
                const nuts = foodDatabase.find(f => f.name === 'Amendoim')!;

                items.push({
                    id: Date.now().toString() + '8',
                    foodId: fruit.id,
                    name: fruit.name,
                    portion: fruit.portion,
                    quantity: 1,
                    calories: fruit.calories,
                    protein: fruit.protein,
                    carbs: fruit.carbs,
                    fat: fruit.fat
                });

                items.push({
                    id: Date.now().toString() + '9',
                    foodId: whey.id,
                    name: whey.name,
                    portion: whey.portion,
                    quantity: 1,
                    calories: whey.calories,
                    protein: whey.protein,
                    carbs: whey.carbs,
                    fat: whey.fat
                });

                items.push({
                    id: Date.now().toString() + '10',
                    foodId: nuts.id,
                    name: nuts.name,
                    portion: nuts.portion,
                    quantity: 1,
                    calories: nuts.calories,
                    protein: nuts.protein,
                    carbs: nuts.carbs,
                    fat: nuts.fat
                });
            }

            return items;
        };

        const mealNames = ['Café da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Pré-treino'];
        const mealTimes = ['07:00', '12:00', '15:30', '19:00', '21:30', '06:00'];

        const newMeals: Meal[] = [];
        for (let i = 0; i < aiMealCount; i++) {
            const name = mealNames[i] || `Refeição ${i + 1}`;
            newMeals.push({
                id: Date.now().toString() + i,
                name: name,
                time: mealTimes[i] || '08:00',
                items: generateItems(name),
                expanded: true
            });
        }

        setMeals(newMeals);
        setIsGenerating(false);
        setShowAIModal(false);
        setTitle(`Dieta ${aiGoal === 'cutting' ? 'Definição' : (aiGoal === 'bulking' ? 'Hipertrofia' : 'Manutenção')} - Gerada por IA`);
    };

    const handleSave = async () => {
        if (!title || !studentId || !startDate || !endDate || meals.length === 0) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        setSaving(true);

        const payload = {
            title,
            studentId,
            startDate,
            endDate,
            meals: meals.map(meal => ({
                name: meal.name,
                time: meal.time,
                items: meal.items
            })),
            saveAsTemplate,
            // Pass macros targets? Using calculated totals for now if needed by API
            targetCalories: Math.round(totals.calories),
            targetProtein: Math.round(totals.protein),
            targetCarbs: Math.round(totals.carbs),
            targetFat: Math.round(totals.fat),
        };

        try {
            const response = await fetch('/api/diet-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok) {
                router.push('/personal/diets');
            } else {
                alert(result.error || 'Erro ao salvar dieta');
            }
        } catch (error) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    const handleCalorieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setAiCalorieReduction(0);
            return;
        }
        const parsed = parseInt(value);
        if (!isNaN(parsed) && parsed >= 0) {
            setAiCalorieReduction(parsed);
        }
    };

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/personal/diets">
                        <Button variant="ghost" size="sm" type="button">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Novo Plano Alimentar</h1>
                        <p className="text-muted-foreground">Configure a dieta do aluno</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAIModal(true)}
                        className="border-[#F88022] text-[#F88022] hover:bg-[#F88022]/10"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Gerar com IA
                    </Button>
                    <Button onClick={handleSave} loading={saving} className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                        <Save className="w-5 h-5 mr-2" />
                        Salvar
                    </Button>
                </div>
            </div>

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
                    <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Título do Plano"
                            placeholder="Ex: Cutting - 2000kcal"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <Select
                            label="Aluno"
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            options={[
                                { value: '', label: 'Selecione o aluno' },
                                ...students.map(s => ({ value: s.id, label: s.user.name }))
                            ]}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            type="date"
                            label="Data de Início"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                        <Input
                            type="date"
                            label="Data de Término"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Save as Template Checkbox */}
                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="checkbox"
                            id="saveAsTemplate"
                            checked={saveAsTemplate}
                            onChange={(e) => setSaveAsTemplate(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-[#F88022] focus:ring-[#F88022]"
                        />
                        <label
                            htmlFor="saveAsTemplate"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2"
                        >
                            <Library className="w-4 h-4 text-muted-foreground" />
                            Salvar como modelo na biblioteca
                        </label>
                    </div>
                </CardContent>
            </Card>

            {/* Meals */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Refeições</h2>
                    <Button variant="outline" onClick={addMeal}>
                        <Plus className="w-5 h-5 mr-2" />
                        Adicionar Refeição
                    </Button>
                </div>

                {meals.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">
                                Nenhuma refeição configurada
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                Adicione as refeições do plano
                            </p>
                            <Button onClick={addMeal}>
                                <Plus className="w-5 h-5 mr-2" />
                                Adicionar Primeira Refeição
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    meals.map((meal) => {
                        const mealTotals = meal.items.reduce((acc, item) => ({
                            calories: acc.calories + (item.calories * item.quantity),
                            protein: acc.protein + (item.protein * item.quantity),
                            carbs: acc.carbs + (item.carbs * item.quantity),
                            fat: acc.fat + (item.fat * item.quantity),
                        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

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
                                                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground"
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
                                                        <p>{Math.round(item.calories * item.quantity)} kcal</p>
                                                        <p>P:{Math.round(item.protein * item.quantity)}g</p>
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
                    })
                )}
            </div>

            {/* AI Generation Modal */}
            {showAIModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-secondary/20">
                        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/5">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#F88022]" />
                                <h3 className="text-lg font-semibold text-foreground">Gerar Dieta Automática</h3>
                            </div>
                            <button onClick={() => setShowAIModal(false)}>
                                <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Objetivo</label>
                                <Select
                                    value={aiGoal}
                                    onChange={(e) => setAiGoal(e.target.value)}
                                    options={[
                                        { value: 'cutting', label: 'Emagrecimento (Cutting)' },
                                        { value: 'bulking', label: 'Hipertrofia (Bulking)' },
                                        { value: 'maintenance', label: 'Manutenção' }
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Preferência Alimentar</label>
                                <Select
                                    value={aiPreference}
                                    onChange={(e) => setAiPreference(e.target.value)}
                                    options={[
                                        { value: 'none', label: 'Nenhuma' },
                                        { value: 'vegan', label: 'Vegano' },
                                        { value: 'vegetarian', label: 'Vegetariano' },
                                        { value: 'lactose-free', label: 'Sem Lactose' },
                                        { value: 'gluten-free', label: 'Sem Glúten' }
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Número de Refeições</label>
                                <Select
                                    value={aiMealCount.toString()}
                                    onChange={(e) => setAiMealCount(parseInt(e.target.value))}
                                    options={[
                                        { value: '3', label: '3 Refeições' },
                                        { value: '4', label: '4 Refeições' },
                                        { value: '5', label: '5 Refeições' },
                                        { value: '6', label: '6 Refeições' }
                                    ]}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">Redução Calórica (kcal)</label>
                                <Input
                                    type="number"
                                    placeholder="Ex: 500"
                                    value={aiCalorieReduction || ''}
                                    onChange={handleCalorieChange}
                                    min="0"
                                    step="50"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Opcional: Reduz a quantidade total de calorias calculada pela IA.
                                </p>
                            </div>

                            <Button
                                onClick={handleGenerateDiet}
                                loading={isGenerating}
                                className="w-full bg-[#F88022] hover:bg-[#F88022]/90 text-white mt-4"
                            >
                                {isGenerating ? (
                                    <>Generating...</>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Gerar Plano
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                                {filteredFoods.map(food => (
                                    <button
                                        key={food.id}
                                        onClick={() => addFoodToMeal(food)}
                                        className="w-full p-3 text-left rounded-xl hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-foreground">{food.name}</p>
                                                <p className="text-sm text-muted-foreground">{food.portion}</p>
                                            </div>
                                            <div className="text-right text-xs text-muted-foreground">
                                                <p className="font-medium text-foreground">{food.calories} kcal</p>
                                                <p>P:{food.protein}g C:{food.carbs}g G:{food.fat}g</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredFoods.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        Nenhum alimento encontrado
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
