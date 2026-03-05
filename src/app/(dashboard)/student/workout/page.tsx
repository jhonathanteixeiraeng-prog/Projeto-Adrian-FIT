'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Play,
    CheckCircle2,
    Clock,
    ChevronRight,
    RotateCcw,
    Trophy,
    ExternalLink
} from 'lucide-react';
import { Card, CardContent, Button, Badge } from '@/components/ui';
import { getEmbedVideoUrl, isDirectVideoFile } from '@/lib/video';
import { normalizePerSetReps, parsePerSetReps } from '@/lib/workout-reps';

interface PersistedWorkoutProgress {
    completedExerciseIds: string[];
    updatedAt: string;
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

function readWorkoutProgress(workoutDayId: string, dateKey: string): Set<string> {
    const storage = getSafeStorage();
    if (!storage) return new Set();

    try {
        const key = getWorkoutProgressStorageKey(workoutDayId, dateKey);
        const raw = storage.getItem(key);
        if (!raw) return new Set();

        const parsed = JSON.parse(raw) as PersistedWorkoutProgress;
        if (!parsed || !Array.isArray(parsed.completedExerciseIds)) return new Set();
        return new Set(parsed.completedExerciseIds);
    } catch (error) {
        console.warn('Falha ao ler progresso do treino salvo localmente:', error);
        return new Set();
    }
}

function writeWorkoutProgress(workoutDayId: string, dateKey: string, completedExerciseIds: string[]) {
    const storage = getSafeStorage();
    if (!storage) return;

    try {
        const key = getWorkoutProgressStorageKey(workoutDayId, dateKey);
        const payload: PersistedWorkoutProgress = {
            completedExerciseIds,
            updatedAt: new Date().toISOString(),
        };
        storage.setItem(key, JSON.stringify(payload));
    } catch (error) {
        console.warn('Falha ao salvar progresso do treino localmente:', error);
    }
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
                        const persistedCompletedIds = readWorkoutProgress(targetDay.id, dateKey);
                        const exercises = Array.isArray(targetDay?.exercises) ? targetDay.exercises : [];
                        setWorkout({
                            id: targetDay.id,
                            name: targetDay.name,
                            exercises: exercises.map((e: any) => ({
                                ...e,
                                completed: persistedCompletedIds.has(e.id)
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

        writeWorkoutProgress(workout.id, dateKey, completedExerciseIds);
    }, [workout, dateKey]);

    useEffect(() => {
        if (!Array.isArray(workout?.exercises)) {
            setCompletedSetsByExercise({});
            return;
        }

        setCompletedSetsByExercise((previous) => {
            const next: Record<string, boolean[]> = {};
            workout.exercises.forEach((exercise: any) => {
                const totalSets = Math.max(0, Number(exercise?.sets) || 0);
                const previousProgress = Array.isArray(previous[exercise.id]) ? previous[exercise.id] : [];
                next[exercise.id] = Array.from({ length: totalSets }, (_, index) => {
                    const previousValue = previousProgress[index];
                    if (typeof previousValue === 'boolean') return previousValue;
                    return Boolean(exercise?.completed);
                });
            });
            return next;
        });
    }, [workout]);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

    const toggleExerciseSet = (exercise: any, setIndex: number) => {
        const totalSets = Math.max(0, Number(exercise?.sets) || 0);
        if (totalSets <= 0) return;

        setCompletedSetsByExercise((previous) => {
            const current = getSetsProgress(exercise, totalSets);
            current[setIndex] = !current[setIndex];
            const allSetsDone = current.length > 0 && current.every(Boolean);

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

    const startRest = (seconds: number) => {
        setRestTimer(seconds);
        const interval = setInterval(() => {
            setRestTimer(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(interval);
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

    if (allCompleted && showCompleted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-in">
                <div className="w-24 h-24 rounded-full bg-secondary/20 flex items-center justify-center mb-6">
                    <Trophy className="w-12 h-12 text-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Parabéns! 🎉</h1>
                <p className="text-muted-foreground text-center mb-8">
                    Você completou o treino de hoje!<br />
                    Continue assim para alcançar seus objetivos.
                </p>
                <Link href="/student/home">
                    <Button variant="secondary" size="lg">
                        Voltar ao Início
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-24">
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
                    className="h-full bg-gradient-to-r from-secondary to-accent rounded-full transition-all duration-500"
                    style={{ width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%` }}
                />
            </div>

            {/* Rest Timer Overlay */}
            {restTimer !== null && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-primary text-white border-primary/60 shadow-2xl">
                        <CardContent className="p-8 text-center">
                            <p className="text-sm opacity-85 mb-3">Tempo de descanso</p>
                            <p className="text-6xl font-bold tracking-tight mb-4">{formatTime(restTimer)}</p>
                            <Button
                                variant="ghost"
                                className="text-white hover:bg-white/10"
                                onClick={() => setRestTimer(null)}
                            >
                                Pular
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Exercises List */}
            <div className="space-y-3">
                {exercises.map((exercise: any, index: number) => {
                    const repsBySet = getRepsBySet(exercise);
                    const setProgress = getSetsProgress(exercise, repsBySet.length);
                    const completedSetsCount = setProgress.filter(Boolean).length;

                    return (
                    <Card
                        key={exercise.id}
                        className={exercise.completed ? 'bg-secondary/10 border-secondary/30' : ''}
                    >
                        <CardContent className="p-4">
                            <div
                                className="flex items-start gap-4 cursor-pointer"
                                onClick={() => setSelectedExercise(
                                    selectedExercise === exercise.id ? null : exercise.id
                                )}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${exercise.completed
                                    ? 'bg-[#F88022] text-white'
                                    : 'bg-muted text-foreground'
                                    }`}>
                                    {exercise.completed ? (
                                        <CheckCircle2 className="w-6 h-6" />
                                    ) : (
                                        <span className="font-bold">{index + 1}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-semibold ${exercise.completed ? 'text-secondary' : 'text-foreground'}`}>
                                        {exercise.name}
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs sm:text-sm">
                                        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Séries</p>
                                            <p className="font-semibold text-foreground">{exercise.sets}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Meta reps</p>
                                            <p className="font-semibold text-foreground">{exercise.reps}</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Descanso</p>
                                            <p className="font-semibold text-foreground flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {exercise.rest}s
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Badge variant="outline" className="text-[11px]">
                                            {completedSetsCount}/{repsBySet.length} séries concluídas
                                        </Badge>
                                    </div>
                                </div>
                                <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${selectedExercise === exercise.id ? 'rotate-90' : ''
                                    }`} />
                            </div>

                            {/* Expanded Details */}
                            {selectedExercise === exercise.id && (
                                <div className="mt-4 pt-4 border-t border-border animate-in">
                                    <div className="mb-4 rounded-xl border border-border overflow-hidden bg-muted/20">
                                        <div className="grid grid-cols-[60px_1fr_64px] bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            <span>Série</span>
                                            <span>Meta de reps</span>
                                            <span className="text-right">OK</span>
                                        </div>
                                        <div className="divide-y divide-border">
                                            {repsBySet.map((targetReps, setIndex) => (
                                                <div
                                                    key={`${exercise.id}-set-${setIndex}`}
                                                    className={`grid grid-cols-[60px_1fr_64px] items-center px-3 py-2 ${setProgress[setIndex] ? 'bg-[#F88022]/10' : ''}`}
                                                >
                                                    <span className="font-semibold text-foreground">{setIndex + 1}</span>
                                                    <span className="text-sm text-foreground">{targetReps}</span>
                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleExerciseSet(exercise, setIndex)}
                                                            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${setProgress[setIndex]
                                                                ? 'border-[#F88022] bg-[#F88022] text-white'
                                                                : 'border-border bg-background text-muted-foreground hover:border-[#F88022]'
                                                                }`}
                                                        >
                                                            {setProgress[setIndex] ? (
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            ) : (
                                                                <span className="text-xs font-bold">{setIndex + 1}</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <p className="mb-4 text-xs text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        Descanso entre séries: {exercise.rest}s
                                    </p>

                                    {/* Video */}
                                    <div className="aspect-video bg-muted rounded-xl mb-4 overflow-hidden border border-border">
                                        {(() => {
                                            const embedVideoUrl = getEmbedVideoUrl(exercise.videoUrl);
                                            const isDirectVideo = isDirectVideoFile(exercise.videoUrl);

                                            if (embedVideoUrl) {
                                                return (
                                                    <iframe
                                                        src={embedVideoUrl}
                                                        title={`Video de ${exercise.name}`}
                                                        className="w-full h-full"
                                                        loading="lazy"
                                                        referrerPolicy="strict-origin-when-cross-origin"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                        allowFullScreen
                                                    />
                                                );
                                            }

                                            if (isDirectVideo && exercise.videoUrl) {
                                                return (
                                                    <video controls className="w-full h-full" preload="metadata">
                                                        <source src={exercise.videoUrl} />
                                                        Seu navegador nao suporta reproducao de video.
                                                    </video>
                                                );
                                            }

                                            if (exercise.videoUrl) {
                                                return (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
                                                        <Play className="w-8 h-8 text-muted-foreground" />
                                                        <p className="text-sm text-muted-foreground">
                                                            Nao foi possivel incorporar este video.
                                                        </p>
                                                        <a
                                                            href={exercise.videoUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 text-sm text-secondary hover:underline"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                            Abrir video
                                                        </a>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                                    <Play className="w-8 h-8 text-muted-foreground/50" />
                                                    <span className="text-sm text-muted-foreground">Sem video</span>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Instructions */}
                                    {(exercise.instructions || exercise.notes) && (
                                        <div className="mb-4 space-y-3">
                                            {exercise.instructions && (
                                                <div>
                                                    <p className="text-sm font-medium text-foreground mb-1">Instruções:</p>
                                                    <p className="text-sm text-muted-foreground">{exercise.instructions}</p>
                                                </div>
                                            )}
                                            {exercise.notes && (
                                                <div className="bg-muted p-3 rounded-lg border border-border">
                                                    <p className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#F88022]" />
                                                        Observações do Personal:
                                                    </p>
                                                    <p className="text-sm text-foreground/80 italic">{exercise.notes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => startRest(exercise.rest)}
                                        >
                                            <Clock className="w-4 h-4" />
                                            Descanso
                                        </Button>
                                        <Button
                                            variant={exercise.completed ? 'outline' : 'secondary'}
                                            className="flex-1"
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
                <div className="fixed bottom-24 inset-x-4">
                    <Button
                        variant="secondary"
                        size="lg"
                        className="w-full shadow-lg"
                        onClick={() => setShowCompleted(true)}
                    >
                        <Trophy className="w-5 h-5" />
                        Finalizar Treino
                    </Button>
                </div>
            )}
        </div>
    );
}
