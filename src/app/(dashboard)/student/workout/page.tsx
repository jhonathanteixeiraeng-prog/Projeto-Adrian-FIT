'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Play,
    Check,
    CheckCircle2,
    Clock,
    RotateCcw,
    Trophy,
    MoreVertical,
    Dumbbell
} from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { normalizePerSetReps, parsePerSetReps } from '@/lib/workout-reps';

interface PersistedWorkoutProgress {
    completedExerciseIds: string[];
    completedSetsByExercise?: Record<string, boolean[]>;
    setLogsByExercise?: Record<string, ExerciseSetLog>;
    updatedAt: string;
}

interface ExerciseSetLog {
    loadKg: string[];
    completedReps: string[];
}

function getLocalDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWorkoutProgressStorageKey(workoutDayId: string, dateKey: string) {
    return `student-workout-progress:${workoutDayId}:${dateKey}`;
}

function getSafeStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function readWorkoutProgress(workoutDayId: string, dateKey: string): PersistedWorkoutProgress {
    const storage = getSafeStorage();
    if (!storage) {
        return {
            completedExerciseIds: [],
            completedSetsByExercise: {},
            setLogsByExercise: {},
            updatedAt: '',
        };
    }

    try {
        const key = getWorkoutProgressStorageKey(workoutDayId, dateKey);
        const raw = storage.getItem(key);
        if (!raw) {
            return {
                completedExerciseIds: [],
                completedSetsByExercise: {},
                setLogsByExercise: {},
                updatedAt: '',
            };
        }

        const parsed = JSON.parse(raw) as PersistedWorkoutProgress;
        if (!parsed || !Array.isArray(parsed.completedExerciseIds)) {
            return {
                completedExerciseIds: [],
                completedSetsByExercise: {},
                setLogsByExercise: {},
                updatedAt: '',
            };
        }

        return {
            completedExerciseIds: parsed.completedExerciseIds,
            completedSetsByExercise: parsed.completedSetsByExercise || {},
            setLogsByExercise: parsed.setLogsByExercise || {},
            updatedAt: parsed.updatedAt || '',
        };
    } catch (error) {
        console.warn('Falha ao ler progresso do treino salvo localmente:', error);
        return {
            completedExerciseIds: [],
            completedSetsByExercise: {},
            setLogsByExercise: {},
            updatedAt: '',
        };
    }
}

function writeWorkoutProgress(workoutDayId: string, dateKey: string, payload: PersistedWorkoutProgress) {
    const storage = getSafeStorage();
    if (!storage) return;

    try {
        const key = getWorkoutProgressStorageKey(workoutDayId, dateKey);
        storage.setItem(key, JSON.stringify(payload));
    } catch (error) {
        console.warn('Falha ao salvar progresso do treino localmente:', error);
    }
}

function normalizeSetLog(log: ExerciseSetLog | undefined, totalSets: number): ExerciseSetLog {
    return {
        loadKg: Array.from({ length: totalSets }, (_, index) => log?.loadKg?.[index] ?? ''),
        completedReps: Array.from({ length: totalSets }, (_, index) => log?.completedReps?.[index] ?? ''),
    };
}

// Mock data
const mockWorkout = {
    id: '1',
    name: 'Treino A - Peito e Tríceps',
    exercises: [
        {
            id: '1',
            name: 'Supino Reto',
            sets: 4,
            reps: '10-12',
            rest: 90,
            completed: false,
            videoUrl: 'https://example.com/video1',
            instructions: 'Deite no banco, mantenha os pés no chão. Desça a barra até o peito e empurre de volta.'
        },
        {
            id: '2',
            name: 'Supino Inclinado com Halteres',
            sets: 3,
            reps: '10-12',
            rest: 90,
            completed: false,
            videoUrl: 'https://example.com/video2',
            instructions: 'Banco inclinado a 30-45°. Desça os halteres alinhados com o peito.'
        },
        {
            id: '3',
            name: 'Crucifixo na Máquina',
            sets: 3,
            reps: '12-15',
            rest: 60,
            completed: false,
            videoUrl: 'https://example.com/video3',
            instructions: 'Contraia o peitoral ao trazer os braços para frente.'
        },
        {
            id: '4',
            name: 'Tríceps Pulley',
            sets: 3,
            reps: '12-15',
            rest: 60,
            completed: false,
            videoUrl: 'https://example.com/video4',
            instructions: 'Cotovelos fixos ao lado do corpo. Extensão completa do tríceps.'
        },
        {
            id: '5',
            name: 'Tríceps Francês',
            sets: 3,
            reps: '10-12',
            rest: 60,
            completed: false,
            videoUrl: 'https://example.com/video5',
            instructions: 'Mantenha os cotovelos apontando para cima. Desça o peso atrás da cabeça.'
        },
    ],
};

