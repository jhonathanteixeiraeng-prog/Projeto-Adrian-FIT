'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Dumbbell,
    Plus,
    Save,
    Trash2,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Loader2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui';

interface Exercise {
    id: string;
    name: string;
    muscleGroup: string;
    equipment?: string;
}

interface WorkoutItem {
    id: string;
    exerciseId: string;
    exerciseName: string;
    sets: number;
    reps: string;
    rest: number;
    notes: string;
}

interface WorkoutDay {
    id: string;
    dayOfWeek: number;
    name: string;
    items: WorkoutItem[];
    isExpanded: boolean;
}

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function StudentWorkoutPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const studentId = params.id as string;
    const initialPlanId = searchParams.get('planId');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [student, setStudent] = useState<any>(null);
    const [workoutPlan, setWorkoutPlan] = useState({
        title: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
    const [planId, setPlanId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch exercises
            const exercisesRes = await fetch('/api/exercises');
            const exercisesData = await exercisesRes.json();
            if (exercisesData.success) {
                setExercises(exercisesData.data || []);
            }

            // Fetch student info
            const studentRes = await fetch(`/api/students/${studentId}`);
            const studentData = await studentRes.json();
            if (studentData.success) {
                setStudent(studentData.data);

                // Check for requested planId or active workout plan
                let targetPlan = null;
                if (initialPlanId) {
                    targetPlan = studentData.data.workoutPlans?.find((p: any) => p.id === initialPlanId);
                }

                if (!targetPlan) {
                    // Fallback to active/latest plan
                    targetPlan = studentData.data.workoutPlans?.[0];
                }

                if (targetPlan) {
                    setPlanId(targetPlan.id);
                    setWorkoutPlan({
                        title: targetPlan.title,
                        startDate: targetPlan.startDate.split('T')[0],
                        endDate: targetPlan.endDate.split('T')[0],
                    });

                    // Map existing days and items
                    const mappedDays = targetPlan.workoutDays.map((day: any) => ({
                        id: day.id,
                        dayOfWeek: day.dayOfWeek,
                        name: day.name,
                        isExpanded: false,
                        items: day.items.map((item: any) => ({
                            id: item.id,
                            exerciseId: item.exerciseId,
                            exerciseName: item.exercise?.name || 'Exercício',
                            sets: item.sets,
                            reps: item.reps,
                            rest: item.rest,
                            notes: item.notes || '',
                        }))
                    }));
                    setWorkoutDays(mappedDays);
                }
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const addWorkoutDay = () => {
        const newDay: WorkoutDay = {
            id: `day-${Date.now()}`,
            dayOfWeek: workoutDays.length % 7,
            name: `Treino ${String.fromCharCode(65 + workoutDays.length)}`,
            items: [],
            isExpanded: true,
        };
        setWorkoutDays([...workoutDays, newDay]);
    };

    const removeWorkoutDay = (dayId: string) => {
        setWorkoutDays(workoutDays.filter(d => d.id !== dayId));
    };

    const toggleDayExpanded = (dayId: string) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, isExpanded: !d.isExpanded } : d
        ));
    };

    const updateDayName = (dayId: string, name: string) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, name } : d
        ));
    };

    const updateDayOfWeek = (dayId: string, dayOfWeek: number) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, dayOfWeek } : d
        ));
    };

    const addExerciseToDay = (dayId: string) => {
        const newItem: WorkoutItem = {
            id: `item-${Date.now()}`,
            exerciseId: '',
            exerciseName: '',
            sets: 3,
            reps: '12',
            rest: 60,
            notes: '',
        };
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, items: [...d.items, newItem] } : d
        ));
    };

    const removeExerciseFromDay = (dayId: string, itemId: string) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, items: d.items.filter(i => i.id !== itemId) } : d
        ));
    };

    const updateExerciseItem = (dayId: string, itemId: string, field: keyof WorkoutItem, value: any) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? {
                ...d,
                items: d.items.map(i => {
                    if (i.id === itemId) {
                        if (field === 'exerciseId') {
                            const exercise = exercises.find(e => e.id === value);
                            return { ...i, exerciseId: value, exerciseName: exercise?.name || '' };
                        }
                        return { ...i, [field]: value };
                    }
                    return i;
                })
            } : d
        ));
    };

    const handleSave = async () => {
        if (!workoutPlan.title) {
            alert('Por favor, preencha o título do treino');
            return;
        }

        if (workoutDays.length === 0) {
            alert('Adicione pelo menos um dia de treino');
            return;
        }

        try {
            setSaving(true);

            const url = planId
                ? `/api/workout-plans/${planId}`
                : `/api/students/${studentId}/workout-plans`;

            const method = planId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: workoutPlan.title,
                    startDate: workoutPlan.startDate,
                    endDate: workoutPlan.endDate,
                    active: true, // Always keep active when saving/updating from here for now
                    workoutDays: workoutDays.map(d => ({
                        dayOfWeek: d.dayOfWeek,
                        name: d.name,
                        items: d.items.map(i => ({
                            exerciseId: i.exerciseId,
                            sets: i.sets,
                            reps: i.reps,
                            rest: i.rest,
                            notes: i.notes,
                        })),
                    })),
                }),
            });

            const result = await response.json();
            if (result.success) {
                alert('Treino salvo com sucesso!');
                router.push(`/personal/students/${studentId}`);
            } else {
                alert(result.error || 'Erro ao salvar treino');
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
                        Plano de Treino
                    </h1>
                    <p className="text-muted-foreground">
                        {student?.user?.name || 'Aluno'}
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    className="bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                    loading={saving}
                >
                    <Save className="w-5 h-5" />
                    Salvar Treino
                </Button>
            </div>

            {/* Workout Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Dumbbell className="w-5 h-5 text-[#F88022]" />
                        Informações do Plano
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        label="Título do Plano *"
                        placeholder="Ex: Treino Hipertrofia - Fevereiro"
                        value={workoutPlan.title}
                        onChange={(e) => setWorkoutPlan({ ...workoutPlan, title: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            type="date"
                            label="Data de Início"
                            value={workoutPlan.startDate}
                            onChange={(e) => setWorkoutPlan({ ...workoutPlan, startDate: e.target.value })}
                        />
                        <Input
                            type="date"
                            label="Data de Término"
                            value={workoutPlan.endDate}
                            onChange={(e) => setWorkoutPlan({ ...workoutPlan, endDate: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Workout Days */}
            <div className="space-y-4">
                {workoutDays.map((day, dayIndex) => (
                    <Card key={day.id}>
                        <CardHeader
                            className="cursor-pointer"
                            onClick={() => toggleDayExpanded(day.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                                    <CardTitle className="text-lg">{day.name}</CardTitle>
                                    <span className="text-sm text-muted-foreground">
                                        ({day.items.length} exercícios)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeWorkoutDay(day.id);
                                        }}
                                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    {day.isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </div>
                            </div>
                        </CardHeader>

                        {day.isExpanded && (
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Nome do Treino"
                                        placeholder="Ex: Treino A - Peito/Tríceps"
                                        value={day.name}
                                        onChange={(e) => updateDayName(day.id, e.target.value)}
                                    />
                                    <Select
                                        label="Dia da Semana"
                                        value={day.dayOfWeek.toString()}
                                        onChange={(e) => updateDayOfWeek(day.id, parseInt(e.target.value))}
                                        options={dayNames.map((name, i) => ({ value: i.toString(), label: name }))}
                                    />
                                </div>

                                {/* Exercises */}
                                <div className="space-y-3">
                                    {day.items.map((item, itemIndex) => (
                                        <div
                                            key={item.id}
                                            className="p-4 bg-muted rounded-xl space-y-3"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm text-muted-foreground">
                                                    Exercício {itemIndex + 1}
                                                </span>
                                                <button
                                                    onClick={() => removeExerciseFromDay(day.id, item.id)}
                                                    className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <Select
                                                label="Exercício"
                                                value={item.exerciseId}
                                                onChange={(e) => updateExerciseItem(day.id, item.id, 'exerciseId', e.target.value)}
                                                options={[
                                                    { value: '', label: 'Selecione um exercício' },
                                                    ...exercises.map(e => ({ value: e.id, label: `${e.name} (${e.muscleGroup})` }))
                                                ]}
                                            />

                                            <div className="grid grid-cols-3 gap-3">
                                                <Input
                                                    type="number"
                                                    label="Séries"
                                                    value={item.sets}
                                                    onChange={(e) => updateExerciseItem(day.id, item.id, 'sets', parseInt(e.target.value) || 0)}
                                                />
                                                <Input
                                                    label="Repetições"
                                                    placeholder="12 ou 10-12"
                                                    value={item.reps}
                                                    onChange={(e) => updateExerciseItem(day.id, item.id, 'reps', e.target.value)}
                                                />
                                                <Input
                                                    type="number"
                                                    label="Descanso (seg)"
                                                    value={item.rest}
                                                    onChange={(e) => updateExerciseItem(day.id, item.id, 'rest', parseInt(e.target.value) || 0)}
                                                />
                                            </div>

                                            <Input
                                                label="Observações"
                                                placeholder="Ex: Fazer até a falha, cadência 3-0-2..."
                                                value={item.notes}
                                                onChange={(e) => updateExerciseItem(day.id, item.id, 'notes', e.target.value)}
                                            />
                                        </div>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => addExerciseToDay(day.id)}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Adicionar Exercício
                                    </Button>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}

                <Button
                    variant="outline"
                    className="w-full border-dashed border-2"
                    onClick={addWorkoutDay}
                >
                    <Plus className="w-5 h-5" />
                    Adicionar Dia de Treino
                </Button>
            </div>
        </div>
    );
}
