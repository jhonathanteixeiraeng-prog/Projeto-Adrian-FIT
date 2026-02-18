'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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

export default function StudentHomePage() {
    const { data: session } = useSession();
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
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const { workout, diet, stats } = dashboardData || {};

    // Calculate totals safely
    const completedExercises = workout?.exercises?.filter((e: any) => e.completed)?.length || 0;
    const totalExercises = workout?.exercises?.length || 0;

    const meals = diet?.meals || [];
    const completedMeals = meals.filter((m: any) => m.completed).length;
    const totalMeals = meals.length;
    const totalCalories = meals.reduce((acc: number, m: any) => acc + (m.calories || 0), 0);

    return (
        <div className="space-y-6 animate-in pb-20">
            {/* Header */}
            <div>
                <p className="text-muted-foreground capitalize">{getTodayName()}</p>
                <h1 className="text-2xl font-bold text-foreground mt-1">
                    {getDayGreeting()}, {session?.user?.name?.split(' ')[0]}! 💪
                </h1>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-2">
                        <Flame className="w-5 h-5 text-secondary" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{stats?.streak || 0}</p>
                    <p className="text-xs text-muted-foreground">Dias seguidos</p>
                </Card>
                <Card className="p-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                        <Dumbbell className="w-5 h-5 text-accent" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{stats?.weeklyWorkouts || 0}/{stats?.weeklyGoal || 5}</p>
                    <p className="text-xs text-muted-foreground">Treinos/semana</p>
                </Card>
                <Card className="p-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
                        <Calendar className="w-5 h-5 text-purple-500" />
                    </div>
                    <p className="text-xl font-bold text-foreground">{stats?.nextCheckin || '-'}</p>
                    <p className="text-xs text-muted-foreground">Check-in</p>
                </Card>
            </div>

            {/* Today's Workout */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-[#F88022] flex items-center justify-center">
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
                            <div className="h-2 bg-muted rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-secondary rounded-full transition-all duration-500"
                                    style={{ width: `${totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0}%` }}
                                />
                            </div>

                            {/* Exercise Preview */}
                            <div className="space-y-2 mb-4">
                                {workout.exercises.slice(0, 3).map((exercise: any, index: number) => (
                                    <div
                                        key={exercise.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl ${exercise.completed ? 'bg-secondary/10' : 'bg-muted'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${exercise.completed ? 'bg-[#F88022] text-white' : 'bg-background text-muted-foreground'
                                            }`}>
                                            {exercise.completed ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : (
                                                <span className="text-sm font-medium">{index + 1}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${exercise.completed ? 'text-secondary' : 'text-foreground'}`}>
                                                {exercise.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {exercise.sets}x{exercise.reps} • {exercise.rest}s descanso
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {workout.exercises.length > 3 && (
                                    <p className="text-center text-sm text-muted-foreground">
                                        +{workout.exercises.length - 3} exercícios
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Link href="/student/workout" className="flex-1">
                                    <Button variant="secondary" className="w-full" size="lg">
                                        <Play className="w-5 h-5 mr-2" />
                                        {completedExercises > 0 ? 'Continuar' : 'Iniciar'}
                                    </Button>
                                </Link>
                                <Link href="/student/workout/weekly" className="flex-1">
                                    <Button variant="outline" className="w-full h-full" size="lg">
                                        <Calendar className="w-5 h-5 mr-2" />
                                        Plano Completo
                                    </Button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>Nenhum treino programado para hoje.</p>
                            <p className="text-sm mt-1">Aproveite seu descanso!</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Today's Diet */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
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
                            <div className="h-2 bg-muted rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-accent rounded-full transition-all duration-500"
                                    style={{ width: `${totalMeals > 0 ? (completedMeals / totalMeals) * 100 : 0}%` }}
                                />
                            </div>

                            {/* Meals List */}
                            <div className="space-y-2 mb-4">
                                {meals.map((meal: any) => (
                                    <div
                                        key={meal.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl ${meal.completed ? 'bg-accent/10' : 'bg-muted'
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${meal.completed ? 'bg-accent text-white' : 'bg-background text-muted-foreground'
                                            }`}>
                                            {meal.completed ? (
                                                <CheckCircle2 className="w-5 h-5" />
                                            ) : (
                                                <Clock className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-medium ${meal.completed ? 'text-accent' : 'text-foreground'}`}>
                                                {meal.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {meal.time} • {meal.calories} kcal
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </div>
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
                            <p>Nenhuma dieta ativa encontrada.</p>
                            <p className="text-sm mt-1">Aguarde seu personal criar seu plano.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Check-in Reminder */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-accent/10 border-purple-500/20">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <Target className="w-6 h-6 text-purple-500" />
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-foreground">Check-in Semanal</p>
                        <p className="text-sm text-muted-foreground">
                            Próximo check-in: {stats?.nextCheckin || 'Domingo'}
                        </p>
                    </div>
                    <Link href="/student/checkin">
                        <Button variant="ghost" size="sm">
                            Fazer agora
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
