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
    Play,
    ChevronDown,
    ChevronUp,
    Clock,
    Dumbbell,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge } from '@/components/ui';
import {
    buildRepsFromPerSet,
    normalizePerSetReps,
    parsePerSetReps,
} from '@/lib/workout-reps';

interface Exercise {
    id: string;
    name: string;
    muscleGroup: string;
    videoUrl?: string;
}

interface Student {
    id: string;
    user?: { name: string };
}

interface WorkoutItem {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    sets: number;
    reps: string;
    repsBySet: string[];
    usePerSetReps: boolean;
    rest: number;
    notes: string;
}

interface WorkoutDay {
    id: string;
    name: string;
    dayOfWeek: number;
    items: WorkoutItem[];
    expanded: boolean;
}

const daysOfWeek = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Segunda' },
    { value: 2, label: 'Terça' },
    { value: 3, label: 'Quarta' },
    { value: 4, label: 'Quinta' },
    { value: 5, label: 'Sexta' },
    { value: 6, label: 'Sábado' },
];

export default function NewWorkoutPage() {
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('');

    // Data from API
    const [students, setStudents] = useState<Student[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>([]);

    // Form state
    const [title, setTitle] = useState('');
    const [studentId, setStudentId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>([]);
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);

    // Load students and exercises on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);

                // Load students
                const studentsRes = await fetch('/api/students');
                const studentsData = await studentsRes.json();
                if (studentsData.success) {
                    setStudents(studentsData.data || []);
                }

                // Load exercises - API returns array directly
                const exercisesRes = await fetch('/api/exercises');
                const exercisesData = await exercisesRes.json();
                if (Array.isArray(exercisesData)) {
                    setExercises(exercisesData);
                } else if (exercisesData.data) {
                    setExercises(exercisesData.data);
                }
            } catch (err) {
                console.error('Error loading data:', err);
                setError('Erro ao carregar dados');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const muscleGroups = Array.from(new Set(exercises.map(e => e.muscleGroup)));

    const filteredExercises = exercises.filter(exercise => {
        const matchesSearch = exercise.name.toLowerCase().includes(exerciseSearch.toLowerCase());
        const matchesMuscle = !selectedMuscleGroup || exercise.muscleGroup === selectedMuscleGroup;
        return matchesSearch && matchesMuscle;
    });

    const addWorkoutDay = () => {
        const newDay: WorkoutDay = {
            id: Date.now().toString(),
            name: `Treino ${String.fromCharCode(65 + workoutDays.length)}`,
            dayOfWeek: workoutDays.length < 7 ? workoutDays.length + 1 : 1,
            items: [],
            expanded: true,
        };
        setWorkoutDays([...workoutDays, newDay]);
    };

    const removeWorkoutDay = (dayId: string) => {
        setWorkoutDays(workoutDays.filter(d => d.id !== dayId));
    };

    const toggleDayExpanded = (dayId: string) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId ? { ...d, expanded: !d.expanded } : d
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

    const openExerciseModal = (dayId: string) => {
        setSelectedDayId(dayId);
        setShowExerciseModal(true);
        setExerciseSearch('');
        setSelectedMuscleGroup('');
    };

    const addExerciseToDay = (exercise: Exercise) => {
        if (!selectedDayId) return;

        const newItem: WorkoutItem = {
            id: Date.now().toString(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: 3,
            reps: '10-12',
            repsBySet: ['10-12', '10-12', '10-12'],
            usePerSetReps: false,
            rest: 60,
            notes: '',
        };

        setWorkoutDays(workoutDays.map(d =>
            d.id === selectedDayId
                ? { ...d, items: [...d.items, newItem] }
                : d
        ));
        setShowExerciseModal(false);
    };

    const removeExercise = (dayId: string, itemId: string) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId
                ? { ...d, items: d.items.filter(i => i.id !== itemId) }
                : d
        ));
    };

    const updateExercise = (dayId: string, itemId: string, updates: Partial<WorkoutItem>) => {
        setWorkoutDays(workoutDays.map(d =>
            d.id === dayId
                ? {
                    ...d,
                    items: d.items.map(i => i.id === itemId ? { ...i, ...updates } : i)
                }
                : d
        ));
    };

    const updateExerciseSets = (dayId: string, itemId: string, nextSets: number) => {
        setWorkoutDays((current) =>
            current.map((day) => {
                if (day.id !== dayId) return day;

                return {
                    ...day,
                    items: day.items.map((item) => {
                        if (item.id !== itemId) return item;

                        const normalizedSets = Math.max(0, nextSets || 0);
                        if (!item.usePerSetReps) {
                            return {
                                ...item,
                                sets: normalizedSets,
                                repsBySet: normalizePerSetReps(item.repsBySet, normalizedSets, item.reps || ''),
                            };
                        }

                        const repsBySet = normalizePerSetReps(
                            item.repsBySet,
                            normalizedSets,
                            item.repsBySet[0] || item.reps || ''
                        );
                        return {
                            ...item,
                            sets: normalizedSets,
                            repsBySet,
                            reps: buildRepsFromPerSet(repsBySet),
                        };
                    }),
                };
            })
        );
    };

    const updateExerciseReps = (dayId: string, itemId: string, reps: string) => {
        setWorkoutDays((current) =>
            current.map((day) => {
                if (day.id !== dayId) return day;

                return {
                    ...day,
                    items: day.items.map((item) => {
                        if (item.id !== itemId) return item;

                        return {
                            ...item,
                            reps,
                            repsBySet: normalizePerSetReps(parsePerSetReps(reps), item.sets, reps),
                        };
                    }),
                };
            })
        );
    };

    const togglePerSetReps = (dayId: string, itemId: string, enabled: boolean) => {
        setWorkoutDays((current) =>
            current.map((day) => {
                if (day.id !== dayId) return day;

                return {
                    ...day,
                    items: day.items.map((item) => {
                        if (item.id !== itemId) return item;

                        if (enabled) {
                            const parsed = parsePerSetReps(item.reps);
                            const seed = parsed.length ? parsed : [item.reps || ''];
                            const repsBySet = normalizePerSetReps(seed, item.sets, item.reps || '');
                            return {
                                ...item,
                                usePerSetReps: true,
                                repsBySet,
                                reps: buildRepsFromPerSet(repsBySet),
                            };
                        }

                        const fallback = item.repsBySet.find((rep) => rep.trim()) || item.reps || '';
                        return {
                            ...item,
                            usePerSetReps: false,
                            reps: fallback,
                            repsBySet: normalizePerSetReps([fallback], item.sets, fallback),
                        };
                    }),
                };
            })
        );
    };

    const updatePerSetRep = (dayId: string, itemId: string, setIndex: number, repValue: string) => {
        setWorkoutDays((current) =>
            current.map((day) => {
                if (day.id !== dayId) return day;

                return {
                    ...day,
                    items: day.items.map((item) => {
                        if (item.id !== itemId) return item;

                        const repsBySet = normalizePerSetReps(
                            item.repsBySet,
                            item.sets,
                            item.repsBySet[0] || item.reps || ''
                        );
                        repsBySet[setIndex] = repValue;

                        return {
                            ...item,
                            repsBySet,
                            reps: buildRepsFromPerSet(repsBySet),
                        };
                    }),
                };
            })
        );
    };

    const moveExercise = (dayId: string, itemId: string, direction: 'up' | 'down') => {
        setWorkoutDays(workoutDays.map(d => {
            if (d.id !== dayId) return d;

            const index = d.items.findIndex(i => i.id === itemId);
            if (index === -1) return d;
            if (direction === 'up' && index === 0) return d;
            if (direction === 'down' && index === d.items.length - 1) return d;

            const newItems = [...d.items];
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

            return { ...d, items: newItems };
        }));
    };

    const handleSave = async () => {
        if (!title || !studentId || !startDate || !endDate) {
            setError('Preencha todos os campos obrigatórios');
            return;
        }

        if (workoutDays.length === 0) {
            setError('Adicione pelo menos um dia de treino');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const payload = {
                title,
                studentId,
                startDate,
                endDate,
                active: true,
                saveAsTemplate,
                workoutDays: workoutDays.map((day, dayIndex) => ({
                    name: day.name,
                    dayOfWeek: day.dayOfWeek,
                    items: day.items.map((item, itemIndex) => ({
                        exerciseId: item.exerciseId,
                        sets: item.sets,
                        reps: item.reps,
                        rest: item.rest,
                        notes: item.notes,
                        order: itemIndex,
                    })),
                })),
            };

            const response = await fetch('/api/workout-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao salvar plano');
            }

            router.push('/personal/workouts');
            router.refresh();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar plano de treino');
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
        <>
            <div className="space-y-6 animate-in pb-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/personal/workouts">
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Novo Plano de Treino</h1>
                            <p className="text-muted-foreground">Configure os treinos do aluno</p>
                        </div>
                    </div>
                    <Button onClick={handleSave} loading={saving} className="bg-[#F88022] hover:bg-[#F88022]/90">
                        <Save className="w-5 h-5" />
                        Salvar
                    </Button>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Básicas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Título do Plano"
                                placeholder="Ex: Hipertrofia - Fase 1"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                            <Select
                                label="Aluno"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                options={[
                                    { value: '', label: 'Selecione o aluno' },
                                    ...students.map(s => ({ value: s.id, label: s.user?.name || 'Sem nome' }))
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
                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="saveAsTemplate"
                                checked={saveAsTemplate}
                                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-[#F88022] focus:ring-[#F88022]"
                            />
                            <label htmlFor="saveAsTemplate" className="text-sm font-medium text-foreground cursor-pointer">
                                Salvar como modelo na biblioteca para uso futuro
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Workout Days */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-foreground">Dias de Treino</h2>
                        <Button variant="outline" onClick={addWorkoutDay}>
                            <Plus className="w-5 h-5" />
                            Adicionar Dia
                        </Button>
                    </div>

                    {workoutDays.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Nenhum dia de treino configurado
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    Adicione os dias e exercícios do plano
                                </p>
                                <Button onClick={addWorkoutDay} className="bg-[#F88022] hover:bg-[#F88022]/90">
                                    <Plus className="w-5 h-5" />
                                    Adicionar Primeiro Dia
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        workoutDays.map((day, dayIndex) => (
                            <Card key={day.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            <button
                                                onClick={() => toggleDayExpanded(day.id)}
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {day.expanded ? (
                                                    <ChevronUp className="w-5 h-5" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5" />
                                                )}
                                            </button>
                                            <input
                                                type="text"
                                                value={day.name}
                                                onChange={(e) => updateDayName(day.id, e.target.value)}
                                                className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground"
                                            />
                                            <Badge variant="info">
                                                {day.items.length} exercícios
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select
                                                value={day.dayOfWeek.toString()}
                                                onChange={(e) => updateDayOfWeek(day.id, parseInt(e.target.value))}
                                                options={daysOfWeek.map(d => ({ value: d.value.toString(), label: d.label }))}
                                                className="w-32"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeWorkoutDay(day.id)}
                                                className="text-red-500 hover:text-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                {day.expanded && (
                                    <CardContent className="pt-2">
                                        {/* Exercises List */}
                                        <div className="space-y-2">
                                            {day.items.map((item, itemIndex) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => moveExercise(day.id, item.id, 'up')}
                                                            disabled={itemIndex === 0}
                                                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                        >
                                                            <ChevronUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => moveExercise(day.id, item.id, 'down')}
                                                            disabled={itemIndex === day.items.length - 1}
                                                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                        >
                                                            <ChevronDown className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-foreground">{item.exerciseName}</span>
                                                            <Badge variant="default" className="text-xs">
                                                                {item.muscleGroup}
                                                            </Badge>
                                                        </div>
                                                        <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-background/30 p-2">
                                                            <span className="text-xs font-medium text-muted-foreground">Modo de repetições</span>
                                                            <div className="inline-flex rounded-lg border border-border overflow-hidden">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePerSetReps(day.id, item.id, false)}
                                                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${!item.usePerSetReps
                                                                        ? 'bg-[#F88022] text-white'
                                                                        : 'bg-transparent text-muted-foreground hover:text-foreground'
                                                                        }`}
                                                                >
                                                                    Valor único
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePerSetReps(day.id, item.id, true)}
                                                                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${item.usePerSetReps
                                                                        ? 'bg-[#F88022] text-white'
                                                                        : 'bg-transparent text-muted-foreground hover:text-foreground'
                                                                        }`}
                                                                >
                                                                    Por série
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {item.usePerSetReps ? (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={item.sets}
                                                                            onChange={(e) => updateExerciseSets(day.id, item.id, parseInt(e.target.value, 10) || 0)}
                                                                            className="w-12 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                            min="1"
                                                                        />
                                                                        <span className="text-xs text-muted-foreground">séries</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                                                        <input
                                                                            type="number"
                                                                            value={item.rest}
                                                                            onChange={(e) => updateExercise(day.id, item.id, { rest: parseInt(e.target.value, 10) || 0 })}
                                                                            className="w-14 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                            min="0"
                                                                        />
                                                                        <span className="text-xs text-muted-foreground">s</span>
                                                                    </div>
                                                                </div>
                                                                <div className="rounded-lg border border-border bg-background/40 p-2">
                                                                    <div className="mb-2 flex items-center justify-between">
                                                                        <span className="text-xs text-muted-foreground">Repetições por série</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                        {Array.from({ length: Math.max(0, item.sets || 0) }).map((_, setIndex) => (
                                                                            <div key={`${item.id}-series-${setIndex}`}>
                                                                                <label className="mb-1 block text-[11px] text-muted-foreground">
                                                                                    {setIndex + 1}ª
                                                                                </label>
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.repsBySet[setIndex] || ''}
                                                                                    onChange={(e) => updatePerSetRep(day.id, item.id, setIndex, e.target.value)}
                                                                                    className="w-full rounded-lg border border-border bg-muted px-2 py-1 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                                                                    placeholder="12"
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number"
                                                                        value={item.sets}
                                                                        onChange={(e) => updateExerciseSets(day.id, item.id, parseInt(e.target.value, 10) || 0)}
                                                                        className="w-12 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                        min="1"
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">séries</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="text"
                                                                        value={item.reps}
                                                                        onChange={(e) => updateExerciseReps(day.id, item.id, e.target.value)}
                                                                        className="w-20 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                        placeholder="10-12"
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">reps</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 text-muted-foreground" />
                                                                    <input
                                                                        type="number"
                                                                        value={item.rest}
                                                                        onChange={(e) => updateExercise(day.id, item.id, { rest: parseInt(e.target.value, 10) || 0 })}
                                                                        className="w-14 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                                        min="0"
                                                                    />
                                                                    <span className="text-xs text-muted-foreground">s</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="mt-3">
                                                            <Input
                                                                label="Observações"
                                                                placeholder="Ex: Drop set na última série, cadência 3-0-1..."
                                                                value={item.notes}
                                                                onChange={(e) => updateExercise(day.id, item.id, { notes: e.target.value })}
                                                                className="text-sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeExercise(day.id, item.id)}
                                                        className="text-red-500 hover:text-red-600"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Exercise Button */}
                                        <button
                                            onClick={() => openExerciseModal(day.id)}
                                            className="w-full mt-3 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-[#F88022] hover:border-[#F88022] transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-5 h-5" />
                                            Adicionar Exercício
                                        </button>
                                    </CardContent>
                                )}
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {/* Exercise Selection Modal */}
            {showExerciseModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-foreground">Adicionar Exercício</h3>
                            <button onClick={() => setShowExerciseModal(false)}>
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-4 border-b border-border space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar exercício..."
                                    value={exerciseSearch}
                                    onChange={(e) => setExerciseSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <Button
                                    variant={selectedMuscleGroup === '' ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedMuscleGroup('')}
                                    className={selectedMuscleGroup === '' ? 'bg-[#F88022]' : ''}
                                >
                                    Todos
                                </Button>
                                {muscleGroups.map(group => (
                                    <Button
                                        key={group}
                                        variant={selectedMuscleGroup === group ? 'primary' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedMuscleGroup(group)}
                                        className={selectedMuscleGroup === group ? 'bg-[#F88022]' : ''}
                                    >
                                        {group}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-80">
                            <div className="space-y-2">
                                {filteredExercises.map(exercise => (
                                    <button
                                        key={exercise.id}
                                        onClick={() => addExerciseToDay(exercise)}
                                        className="w-full p-3 text-left rounded-xl hover:bg-muted transition-colors flex items-center justify-between group"
                                    >
                                        <div>
                                            <p className="font-medium text-foreground group-hover:text-[#F88022]">{exercise.name}</p>
                                            <p className="text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                                        </div>
                                        {exercise.videoUrl && (
                                            <Play className="w-4 h-4 text-[#F88022]" />
                                        )}
                                    </button>
                                ))}
                                {filteredExercises.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        {exercises.length === 0
                                            ? 'Nenhum exercício cadastrado. Adicione exercícios na página de Exercícios.'
                                            : 'Nenhum exercício encontrado'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