export default function WorkoutPage() {
    const searchParams = useSearchParams();
    const dayId = searchParams.get('dayId');
    const dateKey = getLocalDateKey();

    const [workout, setWorkout] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [restTimer, setRestTimer] = useState<number | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [completedSetsByExercise, setCompletedSetsByExercise] = useState<Record<string, boolean[]>>({});
    const [setLogsByExercise, setSetLogsByExercise] = useState<Record<string, ExerciseSetLog>>({});
    const [exerciseNotesById, setExerciseNotesById] = useState<Record<string, string>>({});
    const [extraSetsByExercise, setExtraSetsByExercise] = useState<Record<string, number>>({});
    const [hydratedProgress, setHydratedProgress] = useState<PersistedWorkoutProgress | null>(null);
    const restIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const fetchWorkout = async () => {
            try {
                const response = await fetch('/api/student/workout-plan');
                const data = await response.json();
                if (data.success && data.data) {
                    const plan = data.data;
                    const workoutDays = Array.isArray(plan?.workoutDays) ? plan.workoutDays : [];
                    let targetDay;

                    if (dayId) {
                        targetDay = workoutDays.find((d: any) => d?.id === dayId);
                    } else {
                        // Default to today
                        const today = new Date().getDay();
                        targetDay = workoutDays.find((d: any) => d?.dayOfWeek === today) || workoutDays[0];
                    }

                    if (targetDay) {
                        const persistedProgress = readWorkoutProgress(targetDay.id, dateKey);
                        const exercises = Array.isArray(targetDay?.exercises) ? targetDay.exercises : [];
                        setHydratedProgress(persistedProgress);
                        setWorkout({
                            id: targetDay.id,
                            name: targetDay.name,
                            exercises: exercises.map((e: any) => ({
                                ...e,
                                completed: persistedProgress.completedExerciseIds.includes(e.id)
                            }))
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar treino:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchWorkout();
    }, [dayId, dateKey]);

    useEffect(() => {
        if (!workout?.id || !Array.isArray(workout.exercises)) return;

        const completedExerciseIds = workout.exercises
            .filter((exercise: any) => exercise.completed)
            .map((exercise: any) => exercise.id);

        writeWorkoutProgress(workout.id, dateKey, {
            completedExerciseIds,
            completedSetsByExercise,
            setLogsByExercise,
            updatedAt: new Date().toISOString(),
        });
    }, [workout, dateKey, completedSetsByExercise, setLogsByExercise]);

    useEffect(() => {
        if (!Array.isArray(workout?.exercises)) {
            setCompletedSetsByExercise({});
            return;
        }

        setCompletedSetsByExercise((previous) => {
            const next: Record<string, boolean[]> = {};
            workout.exercises.forEach((exercise: any) => {
                const totalSets = Math.max(0, Number(exercise?.sets) || 0);
                const hydratedProgressForExercise = hydratedProgress?.completedSetsByExercise?.[exercise.id];
                const previousProgress = Array.isArray(previous[exercise.id]) ? previous[exercise.id] : [];
                next[exercise.id] = Array.from({ length: totalSets }, (_, index) => {
                    const hydratedValue = hydratedProgressForExercise?.[index];
                    if (typeof hydratedValue === 'boolean') return hydratedValue;
                    const previousValue = previousProgress[index];
                    if (typeof previousValue === 'boolean') return previousValue;
                    return Boolean(exercise?.completed);
                });
            });
            return next;
        });

        setSetLogsByExercise((previous) => {
            const next: Record<string, ExerciseSetLog> = {};
            workout.exercises.forEach((exercise: any) => {
                const totalSets = Math.max(0, Number(exercise?.sets) || 0);
                const hydratedLog = hydratedProgress?.setLogsByExercise?.[exercise.id];
                const previousLog = previous[exercise.id];
                next[exercise.id] = normalizeSetLog(hydratedLog ?? previousLog, totalSets);
            });
            return next;
        });
    }, [workout, hydratedProgress]);

    useEffect(() => {
        return () => {
            if (restIntervalRef.current) {
                clearInterval(restIntervalRef.current);
                restIntervalRef.current = null;
            }
        };
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 pb-4">
                <div className="flex items-center gap-4">
                    <div className="skeleton-shimmer h-10 w-10 rounded-xl" />
                    <div className="flex-1">
                        <div className="skeleton-shimmer h-6 w-48 mb-2" />
                        <div className="skeleton-shimmer h-4 w-32" />
                    </div>
                </div>
                <div className="skeleton-shimmer h-3 rounded-full" />
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton-shimmer h-[80px] rounded-2xl" />
                ))}
            </div>
        );
    }

    if (!workout) {
        return (
            <div className="space-y-6 animate-in">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-bold">Treino</h1>
                </div>
                <Card className="text-center py-12">
                    <CardContent>
                        <p className="text-muted-foreground">Nenhum treino encontrado para hoje.</p>
                        <Link href="/student/workout/weekly">
                            <Button variant="outline" className="mt-4">Ver Plano Completo</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
    const completedCount = exercises.filter((e: any) => e.completed).length;
    const allCompleted = exercises.length > 0 && completedCount === exercises.length;

    const getRepsBySet = (exercise: any) => {
        const totalSets = Math.max(0, Number(exercise?.sets) || 0);
        const rawReps = typeof exercise?.reps === 'string' ? exercise.reps : '';
        const parsed = parsePerSetReps(rawReps);
        const fallback = parsed[0] || rawReps || '-';

        return normalizePerSetReps(parsed.length ? parsed : [fallback], totalSets, fallback).map((rep) => rep || '-');
    };

    const getSetsProgress = (exercise: any, totalSets: number) => {
        const existing = completedSetsByExercise[exercise.id];
        return Array.from({ length: totalSets }, (_, index) => {
            if (Array.isArray(existing) && typeof existing[index] === 'boolean') {
                return existing[index];
            }
            return Boolean(exercise?.completed);
        });
    };

    const toggleExerciseSet = (exercise: any, setIndex: number, totalSets?: number) => {
        const resolvedTotalSets = totalSets ?? Math.max(0, Number(exercise?.sets) || 0);
        const normalizedTotalSets = Math.max(0, resolvedTotalSets);
        if (normalizedTotalSets <= 0) return;

        setCompletedSetsByExercise((previous) => {
            const current = getSetsProgress(exercise, normalizedTotalSets);
            const wasCompleted = current[setIndex];
            current[setIndex] = !current[setIndex];
            const allSetsDone = current.length > 0 && current.every(Boolean);

            if (!wasCompleted && current[setIndex]) {
                const restSeconds = Math.max(0, Number(exercise?.rest) || 0);
                if (restSeconds > 0) {
                    startRest(restSeconds);
                }
            }

            setWorkout((previousWorkout: any) => ({
                ...previousWorkout,
                exercises: previousWorkout.exercises.map((item: any) =>
                    item.id === exercise.id ? { ...item, completed: allSetsDone } : item
                )
            }));

            return {
                ...previous,
                [exercise.id]: current,
            };
        });
    };

    const toggleExercise = (exerciseId: string) => {
        const targetExercise = exercises.find((exercise: any) => exercise.id === exerciseId);
        const nextCompletedState = !targetExercise?.completed;
        const totalSets = Math.max(0, Number(targetExercise?.sets) || 0);

        setWorkout((prev: any) => ({
            ...prev,
            exercises: prev.exercises.map((e: any) =>
                e.id === exerciseId ? { ...e, completed: nextCompletedState } : e
            )
        }));

        setCompletedSetsByExercise((previous) => ({
            ...previous,
            [exerciseId]: Array.from({ length: totalSets }, () => nextCompletedState)
        }));
    };

    const updateExerciseSetLog = (
        exerciseId: string,
        totalSets: number,
        setIndex: number,
        field: keyof ExerciseSetLog,
        value: string
    ) => {
        setSetLogsByExercise((previous) => {
            const currentLog = normalizeSetLog(previous[exerciseId], totalSets);
            currentLog[field][setIndex] = value;

            return {
                ...previous,
                [exerciseId]: currentLog,
            };
        });
    };

    const addExtraSet = (exerciseId: string) => {
        setExtraSetsByExercise((previous) => ({
            ...previous,
            [exerciseId]: (previous[exerciseId] || 0) + 1,
        }));
    };

    const startRest = (seconds: number) => {
        if (restIntervalRef.current) {
            clearInterval(restIntervalRef.current);
            restIntervalRef.current = null;
        }

        setRestTimer(seconds);
        restIntervalRef.current = setInterval(() => {
            setRestTimer(prev => {
                if (prev === null || prev <= 1) {
                    if (restIntervalRef.current) {
                        clearInterval(restIntervalRef.current);
                        restIntervalRef.current = null;
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatRestLabel = (seconds: number) => {
        const safeSeconds = Math.max(0, Number(seconds) || 0);
        const mins = Math.floor(safeSeconds / 60);
        const secs = safeSeconds % 60;

        if (mins <= 0) return `${secs}s`;
        if (secs === 0) return `${mins}min`;
        return `${mins}min ${secs}s`;
    };

    if (allCompleted && showCompleted) {
        return (
            <div className="min-h-full flex flex-col items-center justify-center p-6 animate-in">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#F88022]/20 to-yellow-500/20 flex items-center justify-center mb-6 shadow-glow-orange">
                    <Trophy className="w-14 h-14 text-[#F88022]" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Parabéns! 🎉</h1>
                <p className="text-muted-foreground text-center mb-2 text-lg">
                    Você completou o treino de hoje!
                </p>
                <p className="text-muted-foreground text-center mb-8 text-sm">
                    Continue assim para alcançar seus objetivos. 💪
                </p>
                <Link href="/student/home">
                    <Button variant="secondary" size="lg" className="bg-gradient-to-r from-[#F88022] to-[#e06b10] text-white border-0 shadow-glow-orange px-8">
                        Voltar ao Início
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in pb-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-foreground">{workout.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {completedCount} de {exercises.length} exercícios
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${(completedCount / exercises.length) * 100 > 0 ? 'progress-animated' : 'bg-muted'}`}
                    style={{ width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%` }}
                />
            </div>

            {/* Rest Timer Overlay */}
            {restTimer !== null && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-sm text-center animate-in">
                        <div className="w-40 h-40 rounded-full border-4 border-[#F88022]/30 flex items-center justify-center mx-auto mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-[#F88022] animate-pulse" style={{ clipPath: `inset(0 0 0 0)` }} />
                            <p className="text-6xl font-bold text-white tracking-tight">{formatTime(restTimer)}</p>
                        </div>
                        <p className="text-white/70 text-sm mb-6 uppercase tracking-widest">Tempo de descanso</p>
                        <Button
                            variant="ghost"
                            className="text-white/80 hover:text-white hover:bg-white/10 px-8 py-3"
                            onClick={() => {
                                if (restIntervalRef.current) {
                                    clearInterval(restIntervalRef.current);
                                    restIntervalRef.current = null;
                                }
                                setRestTimer(null);
                            }}
                        >
                            Pular descanso
                        </Button>
                    </div>
                </div>
            )}

            {/* Exercises List */}
            <div className="space-y-3 stagger-in">
                {exercises.map((exercise: any, index: number) => {
                    const repsBySet = getRepsBySet(exercise);
                    const extraSets = extraSetsByExercise[exercise.id] || 0;
                    const lastTarget = repsBySet[repsBySet.length - 1] || '-';
                    const displayRepsBySet = [
                        ...repsBySet,
                        ...Array.from({ length: extraSets }, () => lastTarget),
                    ];
                    const setProgress = getSetsProgress(exercise, displayRepsBySet.length);
                    const completedSetsCount = setProgress.filter(Boolean).length;
                    const setLogs = normalizeSetLog(setLogsByExercise[exercise.id], displayRepsBySet.length);
                    const rawVideoUrl = typeof exercise.videoUrl === 'string' ? exercise.videoUrl.trim() : '';
                    const hasVideo = Boolean(rawVideoUrl);
                    const noteValue = exerciseNotesById[exercise.id] || '';
                    const thumbnailUrl = typeof exercise.thumbnailUrl === 'string' ? exercise.thumbnailUrl.trim() : '';

                    return (
                        <Card
                            key={exercise.id}
                            className={`touch-bounce border-white/10 bg-[#0B0B0D] transition-all duration-200 ${
                                exercise.completed ? 'ring-1 ring-[#0A84FF]/40' : ''
                            }`}
                        >
                            <CardContent className="p-4 md:p-5">
                                <div
                                    className="flex items-start gap-3 cursor-pointer"
                                    onClick={() => setSelectedExercise(
                                        selectedExercise === exercise.id ? null : exercise.id
                                    )}
                                >
                                    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-[#1C1C1E] flex items-center justify-center flex-shrink-0">
                                        {thumbnailUrl ? (
                                            <img
                                                src={thumbnailUrl}
                                                alt={exercise.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <Dumbbell className="h-5 w-5 text-white/80" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h3 className="truncate text-lg font-bold text-[#0A84FF]">
                                                    {exercise.name}
                                                </h3>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8E8E93]">
                                                    <span>{displayRepsBySet.length} séries</span>
                                                    <span aria-hidden>•</span>
                                                    <span>Meta: {exercise.reps}</span>
                                                    <span aria-hidden>•</span>
                                                    <span>{formatRestLabel(exercise.rest)}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[#8E8E93]">
                                                {exercise.completed && (
                                                    <CheckCircle2 className="h-4 w-4 text-[#0A84FF]" />
                                                )}
                                                <MoreVertical className="h-5 w-5" />
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <Badge
                                                variant="outline"
                                                className="border-[#0A84FF]/30 bg-[#0A84FF]/10 text-[11px] text-white"
                                            >
                                                {completedSetsCount}/{displayRepsBySet.length} séries concluídas
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                {selectedExercise === exercise.id && (
                                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4 animate-in">
                                        {exercise.notes && (
                                            <p className="text-sm leading-relaxed text-white">
                                                {exercise.notes}
                                            </p>
                                        )}

                                        <input
                                            type="text"
                                            value={noteValue}
                                            onChange={(event) =>
                                                setExerciseNotesById((previous) => ({
                                                    ...previous,
                                                    [exercise.id]: event.target.value,
                                                }))
                                            }
                                            placeholder="Adicionar notas aqui..."
                                            className="w-full bg-transparent px-0 py-1 text-sm text-white placeholder:text-[#8E8E93] focus:outline-none"
                                        />

                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 text-sm font-medium text-[#0A84FF]"
                                            onClick={() => startRest(exercise.rest)}
                                        >
                                            <Clock className="h-4 w-4" />
                                            Descanso: {formatRestLabel(exercise.rest)}
                                        </button>

                                        <div
                                            className={`w-full rounded-2xl bg-[#1C1C1E] border border-white/5 ${
                                                hasVideo ? 'cursor-pointer' : ''
                                            }`}
                                        >
                                            {hasVideo ? (
                                                <a
                                                    href={rawVideoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex h-36 w-full flex-col items-center justify-center gap-3 p-4 text-center"
                                                >
                                                    <Play className="h-10 w-10 text-white" />
                                                    <span className="text-sm font-medium text-white">Acessar Vídeo</span>
                                                </a>
                                            ) : (
                                                <div className="flex h-32 w-full flex-col items-center justify-center gap-3 p-4 text-center">
                                                    <Play className="h-10 w-10 text-white/85" />
                                                    <span className="text-sm text-[#8E8E93]">Sem vídeo</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#111113]">
                                            <div className="grid grid-cols-[62px_1fr_88px_88px_52px] gap-2 border-b border-white/5 bg-[#0F0F10] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8E8E93]">
                                                <span>Série</span>
                                                <span>Anterior</span>
                                                <span>Kg</span>
                                                <span>Reps</span>
                                                <span className="text-center">✓</span>
                                            </div>

                                            <div className="divide-y divide-white/5">
                                                {displayRepsBySet.map((targetReps, setIndex) => {
                                                    const previousPerformance =
                                                        setLogs.loadKg[setIndex] && setLogs.completedReps[setIndex]
                                                            ? `${setLogs.loadKg[setIndex]}kg x ${setLogs.completedReps[setIndex]}`
                                                            : '--';

                                                    return (
                                                        <div
                                                            key={`${exercise.id}-set-${setIndex}`}
                                                            className="grid grid-cols-[62px_1fr_88px_88px_52px] items-center gap-2 bg-[#1C1C1E] px-4 py-3"
                                                        >
                                                            <div className="space-y-1">
                                                                <p className="text-lg font-bold text-white">
                                                                    {setIndex + 1}
                                                                </p>
                                                                <p className="text-[11px] text-[#8E8E93]">
                                                                    {targetReps}
                                                                </p>
                                                            </div>

                                                            <span className="text-sm text-[#8E8E93]">
                                                                {previousPerformance}
                                                            </span>

                                                            <input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min="0"
                                                                step="0.5"
                                                                placeholder="kg"
                                                                value={setLogs.loadKg[setIndex]}
                                                                onChange={(event) =>
                                                                    updateExerciseSetLog(
                                                                        exercise.id,
                                                                        displayRepsBySet.length,
                                                                        setIndex,
                                                                        'loadKg',
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className="h-11 w-full rounded-xl border border-white/5 bg-[#0F0F10] px-3 text-center text-sm text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                                                            />

                                                            <input
                                                                type="number"
                                                                inputMode="numeric"
                                                                min="0"
                                                                step="1"
                                                                placeholder="reps"
                                                                value={setLogs.completedReps[setIndex]}
                                                                onChange={(event) =>
                                                                    updateExerciseSetLog(
                                                                        exercise.id,
                                                                        displayRepsBySet.length,
                                                                        setIndex,
                                                                        'completedReps',
                                                                        event.target.value
                                                                    )
                                                                }
                                                                className="h-11 w-full rounded-xl border border-white/5 bg-[#0F0F10] px-3 text-center text-sm text-white placeholder:text-[#8E8E93] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
                                                            />

                                                            <button
                                                                type="button"
                                                                aria-label={`Marcar série ${setIndex + 1} como concluída`}
                                                                onClick={() => toggleExerciseSet(exercise, setIndex, displayRepsBySet.length)}
                                                                className={`mx-auto flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200 ${
                                                                    setProgress[setIndex]
                                                                        ? 'border-[#0A84FF] bg-[#0A84FF] text-white shadow-[0_0_20px_rgba(10,132,255,0.35)]'
                                                                        : 'border-white/5 bg-[#0F0F10] text-transparent'
                                                                }`}
                                                            >
                                                                <Check className="h-5 w-5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => addExtraSet(exercise.id)}
                                            className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#1C1C1E] text-sm font-medium text-white transition-colors hover:bg-[#252528]"
                                        >
                                            + Adicionar Série
                                        </button>

                                        {exercise.instructions && (
                                            <div>
                                                <p className="mb-1 text-sm font-semibold text-white">Instruções:</p>
                                                <p className="text-sm leading-relaxed text-[#8E8E93]">
                                                    {exercise.instructions}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex gap-3 pt-1">
                                            <Button
                                                variant="outline"
                                                className="h-12 flex-1 border-white/10 bg-transparent text-white hover:bg-white/5"
                                                onClick={() => startRest(exercise.rest)}
                                            >
                                                <Clock className="h-4 w-4" />
                                                Descanso
                                            </Button>
                                            <Button
                                                variant={exercise.completed ? 'outline' : 'secondary'}
                                                className={`h-12 flex-1 ${
                                                    exercise.completed
                                                        ? 'border-white/10 bg-transparent text-white hover:bg-white/5'
                                                        : 'border-0 bg-[#0A84FF] text-white hover:bg-[#0073e6]'
                                                }`}
                                                onClick={() => toggleExercise(exercise.id)}
                                            >
                                                {exercise.completed ? (
                                                    <>
                                                        <RotateCcw className="w-4 h-4" />
                                                        Refazer
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Concluir
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Complete Workout Button */}
            {allCompleted && (
                <div className="fixed bottom-24 inset-x-4 z-30">
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full shadow-glow-orange bg-gradient-to-r from-[#F88022] to-[#e06b10] text-white border-0 pulse-glow touch-bounce"
                        onClick={() => setShowCompleted(true)}
                    >
                        <Trophy className="w-5 h-5" />
                        Finalizar Treino 🎉
                    </Button>
                </div>
            )}
        </div>
    );
}
