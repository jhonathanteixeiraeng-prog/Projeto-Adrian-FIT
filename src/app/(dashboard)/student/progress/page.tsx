'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Scale,
    Dumbbell,
    Utensils,
    Camera,
    Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';

type ProgressTab = 'weight' | 'adherence' | 'photos';

type StudentProfile = {
    goal: string | null;
    weight: number | null;
};

type Checkin = {
    id: string;
    date: string;
    weight: number;
    workoutAdherence: number;
    dietAdherence: number;
};

function parseGoalWeight(goal: string | null | undefined): number | null {
    if (!goal) return null;
    const normalized = goal.replace(',', '.');
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatWeight(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '--';
    return `${value.toFixed(1)}kg`;
}

export default function ProgressPage() {
    const [activeTab, setActiveTab] = useState<ProgressTab>('weight');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [checkins, setCheckins] = useState<Checkin[]>([]);

    useEffect(() => {
        let active = true;

        const loadProgressData = async () => {
            setLoading(true);
            setError(null);

            try {
                const [profileResponse, checkinsResponse] = await Promise.all([
                    fetch('/api/student/profile', { cache: 'no-store' }),
                    fetch('/api/checkins', { cache: 'no-store' }),
                ]);

                const profileResult = await profileResponse.json();
                const checkinsResult = await checkinsResponse.json();

                if (!profileResponse.ok || !profileResult?.success) {
                    throw new Error(profileResult?.error || 'Não foi possível carregar o perfil.');
                }

                if (!checkinsResponse.ok || !checkinsResult?.success) {
                    throw new Error(checkinsResult?.error || 'Não foi possível carregar os check-ins.');
                }

                const normalizedCheckins: Checkin[] = Array.isArray(checkinsResult?.data)
                    ? checkinsResult.data
                        .map((item: any) => ({
                            id: item.id,
                            date: String(item.date),
                            weight: Number(item.weight),
                            workoutAdherence: Number(item.workoutAdherence) || 0,
                            dietAdherence: Number(item.dietAdherence) || 0,
                        }))
                        .filter((item: Checkin) => Number.isFinite(item.weight))
                    : [];

                if (!active) return;

                setProfile({
                    goal: profileResult?.data?.goal ?? null,
                    weight: profileResult?.data?.weight ?? null,
                });
                setCheckins(normalizedCheckins);
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Erro ao carregar evolução.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadProgressData();

        return () => {
            active = false;
        };
    }, []);

    const progressData = useMemo(() => {
        const latestCheckin = checkins[0];
        const oldestCheckin = checkins[checkins.length - 1];

        const currentWeight = latestCheckin?.weight ?? profile?.weight ?? null;
        const startWeight = oldestCheckin?.weight ?? currentWeight;
        const goalWeight = parseGoalWeight(profile?.goal);

        const hasWeightData = currentWeight !== null && startWeight !== null;
        const weightChange = hasWeightData ? currentWeight - startWeight : null;

        let progressToGoal: number | null = null;
        if (hasWeightData && goalWeight !== null && startWeight !== goalWeight) {
            if (startWeight > goalWeight) {
                progressToGoal = ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100;
            } else {
                progressToGoal = ((currentWeight - startWeight) / (goalWeight - startWeight)) * 100;
            }
            progressToGoal = Math.max(0, Math.min(progressToGoal, 100));
        }

        const workoutAvg = checkins.length
            ? Math.round(checkins.reduce((acc, item) => acc + item.workoutAdherence, 0) / checkins.length)
            : 0;
        const dietAvg = checkins.length
            ? Math.round(checkins.reduce((acc, item) => acc + item.dietAdherence, 0) / checkins.length)
            : 0;

        return {
            currentWeight,
            startWeight,
            goalWeight,
            weightChange,
            progressToGoal,
            workoutAvg,
            dietAvg,
        };
    }, [checkins, profile]);

    const chartCheckins = useMemo(() => checkins.slice(0, 8).reverse(), [checkins]);
    const listCheckins = useMemo(() => checkins.slice(0, 4), [checkins]);
    const adherenceCheckins = useMemo(() => checkins.slice(0, 6), [checkins]);

    const maxWeight = chartCheckins.length ? Math.max(...chartCheckins.map(c => c.weight)) : 0;
    const minWeight = chartCheckins.length ? Math.min(...chartCheckins.map(c => c.weight)) : 0;
    const weightRange = maxWeight - minWeight || 1;

    if (loading) {
        return (
            <div className="space-y-6 animate-in pb-8">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Minha Evolução</h1>
                        <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                        Carregando dados reais de evolução...
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 animate-in pb-8">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Minha Evolução</h1>
                        <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
                    </div>
                </div>
                <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-sm text-red-500">{error}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Minha Evolução</h1>
                    <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
                </div>
            </div>

            {/* Current Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                    <Scale className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{formatWeight(progressData.currentWeight)}</p>
                    <p className="text-xs text-muted-foreground">Peso atual</p>
                </Card>
                <Card className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        {(progressData.weightChange ?? 0) <= 0 ? (
                            <TrendingDown className="w-5 h-5 text-secondary" />
                        ) : (
                            <TrendingUp className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <p className={`text-xl font-bold ${(progressData.weightChange ?? 0) <= 0 ? 'text-secondary' : 'text-red-500'}`}>
                        {progressData.weightChange === null
                            ? '--'
                            : `${progressData.weightChange > 0 ? '+' : ''}${progressData.weightChange.toFixed(1)}kg`}
                    </p>
                    <p className="text-xs text-muted-foreground">Variação</p>
                </Card>
                <Card className="p-3 text-center">
                    <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{checkins.length}</p>
                    <p className="text-xs text-muted-foreground">Check-ins</p>
                </Card>
            </div>

            {/* Goal Progress */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Progresso para a meta</span>
                        <Badge variant={progressData.progressToGoal !== null && progressData.progressToGoal >= 100 ? 'success' : 'info'}>
                            {progressData.progressToGoal !== null ? `${progressData.progressToGoal.toFixed(0)}%` : '--'}
                        </Badge>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-gradient-to-r from-secondary to-accent rounded-full transition-all duration-500"
                            style={{ width: `${progressData.progressToGoal ?? 0}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Início: {formatWeight(progressData.startWeight)}</span>
                        <span>Meta: {formatWeight(progressData.goalWeight)}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { id: 'weight', label: 'Peso', icon: Scale },
                    { id: 'adherence', label: 'Adesão', icon: TrendingUp },
                    { id: 'photos', label: 'Fotos', icon: Camera },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ProgressTab)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === tab.id
                            ? 'bg-[#F88022] text-white'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Weight Chart */}
            {activeTab === 'weight' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Peso</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {chartCheckins.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Sem check-ins ainda. Envie seu primeiro check-in para acompanhar a evolução.
                            </div>
                        ) : (
                            <>
                                <div className="h-48 flex items-end justify-between gap-2 mb-4">
                                    {chartCheckins.map((checkin) => {
                                        const height = ((checkin.weight - minWeight) / weightRange) * 100;
                                        return (
                                            <div key={checkin.id} className="flex-1 flex flex-col items-center gap-1">
                                                <span className="text-xs font-medium text-foreground">{checkin.weight.toFixed(1)}</span>
                                                <div
                                                    className="w-full bg-gradient-to-t from-secondary to-accent rounded-t-lg transition-all duration-500"
                                                    style={{ height: `${Math.max(height, 10)}%` }}
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(checkin.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="space-y-2">
                                    {listCheckins.map((checkin, index) => {
                                        const previous = listCheckins[index + 1];
                                        const delta = previous ? checkin.weight - previous.weight : null;
                                        return (
                                            <div key={checkin.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {new Date(checkin.date).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">Check-in semanal</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-foreground">{checkin.weight.toFixed(1)}kg</p>
                                                    {delta !== null && (
                                                        <p className={`text-xs ${delta <= 0 ? 'text-secondary' : 'text-red-500'}`}>
                                                            {delta > 0 ? '+' : ''}
                                                            {delta.toFixed(1)}kg
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Adherence Chart */}
            {activeTab === 'adherence' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Adesão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-secondary/10 rounded-xl text-center">
                                <Dumbbell className="w-6 h-6 text-secondary mx-auto mb-2" />
                                <p className="text-2xl font-bold text-secondary">{progressData.workoutAvg}%</p>
                                <p className="text-sm text-muted-foreground">Média Treino</p>
                            </div>
                            <div className="p-4 bg-accent/10 rounded-xl text-center">
                                <Utensils className="w-6 h-6 text-accent mx-auto mb-2" />
                                <p className="text-2xl font-bold text-accent">{progressData.dietAvg}%</p>
                                <p className="text-sm text-muted-foreground">Média Dieta</p>
                            </div>
                        </div>

                        {adherenceCheckins.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground">
                                Sem dados de adesão ainda.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {adherenceCheckins.map((checkin) => (
                                    <div key={checkin.id} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {new Date(checkin.date).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <Dumbbell className="w-4 h-4 text-secondary" />
                                                <span className={`font-medium ${checkin.workoutAdherence >= 80 ? 'text-secondary' :
                                                    checkin.workoutAdherence >= 60 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>
                                                    {checkin.workoutAdherence}%
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Utensils className="w-4 h-4 text-accent" />
                                                <span className={`font-medium ${checkin.dietAdherence >= 80 ? 'text-accent' :
                                                    checkin.dietAdherence >= 60 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>
                                                    {checkin.dietAdherence}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Photos */}
            {activeTab === 'photos' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fotos de Progresso</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-8 text-muted-foreground">
                            As fotos de progresso ainda não foram registradas.
                        </div>
                        <Link href="/student/checkin">
                            <Button variant="outline" className="w-full mt-2">
                                <Camera className="w-4 h-4" />
                                Adicionar Novas Fotos
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
