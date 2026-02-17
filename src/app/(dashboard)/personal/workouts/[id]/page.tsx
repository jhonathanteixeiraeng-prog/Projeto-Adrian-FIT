'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
    Copy,
    MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, Badge, Avatar } from '@/components/ui';

// Mock existing workout plan
const mockWorkoutPlan = {
    id: '1',
    title: 'Hipertrofia - Iniciante',
    studentId: '1',
    studentName: 'João Silva',
    startDate: '2024-01-15',
    endDate: '2024-03-15',
    active: true,
    version: 1,
    workoutDays: [
        {
            id: '1',
            name: 'Treino A - Peito e Tríceps',
            dayOfWeek: 1,
            expanded: true,
            items: [
                { id: '1', exerciseId: '1', exerciseName: 'Supino Reto', muscleGroup: 'Peito', sets: 4, reps: '8-10', rest: 90, notes: '' },
                { id: '2', exerciseId: '2', exerciseName: 'Supino Inclinado', muscleGroup: 'Peito', sets: 3, reps: '10-12', rest: 60, notes: '' },
                { id: '3', exerciseId: '3', exerciseName: 'Crucifixo', muscleGroup: 'Peito', sets: 3, reps: '12-15', rest: 45, notes: '' },
                { id: '4', exerciseId: '8', exerciseName: 'Tríceps Pulley', muscleGroup: 'Tríceps', sets: 3, reps: '10-12', rest: 60, notes: '' },
                { id: '5', exerciseId: '9', exerciseName: 'Tríceps Francês', muscleGroup: 'Tríceps', sets: 3, reps: '10-12', rest: 60, notes: '' },
            ],
        },
        {
            id: '2',
            name: 'Treino B - Costas e Bíceps',
            dayOfWeek: 3,
            expanded: false,
            items: [
                { id: '6', exerciseId: '15', exerciseName: 'Puxada Frontal', muscleGroup: 'Costas', sets: 4, reps: '8-10', rest: 90, notes: '' },
                { id: '7', exerciseId: '16', exerciseName: 'Remada Curvada', muscleGroup: 'Costas', sets: 3, reps: '10-12', rest: 60, notes: '' },
                { id: '8', exerciseId: '17', exerciseName: 'Remada Baixa', muscleGroup: 'Costas', sets: 3, reps: '10-12', rest: 60, notes: '' },
                { id: '9', exerciseId: '6', exerciseName: 'Rosca Direta', muscleGroup: 'Bíceps', sets: 3, reps: '10-12', rest: 60, notes: '' },
                { id: '10', exerciseId: '7', exerciseName: 'Rosca Martelo', muscleGroup: 'Bíceps', sets: 3, reps: '10-12', rest: 60, notes: '' },
            ],
        },
        {
            id: '3',
            name: 'Treino C - Pernas',
            dayOfWeek: 5,
            expanded: false,
            items: [
                { id: '11', exerciseId: '10', exerciseName: 'Agachamento Livre', muscleGroup: 'Pernas', sets: 4, reps: '8-10', rest: 120, notes: '' },
                { id: '12', exerciseId: '11', exerciseName: 'Leg Press', muscleGroup: 'Pernas', sets: 4, reps: '10-12', rest: 90, notes: '' },
                { id: '13', exerciseId: '12', exerciseName: 'Extensora', muscleGroup: 'Pernas', sets: 3, reps: '12-15', rest: 60, notes: '' },
                { id: '14', exerciseId: '13', exerciseName: 'Flexora', muscleGroup: 'Pernas', sets: 3, reps: '12-15', rest: 60, notes: '' },
                { id: '15', exerciseId: '14', exerciseName: 'Panturrilha', muscleGroup: 'Pernas', sets: 4, reps: '15-20', rest: 45, notes: '' },
            ],
        },
    ],
};

// Mock exercises library
const exerciseLibrary = [
    { id: '1', name: 'Supino Reto', muscleGroup: 'Peito', videoUrl: null },
    { id: '2', name: 'Supino Inclinado', muscleGroup: 'Peito', videoUrl: null },
    { id: '3', name: 'Crucifixo', muscleGroup: 'Peito', videoUrl: null },
    { id: '4', name: 'Desenvolvimento', muscleGroup: 'Ombro', videoUrl: null },
    { id: '5', name: 'Elevação Lateral', muscleGroup: 'Ombro', videoUrl: null },
    { id: '6', name: 'Rosca Direta', muscleGroup: 'Bíceps', videoUrl: null },
    { id: '7', name: 'Rosca Martelo', muscleGroup: 'Bíceps', videoUrl: null },
    { id: '8', name: 'Tríceps Pulley', muscleGroup: 'Tríceps', videoUrl: null },
    { id: '9', name: 'Tríceps Francês', muscleGroup: 'Tríceps', videoUrl: null },
    { id: '10', name: 'Agachamento Livre', muscleGroup: 'Pernas', videoUrl: null },
    { id: '11', name: 'Leg Press', muscleGroup: 'Pernas', videoUrl: null },
    { id: '12', name: 'Extensora', muscleGroup: 'Pernas', videoUrl: null },
    { id: '13', name: 'Flexora', muscleGroup: 'Pernas', videoUrl: null },
    { id: '14', name: 'Panturrilha', muscleGroup: 'Pernas', videoUrl: null },
    { id: '15', name: 'Puxada Frontal', muscleGroup: 'Costas', videoUrl: null },
    { id: '16', name: 'Remada Curvada', muscleGroup: 'Costas', videoUrl: null },
    { id: '17', name: 'Remada Baixa', muscleGroup: 'Costas', videoUrl: null },
    { id: '18', name: 'Abdominais', muscleGroup: 'Core', videoUrl: null },
    { id: '19', name: 'Prancha', muscleGroup: 'Core', videoUrl: null },
];

