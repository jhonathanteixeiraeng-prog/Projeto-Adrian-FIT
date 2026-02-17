'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
    Users,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ChevronRight,
    UserPlus,
    Dumbbell,
    Utensils,
    Loader2,
    RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Avatar, Button } from '@/components/ui';

interface DashboardData {
    totalStudents: number;
    activeStudents: number;
    studentsWithoutWorkout72h: number;
    averageWorkoutAdherence: number;
    averageDietAdherence: number;
    pendingCheckins: number;
    lowAdherenceStudents: Array<{
        id: string;
        name: string;
        email: string;
        workoutAdherence: number;
        dietAdherence: number;
    }>;
    studentsWithoutWorkout72hList: Array<{
        id: string;
        name: string;
    }>;
}

const defaultStats: DashboardData = {
    totalStudents: 0,
    activeStudents: 0,
    studentsWithoutWorkout72h: 0,
    averageWorkoutAdherence: 0,
    averageDietAdherence: 0,
    pendingCheckins: 0,
    lowAdherenceStudents: [],
    studentsWithoutWorkout72hList: [],
};

export default function PersonalDashboard() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<DashboardData>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch('/api/dashboard');
            const result = await response.json();

            if (result.success) {
                setStats(result.data);
            } else {
                setError(result.error || 'Erro ao carregar dados');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            title: 'Total de Alunos',
            value: stats.totalStudents,
            subtitle: `${stats.activeStudents} ativos`,
            icon: Users,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10',
        },
        {
            title: 'Adesão Média Treino',
            value: `${stats.averageWorkoutAdherence}%`,
            subtitle: 'Últimos 7 dias',
            icon: Dumbbell,
            color: 'text-[#F88022]',
            bgColor: 'bg-[#F88022]/10',
        },
        {
            title: 'Adesão Média Dieta',
            value: `${stats.averageDietAdherence}%`,
            subtitle: 'Últimos 7 dias',
            icon: Utensils,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10',
        },
        {
            title: 'Alertas',
            value: stats.studentsWithoutWorkout72h,
            subtitle: 'Alunos sem treinar 72h',
            icon: AlertTriangle,
            color: 'text-yellow-500',
            bgColor: 'bg-yellow-500/10',
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        Olá, {session?.user?.name?.split(' ')[0] || 'Personal'}! 👋
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Confira o resumo dos seus alunos hoje
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchDashboardStats}
                        className="p-2 rounded-xl hover:bg-muted transition-colors"
                        title="Atualizar dados"
                    >
                        <RefreshCw className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F88022] text-white rounded-xl font-medium hover:bg-[#F88022]/90 transition-colors"
                    >
                        <UserPlus className="w-5 h-5" />
                        Novo Aluno
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((stat, index) => (
                    <Card key={index} className="relative overflow-hidden">
                        <CardContent className="p-4 lg:p-6">
                            <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center mb-3`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <p className="text-2xl lg:text-3xl font-bold text-foreground">{stat.value}</p>
                            <p className="text-sm font-medium text-foreground mt-1">{stat.title}</p>
                            <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Empty State */}
            {stats.totalStudents === 0 && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-[#F88022]/10 flex items-center justify-center mx-auto mb-4">
                            <Users className="w-10 h-10 text-[#F88022]" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">
                            Nenhum aluno cadastrado
                        </h3>
                        <p className="text-muted-foreground mb-6">
                            Comece adicionando seu primeiro aluno para ver as estatísticas aqui
                        </p>
                        <Link href="/personal/students/new">
                            <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                <UserPlus className="w-5 h-5" />
                                Cadastrar Primeiro Aluno
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {stats.totalStudents > 0 && (
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Low Adherence Students */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                Alunos com Baixa Adesão
                            </CardTitle>
                            <Badge variant="warning">{stats.lowAdherenceStudents.length}</Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {stats.lowAdherenceStudents.map((student) => (
                                <Link
                                    key={student.id}
                                    href={`/personal/students/${student.id}`}
                                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                                >
                                    <Avatar name={student.name || ''} size="md" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">
                                            {student.name}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Dumbbell className="w-3 h-3" />
                                                {student.workoutAdherence}%
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Utensils className="w-3 h-3" />
                                                {student.dietAdherence}%
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                </Link>
                            ))}
                            {stats.lowAdherenceStudents.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground">
                                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                    <p>Todos os alunos estão com boa adesão!</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Pending Check-ins / Students without workout */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-500" />
                                Sem Treinar há 72h+
                            </CardTitle>
                            <Badge variant="info">{stats.studentsWithoutWorkout72h}</Badge>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {stats.studentsWithoutWorkout72hList?.map((student) => (
                                    <Link
                                        key={student.id}
                                        href={`/personal/students/${student.id}`}
                                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors"
                                    >
                                        <Avatar name={student.name} size="md" />
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">{student.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Último treino há mais de 72h
                                            </p>
                                        </div>
                                        <Badge variant="warning">Inativo</Badge>
                                    </Link>
                                ))}
                                {stats.studentsWithoutWorkout72h === 0 && (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500" />
                                        <p>Todos os alunos estão treinando!</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Link
                            href="/personal/students/new"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-[#F88022]/10 flex items-center justify-center">
                                <UserPlus className="w-6 h-6 text-[#F88022]" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Novo Aluno</span>
                        </Link>
                        <Link
                            href="/personal/exercises"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <Dumbbell className="w-6 h-6 text-green-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Exercícios</span>
                        </Link>
                        <Link
                            href="/personal/students"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Users className="w-6 h-6 text-blue-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Ver Alunos</span>
                        </Link>
                        <Link
                            href="/personal/chat"
                            className="flex flex-col items-center gap-3 p-4 rounded-xl bg-muted hover:bg-muted/70 transition-colors"
                        >
                            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <TrendingUp className="w-6 h-6 text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-foreground text-center">Chat</span>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
