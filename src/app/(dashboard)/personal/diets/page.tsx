'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    Utensils,
    Calendar,
    MoreVertical,
    Copy,
    Edit,
    Trash2,
    ChevronRight,
    Flame,
    Loader2,
    Users,
    Library
} from 'lucide-react';
import { Card, CardContent, Button, Badge, Input, Avatar, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui';

interface DietPlan {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    active: boolean;
    createdAt: string;
    student: {
        id: string;
        user: {
            name: string;
            email: string;
        };
    };
    meals: Array<{ id: string }>;
}

interface DietTemplate {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    createdAt: string;
    meals: Array<{ id: string }>;
}

export default function DietsPage() {
    const [activeTab, setActiveTab] = useState<'students' | 'templates'>('students');
    const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
    const [templates, setTemplates] = useState<DietTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    // Menus
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [dietToDelete, setDietToDelete] = useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'students') {
                const response = await fetch('/api/diet-plans');
                const result = await response.json();
                if (result.success !== false) { // Handle array or {success: true, data: []}
                    setDietPlans(Array.isArray(result) ? result : result.data || []);
                } else {
                    setError(result.error || 'Erro ao carregar dietas');
                }
            } else {
                const response = await fetch('/api/diet-templates');
                const result = await response.json();
                if (result.success) {
                    setTemplates(result.data || []);
                } else {
                    setError(result.error || 'Erro ao carregar modelos');
                }
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteDiet = async () => {
        if (!dietToDelete) return;
        try {
            const response = await fetch(`/api/diets/${dietToDelete}`, { method: 'DELETE' });
            if (response.ok) {
                setDietPlans(dietPlans.filter(d => d.id !== dietToDelete));
                setOpenMenuId(null);
            } else {
                const errorData = await response.json().catch(() => null);
                alert(errorData?.error || 'Erro ao excluir dieta');
            }
        } catch (err) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setDietToDelete(null);
        }
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;
        try {
            const response = await fetch(`/api/diet-templates/${templateToDelete}`, { method: 'DELETE' });
            if (response.ok) {
                setTemplates(templates.filter(t => t.id !== templateToDelete));
                setOpenMenuId(null);
            } else {
                alert('Erro ao excluir modelo');
            }
        } catch (err) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setTemplateToDelete(null);
        }
    };

    const filteredPlans = dietPlans.filter(plan => {
        const matchesSearch =
            plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.student.user.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter =
            filterActive === 'all' ||
            (filterActive === 'active' && plan.active) ||
            (filterActive === 'inactive' && !plan.active);
        return matchesSearch && matchesFilter;
    });

    const filteredTemplates = templates.filter(template =>
        template.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activePlansCount = dietPlans.filter(p => p.active).length;
    const avgCalories = dietPlans.length > 0
        ? Math.round(dietPlans.reduce((acc, p) => acc + (p.calories || 0), 0) / dietPlans.length)
        : 0;

    if (loading && dietPlans.length === 0 && templates.length === 0) {
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
                    <h1 className="text-2xl font-bold text-foreground">Planos Alimentares</h1>
                    <p className="text-muted-foreground">Gerencie as dietas e modelos</p>
                </div>
                <Link href="/personal/diets/new">
                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                        <Plus className="w-5 h-5 mr-2" />
                        Nova Dieta
                    </Button>
                </Link>
            </div>

            {/* Custom Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('students')}
                    className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'students'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Meus Alunos
                    {activeTab === 'students' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'templates'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Biblioteca de Modelos
                    {activeTab === 'templates' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022]" />
                    )}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder={activeTab === 'students' ? "Buscar por título ou aluno..." : "Buscar modelos..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                {activeTab === 'students' && (
                    <div className="flex gap-2">
                        <Button
                            variant={filterActive === 'all' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('all')}
                        >
                            Todos
                        </Button>
                        <Button
                            variant={filterActive === 'active' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('active')}
                        >
                            Ativos
                        </Button>
                        <Button
                            variant={filterActive === 'inactive' ? 'primary' : 'outline'}
                            size="sm"
                            onClick={() => setFilterActive('inactive')}
                        >
                            Inativos
                        </Button>
                    </div>
                )}
            </div>

            {/* Content for Students Tab */}
            {activeTab === 'students' && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Utensils className="w-6 h-6 text-[#F88022] mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{dietPlans.length}</p>
                                <p className="text-xs text-muted-foreground">Total</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Calendar className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{activePlansCount}</p>
                                <p className="text-xs text-muted-foreground">Ativos</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <Flame className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-foreground">{avgCalories}</p>
                                <p className="text-xs text-muted-foreground">Média kcal</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-3">
                        {filteredPlans.length === 0 ? (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-foreground mb-2">
                                        Nenhum plano encontrado
                                    </h3>
                                    <p className="text-muted-foreground">
                                        Crie dietas para seus alunos
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            filteredPlans.map((plan) => (
                                <Card key={plan.id} className="hover:border-[#F88022]/50 transition-colors">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar name={plan.student.user.name} size="md" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-foreground truncate">
                                                        {plan.title}
                                                    </h3>
                                                    <Badge variant={plan.active ? 'success' : 'default'}>
                                                        {plan.active ? 'Ativo' : 'Inativo'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{plan.student.user.name}</p>
                                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Flame className="w-3 h-3 text-orange-500" />
                                                        {plan.calories || 0} kcal
                                                    </span>
                                                    <span>P: {plan.protein || 0}g</span>
                                                    <span>C: {plan.carbs || 0}g</span>
                                                    <span>G: {plan.fat || 0}g</span>
                                                </div>
                                            </div>
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
                                                        <Link href={`/personal/diets/${plan.id}`} className="block w-full px-4 py-3 text-left text-sm hover:bg-muted">
                                                            <div className="flex items-center gap-2">
                                                                <Edit className="w-4 h-4" /> Editar
                                                            </div>
                                                        </Link>
                                                        <button
                                                            onClick={() => setDietToDelete(plan.id)}
                                                            className="w-full px-4 py-3 text-left text-sm hover:bg-muted text-red-500 flex items-center gap-2"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Excluir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* Content for Templates Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-3">
                    {filteredTemplates.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <Library className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    Nenhum modelo encontrado
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    Salve suas dietas como modelos para reutilizar depois
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredTemplates.map((template) => (
                            <Card key={template.id} className="hover:border-[#F88022]/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-[#F88022]/10 rounded-full">
                                            <Library className="w-6 h-6 text-[#F88022]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-foreground truncate mb-1">
                                                {template.title}
                                            </h3>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Flame className="w-3 h-3 text-orange-500" />
                                                    {template.calories || 0} kcal
                                                </span>
                                                <span>P: {template.protein || 0}g</span>
                                                <span>C: {template.carbs || 0}g</span>
                                                <span>G: {template.fat || 0}g</span>
                                                <span>{template.meals.length} refeições</span>
                                            </div>
                                        </div>
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
                                                        onClick={() => setTemplateToDelete(template.id)}
                                                        className="w-full px-4 py-3 text-left text-sm hover:bg-muted text-red-500 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Excluir Modelo
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Delete Confirmation Dialogs */}
            <AlertDialog open={!!dietToDelete} onOpenChange={(open) => !open && setDietToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Plano Alimentar</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este plano? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDietToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteDiet} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este modelo?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-red-600 hover:bg-red-700">
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
