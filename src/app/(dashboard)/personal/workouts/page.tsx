'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    Dumbbell,
    Calendar,
    Users,
    MoreVertical,
    Copy,
    Edit,
    Trash2,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { Card, CardContent, Button, Badge, Input, Avatar } from '@/components/ui';

interface WorkoutPlan {
    id: string;
    studentId: string;
    title: string;
    startDate: string;
    endDate: string;
    active: boolean;
    version: number;
    student: {
        user: { name: string };
    };
    _count?: {
        workoutDays: number;
    };
}

interface WorkoutTemplate {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    _count?: {
        templateDays: number;
    };
}

export default function WorkoutsPage() {
    const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'plans' | 'library'>('plans');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    useEffect(() => {
        if (activeTab === 'plans') {
            fetchWorkoutPlans();
        } else {
            fetchTemplates();
        }
    }, [activeTab]);

    const fetchWorkoutPlans = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/workout-plans');
            const result = await response.json();

            if (result.success) {
                setWorkoutPlans(result.data);
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err) {
            setError('Erro ao carregar planos de treino');
        } finally {
            setLoading(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/workout-templates');
            const result = await response.json();

            if (result.success) {
                setTemplates(result.data);
            } else if (result.error) {
                setError(result.error);
            }
        } catch (err) {
            setError('Erro ao carregar biblioteca');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este modelo?')) return;

        try {
            const response = await fetch(`/api/workout-templates/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTemplates(templates.filter(t => t.id !== id));
            }
        } catch (err) {
            setError('Erro ao excluir modelo');
        }
        setOpenMenuId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este plano?')) return;

        try {
            const response = await fetch(`/api/workout-plans/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setWorkoutPlans(workoutPlans.filter(p => p.id !== id));
            }
        } catch (err) {
            setError('Erro ao excluir plano');
        }
        setOpenMenuId(null);
    };

    const filteredPlans = workoutPlans.filter(plan => {
        const matchesSearch =
            plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.student?.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            filterActive === 'all' ||
            (filterActive === 'active' && plan.active) ||
            (filterActive === 'inactive' && !plan.active);

        return matchesSearch && matchesFilter;
    });

    const filteredTemplates = templates.filter(template => {
        return template.title.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Planos de Treino</h1>
                    <p className="text-muted-foreground">Gerencie os treinos dos seus alunos</p>
                </div>
                <Link href="/personal/workouts/new">
                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                        <Plus className="w-5 h-5" />
                        Novo Plano
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('plans')}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'plans'
                        ? 'border-[#F88022] text-[#F88022]'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Meus Planos
                </button>
                <button
                    onClick={() => setActiveTab('library')}
                    className={`px-6 py-3 font-medium transition-colors border-b-2 ${activeTab === 'library'
                        ? 'border-[#F88022] text-[#F88022]'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Biblioteca de Modelos
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder={activeTab === 'plans' ? "Buscar por título ou aluno..." : "Buscar modelos..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {activeTab === 'plans' && (
                    <div className="flex gap-2">
                        <Button
                            variant={filterActive === 'all' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('all')}
                            className={filterActive === 'all' ? 'bg-[#F88022]' : ''}
                        >
                            Todos
                        </Button>
                        <Button
                            variant={filterActive === 'active' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('active')}
                            className={filterActive === 'active' ? 'bg-[#F88022]' : ''}
                        >
                            Ativos
                        </Button>
                        <Button
                            variant={filterActive === 'inactive' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('inactive')}
                            className={filterActive === 'inactive' ? 'bg-[#F88022]' : ''}
                        >
                            Inativos
                        </Button>
                    </div>
                )}
            </div>

            {/* Stats */}
            {activeTab === 'plans' && (
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <Dumbbell className="w-6 h-6 text-[#F88022] mx-auto mb-2" />
                            <p className="text-2xl font-bold text-foreground">{workoutPlans.length}</p>
                            <p className="text-xs text-muted-foreground">Total de Planos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <Calendar className="w-6 h-6 text-[#F88022] mx-auto mb-2" />
                            <p className="text-2xl font-bold text-foreground">
                                {workoutPlans.filter(p => p.active).length}
                            </p>
                            <p className="text-xs text-muted-foreground">Ativos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-foreground">
                                {new Set(workoutPlans.map(p => p.student?.user?.name)).size}
                            </p>
                            <p className="text-xs text-muted-foreground">Alunos</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Workout Plans List / Library List */}
            <div className="space-y-3">
                {activeTab === 'plans' ? (
                    filteredPlans.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Nenhum plano encontrado
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    {searchTerm
                                        ? 'Tente buscar com outros termos'
                                        : 'Crie seu primeiro plano de treino'}
                                </p>
                                <Link href="/personal/workouts/new">
                                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                        <Plus className="w-5 h-5" />
                                        Criar Plano
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredPlans.map((plan) => (
                            <Card key={plan.id} className="hover:border-[#F88022]/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Avatar name={plan.student?.user?.name || ''} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-foreground truncate">
                                                    {plan.title}
                                                </h3>
                                                <Badge variant={plan.active ? 'success' : 'default'}>
                                                    {plan.active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                                {plan.version > 1 && (
                                                    <Badge variant="info">v{plan.version}</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{plan.student?.user?.name}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Dumbbell className="w-3 h-3" />
                                                    {plan._count?.workoutDays || 0} dias
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Link href={`/personal/students/${plan.studentId}/workout?planId=${plan.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <ChevronRight className="w-5 h-5" />
                                                </Button>
                                            </Link>
                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </Button>
                                                {openMenuId === plan.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                                                        <Link href={`/personal/students/${plan.studentId}/workout?planId=${plan.id}`}>
                                                            <button className="w-full px-4 py-3 text-left text-sm hover:bg-muted flex items-center gap-2">
                                                                <Edit className="w-4 h-4" />
                                                                Editar
                                                            </button>
                                                        </Link>
                                                        <button className="w-full px-4 py-3 text-left text-sm hover:bg-muted flex items-center gap-2">
                                                            <Copy className="w-4 h-4" />
                                                            Duplicar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(plan.id)}
                                                            className="w-full px-4 py-3 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-500"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )
                ) : (
                    filteredTemplates.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <Plus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Nenhum modelo encontrado
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    Crie planos e salve-os como modelos para que apareçam aqui
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredTemplates.map((template) => (
                            <Card key={template.id} className="hover:border-[#F88022]/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center">
                                            <Dumbbell className="w-5 h-5 text-[#F88022]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground truncate">
                                                {template.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {template.description || 'Sem descrição'}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Dumbbell className="w-3 h-3" />
                                                    {template._count?.templateDays || 0} dias de treino
                                                </span>
                                                <span>Criado em {formatDate(template.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setOpenMenuId(openMenuId === template.id ? null : template.id)}
                                                >
                                                    <MoreVertical className="w-5 h-5" />
                                                </Button>
                                                {openMenuId === template.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                                                        <button
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="w-full px-4 py-3 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-500"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Excluir Modelo
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )
                )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Mostrando {filteredPlans.length} de {workoutPlans.length} planos</span>
                <button onClick={fetchWorkoutPlans} className="text-[#F88022] hover:underline">
                    Atualizar lista
                </button>
            </div>
        </div>
    );
}
