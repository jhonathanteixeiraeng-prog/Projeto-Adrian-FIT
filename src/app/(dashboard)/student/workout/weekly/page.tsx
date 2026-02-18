'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    ChevronRight,
    Dumbbell,
    Calendar,
    ChevronDown,
    ChevronUp,
    Clock,
    Play
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@/components/ui';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function WeeklyWorkoutPage() {
    const [workoutPlan, setWorkoutPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [expandedDays, setExpandedDays] = useState<string[]>([]);

    useEffect(() => {
        const fetchPlan = async () => {
            try {
                const response = await fetch('/api/student/workout-plan');
                const data = await response.json();
                if (data.success) {
                    setWorkoutPlan(data.data);
                    // Expand all days by default so the student can see the full workout plan.
                    const allDayIds = (data.data?.workoutDays || []).map((d: any) => d.id);
                    setExpandedDays(allDayIds);
                }
            } catch (error) {
                console.error('Erro ao buscar plano:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlan();
    }, []);

    const toggleDay = (dayId: string) => {
        setExpandedDays(prev =>
            prev.includes(dayId)
                ? prev.filter(id => id !== dayId)
                : [...prev, dayId]
        );
    };

    const allDayIds = (workoutPlan?.workoutDays || []).map((day: any) => day.id);
    const allExpanded = allDayIds.length > 0 && expandedDays.length === allDayIds.length;

    const toggleExpandAll = () => {
        if (!workoutPlan?.workoutDays?.length) return;
        setExpandedDays(allExpanded ? [] : allDayIds);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!workoutPlan) {
        return (
            <div className="space-y-6 animate-in">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-bold">Plano Completo</h1>
                </div>
                <Card className="text-center py-12">
                    <CardContent className="space-y-4">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                            <Calendar className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-lg font-medium">Nenhum plano ativo</p>
                            <p className="text-sm text-muted-foreground">Seu personal ainda não enviou seu treino.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-xl font-bold">{workoutPlan.title}</h1>
                    <p className="text-sm text-muted-foreground">Plano Completo de Treino</p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleExpandAll}>
                    {allExpanded ? 'Recolher' : 'Expandir'} todos
                </Button>
            </div>

            {/* Days Schedule */}
            <div className="space-y-4">
                {workoutPlan.workoutDays.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek).map((day: any) => {
                    const isExpanded = expandedDays.includes(day.id);
                    const isToday = new Date().getDay() === day.dayOfWeek;

                    return (
                        <Card key={day.id} className={isToday ? 'border-secondary shadow-md' : ''}>
                            <CardHeader
                                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleDay(day.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isToday ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground'}`}>
                                            <Dumbbell className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold">{day.name}</h3>
                                                {isToday && (
                                                    <Badge variant="info" className="text-[10px] py-0">Hoje</Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{dayNames[day.dayOfWeek]}</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent className="p-4 pt-0 border-t border-border animate-in">
                                    <div className="space-y-3 mt-4">
                                        {day.exercises.map((exercise: any) => (
                                            <div key={exercise.id} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">{exercise.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {exercise.sets}x{exercise.reps} • {exercise.rest}s desc.
                                                    </p>
                                                </div>
                                                {exercise.videoUrl && <Play className="w-4 h-4 text-secondary/60" />}
                                            </div>
                                        ))}
                                    </div>
                                    <Link href={`/student/workout?dayId=${day.id}`} className="block mt-4">
                                        <Button variant={isToday ? 'secondary' : 'outline'} className="w-full">
                                            Ver Detalhes do Treino
                                        </Button>
                                    </Link>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
