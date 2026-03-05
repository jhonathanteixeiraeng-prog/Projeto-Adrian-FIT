'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    Dumbbell,
    Utensils,
    ChevronRight,
    CheckCircle2,
    Play,
    Clock,
    Flame,
    Target,
    Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';

function SkeletonHome() {
    return (
        <div className="space-y-6 pb-20">
            {/* Greeting skeleton */}
            <div>
                <div className="skeleton-shimmer h-4 w-40 mb-2" />
                <div className="skeleton-shimmer h-8 w-64" />
            </div>
            {/* Stats skeleton */}
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-shimmer h-[100px] rounded-2xl" />
                ))}
            </div>
            {/* Workout card skeleton */}
            <div className="skeleton-shimmer h-[200px] rounded-2xl" />
            {/* Diet card skeleton */}
            <div className="skeleton-shimmer h-[180px] rounded-2xl" />
        </div>
    );
}

export default function StudentHomePage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [dashboardData, setDashboardData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await fetch('/api/student/dashboard');
                const data = await response.json();
                if (data.success) {
                    setDashboardData(data.data);
                }
            } catch (error) {
                console.error('Erro ao buscar dados:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    const getDayGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    const getTodayName = () => {
        return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    if (loading) {
        return <SkeletonHome />;
    }

    const { workout, diet, stats } = dashboardData || {};

    // Calculate totals safely
    const completedExercises = workout?.exercises?.filter((e: any) => e.completed)?.length || 0;
    const totalExercises = workout?.exercises?.length || 0;
    const workoutProgress = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;

    const meals = diet?.meals || [];
    const completedMeals = meals.filter((m: any) => m.completed).length;
    const totalMeals = meals.length;
    const totalCalories = meals.reduce((acc: number, m: any) => acc + (m.calories || 0), 0);

    return (
        <div className="space-y-6 animate-in pb-20">
            {/* Header */}
            <div>
                <p className="text-muted-foreground capitalize text-sm">{getTodayName()}</p>
                <h1 className="text-2xl font-bold text-foreground mt-1">
                    {getDayGreeting()}, {session?.user?.name?.split(' ')[0]}! 💪
                </h1>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 stagger-in">
                <Card className="p-3 text-center touch-bounce cursor-default">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400/20 to-red-400/10 flex items-center justify-center mx-auto mb-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                    </div>
                    <p className="text-xl font-bold text-foreground number-pop">{stats?.streak || 0}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Dias seguidos</p>
                </Card>
                <Card className="p-3 text-center touch-bounce cursor-default">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400/20 to-green-400/10 flex items-center justify-center mx-auto mb-2">
                        <Dumbbell className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-xl font-bold text-foreground number-pop">{stats?.weeklyWorkouts || 0}/{stats?.weeklyGoal || 5}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Treinos/semana</p>
                </Card>
                <Card className="p-3 text-center touch-bounce cursor-default">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-400/20 to-violet-400/10 flex items-center justify-center mx-auto mb-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-xl font-bold text-foreground number-pop">{stats?.nextCheckin || '-'}</p>
                    <p className="text-[11px] text-muted-foreground font-medium">Check-in</p>
                </Card>
            </div>

            {/* Today's Workout */}
            <Card className="overflow-hidden touch-bounce">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F88022] to-[#e06b10] flex items-center justify-center shadow-glow-orange">
                            <Dumbbell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Treino de Hoje</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {workout ? workout.name : 'Dia de descanso'}
                            </p>
                        </div>
                    </div>
                    {workout && (
                        <Badge variant={completedExercises === totalExercises ? 'success' : 'info'}>
                            {completedExercises}/{totalExercises}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent>
                    {workout ? (
                        <>
                            {/* Progress bar */}
                            <div className="h-2.5 bg-muted rounded-full mb-4 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ease-out ${workoutProgress > 0 ? 'progress-animated' : 'bg-muted'}`}
                                    style={{ width: `${workoutProgress}%` }}
                                />
                            </div>

                            {/* Exercise Preview */}
                            <div className="space-y-2 mb-4 stagger-in">
                                {workout.exercises.slice(0, 3).map((exercise: any, index: number) => (
                                    <div
                                        key={exercise.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${exercise.completed ? 'bg-[#F88022]/10' : 'bg-muted/70'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${exercise.completed ? 'bg-[#F88022] text-white' : 'bg-background text-muted-foreground'
                                            }`}>
                                            {exercise.completed ? (
                                                <CheckCircle2 className="w-5 h-5 check-pop" />
                                            ) : (
                                                <span className="text-sm font-medium">{index + 1}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium text-sm ${exercise.completed ? 'text-[#F88022]' : 'text-foreground'}`}>
                                                {exercise.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {exercise.sets}x{exercise.reps} • {exercise.rest}s descanso
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {workout.exercises.length > 3 && (
                                    <p className="text-center text-sm text-muted-foreground py-1">
                                        +{workout.exercises.length - 3} exercícios
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Link href="/student/workout" className="flex-1">
                                    <Button variant="secondary" className="w-full shadow-glow-orange bg-gradient-to-r from-[#F88022] to-[#e06b10] text-white border-0 hover:opacity-90" size="lg">
                                        <Play className="w-5 h-5 mr-1" />
                                        {completedExercises > 0 ? 'Continuar' : 'Iniciar'}
                                    </Button>
                                </Link>
                                <Link href="/student/workout/weekly" className="flex-1">
                                    <Button variant="outline" className="w-full h-full" size="lg">
                                        <Calendar className="w-5 h-5 mr-1" />
                                        Plano
                                    </Button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                <Dumbbell className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                            <p>Nenhum treino programado para hoje.</p>
                            <p className="text-sm mt-1">Aproveite seu descanso! 😌</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Today's Diet */}
            <Card className="overflow-hidden touch-bounce">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Dieta de Hoje</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {diet ? `${totalCalories} kcal total` : 'Sem plano ativo'}
                            </p>
                        </div>
                    </div>
                    {diet && (
                        <Badge variant={completedMeals === totalMeals ? 'success' : 'info'}>
                            {completedMeals}/{totalMeals}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent>
                    {diet ? (
                        <>
                            {/* Progress bar */}
                            <div className="h-2.5 bg-muted rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0}%` }}
                                />
                            </div>

                            {/* Meals List */}
                            <div className="space-y-2 mb-4 stagger-in">
                                {meals.map((meal: any) => (
                                    <button
                                        type="button"
                                        key={meal.id}
                                        onClick={() => {
                                            const mealId = typeof meal?.id === 'string' && meal.id.trim().length > 0 ? meal.id : null;
                                            if (mealId) {
                                                router.push(`/student/diet?mealId=${encodeURIComponent(mealId)}`);
                                                return;
                                            }
                                            router.push('/student/diet');
                                        }}
                                        className="block w-full text-left touch-bounce"
                                    >
                                        <div
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${meal.completed ? 'bg-emerald-500/10' : 'bg-muted/70'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${meal.completed ? 'bg-emerald-500 text-white' : 'bg-background text-muted-foreground'
                                                }`}>
                                                {meal.completed ? (
                                                    <CheckCircle2 className="w-5 h-5 check-pop" />
                                                ) : (
                                                    <Clock className="w-4 h-4" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-medium text-sm ${meal.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                                                    {meal.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {meal.time} • {meal.calories} kcal
                                                </p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <Link href="/student/diet">
                                <Button variant="accent" className="w-full" size="lg">
                                    <Utensils className="w-5 h-5" />
                                    Ver Cardápio Completo
                                </Button>
                            </Link>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                                <Utensils className="w-8 h-8 text-muted-foreground/50" />
                            </div>
                            <p>Nenhuma dieta ativa encontrada.</p>
                            <p className="text-sm mt-1">Aguarde seu personal criar seu plano.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Check-in Reminder */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-[#F88022]/10 border-purple-500/20 touch-bounce">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-foreground">Check-in Semanal</p>
                        <p className="text-sm text-muted-foreground">
                            Próximo: {stats?.nextCheckin || 'Domingo'}
                        </p>
                    </div>
                    <Link href="/student/checkin">
                        <Button variant="ghost" size="sm" className="text-purple-500 hover:text-purple-600 hover:bg-purple-500/10 font-semibold pulse-glow rounded-xl">
                            Fazer agora
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