const mockStudents = [
    { id: '1', name: 'João Silva' },
    { id: '2', name: 'Maria Santos' },
    { id: '3', name: 'Pedro Costa' },
];

interface WorkoutItem {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    sets: number;
    reps: string;
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

export default function EditWorkoutPage() {
    const params = useParams();
    const router = useRouter();
    const [saving, setSaving] = useState(false);
    const [showExerciseModal, setShowExerciseModal] = useState(false);
    const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
    const [exerciseSearch, setExerciseSearch] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('');

    // Load from mock data
    const [title, setTitle] = useState(mockWorkoutPlan.title);
    const [studentId, setStudentId] = useState(mockWorkoutPlan.studentId);
    const [startDate, setStartDate] = useState(mockWorkoutPlan.startDate);
    const [endDate, setEndDate] = useState(mockWorkoutPlan.endDate);
    const [active, setActive] = useState(mockWorkoutPlan.active);
    const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(mockWorkoutPlan.workoutDays);

    const muscleGroups = Array.from(new Set(exerciseLibrary.map(e => e.muscleGroup)));

    const filteredExercises = exerciseLibrary.filter(exercise => {
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

    const duplicateDay = (day: WorkoutDay) => {
        const newDay: WorkoutDay = {
            ...day,
            id: Date.now().toString(),
            name: `${day.name} (Cópia)`,
            items: day.items.map(item => ({ ...item, id: Date.now().toString() + item.id })),
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

    const addExerciseToDay = (exercise: typeof exerciseLibrary[0]) => {
        if (!selectedDayId) return;

        const newItem: WorkoutItem = {
            id: Date.now().toString(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: 3,
            reps: '10-12',
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
        if (!title || !studentId || !startDate || !endDate || workoutDays.length === 0) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        setSaving(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // TODO: Integrate with real API
        console.log({
            id: params.id,
            title,
            studentId,
            startDate,
            endDate,
            active,
            workoutDays,
        });

        router.push('/personal/workouts');
    };

    const totalExercises = workoutDays.reduce((acc, day) => acc + day.items.length, 0);

    return (
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
                        <h1 className="text-2xl font-bold text-foreground">Editar Plano de Treino</h1>
                        <p className="text-muted-foreground">
                            {workoutDays.length} dias • {totalExercises} exercícios
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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
                        <Avatar name={mockWorkoutPlan.studentName} size="lg" />
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{mockWorkoutPlan.studentName}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant={active ? 'success' : 'default'}>
                                    {active ? 'Plano Ativo' : 'Plano Inativo'}
                                </Badge>
                                <span className="text-sm text-muted-foreground">v{mockWorkoutPlan.version}</span>
                            </div>
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
                        placeholder="Ex: Hipertrofia - Fase 1"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
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

                {workoutDays.map((day, dayIndex) => (
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
                                        className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-foreground flex-1"
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
                                        onClick={() => duplicateDay(day)}
                                        title="Duplicar dia"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </Button>
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
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            value={item.sets}
                                                            onChange={(e) => updateExercise(day.id, item.id, { sets: parseInt(e.target.value) || 0 })}
                                                            className="w-12 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                            min="1"
                                                        />
                                                        <span className="text-xs text-muted-foreground">séries</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="text"
                                                            value={item.reps}
                                                            onChange={(e) => updateExercise(day.id, item.id, { reps: e.target.value })}
                                                            className="w-16 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                            placeholder="10-12"
                                                        />
                                                        <span className="text-xs text-muted-foreground">reps</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-muted-foreground" />
                                                        <input
                                                            type="number"
                                                            value={item.rest}
                                                            onChange={(e) => updateExercise(day.id, item.id, { rest: parseInt(e.target.value) || 0 })}
                                                            className="w-14 px-2 py-1 text-sm bg-background border border-border rounded-lg text-center"
                                                            min="0"
                                                        />
                                                        <span className="text-xs text-muted-foreground">s</span>
                                                    </div>
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
                                    className="w-full mt-3 p-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-secondary transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Adicionar Exercício
                                </button>
                            </CardContent>
                        )}
                    </Card>
                ))}
            </div>

            {/* Exercise Selection Modal */}
            {showExerciseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
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
                                >
                                    Todos
                                </Button>
                                {muscleGroups.map(group => (
                                    <Button
                                        key={group}
                                        variant={selectedMuscleGroup === group ? 'primary' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedMuscleGroup(group)}
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
                                        className="w-full p-3 text-left rounded-xl hover:bg-muted transition-colors flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="font-medium text-foreground">{exercise.name}</p>
                                            <p className="text-sm text-muted-foreground">{exercise.muscleGroup}</p>
                                        </div>
                                        {exercise.videoUrl && (
                                            <Play className="w-4 h-4 text-accent" />
                                        )}
                                    </button>
                                ))}
                                {filteredExercises.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        Nenhum exercício encontrado
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
