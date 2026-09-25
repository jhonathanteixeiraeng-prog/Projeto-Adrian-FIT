'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Plus,
    Search,
    Utensils,
    Calendar,
    MoreVertical,
    Edit,
    Trash2,
    Flame,
    Loader2,
    Users,
    BookOpen,
    Eye,
    UserPlus,
    Clock,
    CheckCircle2
} from 'lucide-react';
import {
    Card,
    CardContent,
    Button,
    Badge,
    Input,
    Select,
    Avatar,
    useToast,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui';

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
            avatar?: string;
        };
    };
    meals: Array<{ id: string }>;
}

interface TemplateFoodItem {
    name: string;
    portion?: string;
    quantity: number;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    notes?: string;
}

interface TemplateMeal {
    id: string;
    name: string;
    time: string;
    items?: TemplateFoodItem[];
}

interface DietTemplate {
    id: string;
    title: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    createdAt: string;
    meals: TemplateMeal[];
}

interface StudentOption {
    id: string;
    user: {
        name: string;
        email: string;
    };
}

export default function DietsPage() {
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'students' | 'templates'>('students');
    const [dietPlans, setDietPlans] = useState<DietPlan[]>([]);
    const [templates, setTemplates] = useState<DietTemplate[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    // Menus & Delete
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [dietToDelete, setDietToDelete] = useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    // Preview Template Modal
    const [previewTemplate, setPreviewTemplate] = useState<DietTemplate | null>(null);

    // Assign Template Modal
    const [assignTemplate, setAssignTemplate] = useState<DietTemplate | null>(null);
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignTargetCalories, setAssignTargetCalories] = useState<number>(2000);
    const [assignStartDate, setAssignStartDate] = useState('');
    const [assignEndDate, setAssignEndDate] = useState('');
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#templates') {
            setActiveTab('templates');
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/students');
            const data = await res.json();
            if (data.success && Array.isArray(data.data)) {
                setStudents(data.data.map((s: any) => ({
                    id: s.id,
                    user: {
                        name: s.user?.name || 'Aluno',
                        email: s.user?.email || '',
                    },
                })));
            }
        } catch {
            // Silently handle
        }
    };

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'students') {
                const response = await fetch('/api/diet-plans');
                const result = await response.json();
                if (result.success !== false) {
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
        } catch {
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
                toast.success('Dieta excluída!', 'O plano alimentar foi removido.');
                setOpenMenuId(null);
            } else {
                const errorData = await response.json().catch(() => null);
                toast.error(errorData?.error || 'Erro ao excluir dieta');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
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
                toast.success('Modelo excluído!', 'O modelo foi removido da sua biblioteca.');
                setOpenMenuId(null);
            } else {
                toast.error('Erro ao excluir modelo');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setTemplateToDelete(null);
        }
    };

    const openAssignModal = (template: DietTemplate) => {
        setAssignTemplate(template);
        setAssignTargetCalories(template.calories || 2000);

        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        setAssignStartDate(today.toISOString().split('T')[0]);
        setAssignEndDate(nextMonth.toISOString().split('T')[0]);
        if (students.length > 0) {
            setAssignStudentId(students[0].id);
        }
    };

    const handleAssignTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignTemplate || !assignStudentId) {
            toast.warning('Selecione um aluno para continuar');
            return;
        }

        try {
            setAssigning(true);
            const response = await fetch('/api/diet-plans/from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: assignTemplate.id,
                    studentId: assignStudentId,
                    startDate: assignStartDate,
                    endDate: assignEndDate,
                    targetCalories: Number(assignTargetCalories) || 2000,
                }),
            });

            const result = await response.json();
            if (response.ok && result.success !== false) {
                toast.success(
                    'Dieta atribuída com sucesso!',
                    `O plano alimentar foi prescrito para o aluno.`
                );
                setAssignTemplate(null);
                fetchData();
            } else {
                toast.error(result.error || 'Erro ao atribuir dieta ao aluno');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setAssigning(false);
        }
    };

    const filteredPlans = dietPlans.filter(plan => {
        const matchesSearch =
            plan.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.student?.user?.name?.toLowerCase().includes(searchTerm.toLowerCase());
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

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
        });
    };

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
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Central de Nutrição</h1>
                    <p className="text-sm text-muted-foreground">Gerencie planos alimentares, metas nutricionais e templates reutilizáveis</p>
                </div>
                <Link href="/personal/diets/new">
                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white shadow-sm shadow-[#F88022]/20">
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Dieta
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* SaaS Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Dietas</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{dietPlans.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center">
                            <Utensils className="w-5 h-5 text-[#F88022]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Dietas Ativas</p>
                            <p className="text-2xl font-bold text-emerald-500 mt-1">{activePlansCount}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Média Diária</p>
                            <p className="text-2xl font-bold text-orange-500 mt-1">{avgCalories} <span className="text-xs font-normal text-muted-foreground">kcal</span></p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Biblioteca</p>
                            <p className="text-2xl font-bold text-[#F88022] mt-1">{templates.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modern Tab Bar */}
            <div className="flex items-center gap-1 border-b border-border">
                <button
                    onClick={() => setActiveTab('students')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative ${
                        activeTab === 'students'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Utensils className="w-4 h-4" />
                    <span>Dietas dos Alunos</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === 'students'
                            ? 'bg-[#F88022]/15 text-[#F88022]'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {dietPlans.length}
                    </span>
                    {activeTab === 'students' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022] shadow-[0_0_8px_rgba(248,128,34,0.5)]" />
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('templates')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative ${
                        activeTab === 'templates'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Biblioteca de Modelos</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === 'templates'
                            ? 'bg-[#F88022]/15 text-[#F88022]'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {templates.length}
                    </span>
                    {activeTab === 'templates' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022] shadow-[0_0_8px_rgba(248,128,34,0.5)]" />
                    )}
                </button>
            </div>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={
                            activeTab === 'students'
                                ? "Buscar por aluno ou título da dieta..."
                                : "Buscar modelos na biblioteca..."
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-card/60 text-sm"
                    />
                </div>
                {activeTab === 'students' && (
                    <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
                        <button
                            onClick={() => setFilterActive('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'all'
                                    ? 'bg-card text-foreground shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Todos ({dietPlans.length})
                        </button>
                        <button
                            onClick={() => setFilterActive('active')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'active'
                                    ? 'bg-card text-emerald-500 shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Ativos ({activePlansCount})
                        </button>
                        <button
                            onClick={() => setFilterActive('inactive')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'inactive'
                                    ? 'bg-card text-muted-foreground shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Inativos ({dietPlans.length - activePlansCount})
                        </button>
                    </div>
                )}
            </div>

            {/* Student Diets Tab */}
            {activeTab === 'students' && (
                <div className="space-y-3">
                    {filteredPlans.length === 0 ? (
                        <Card className="border-dashed border-border/80 bg-card/40">
                            <CardContent className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[#F88022]/10 flex items-center justify-center mx-auto mb-4 text-[#F88022]">
                                    <Utensils className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-1">
                                    Nenhuma dieta encontrada
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                                    {searchTerm
                                        ? 'Nenhuma dieta corresponde aos filtros aplicados.'
                                        : 'Crie sua primeira prescrição nutricional para um aluno.'}
                                </p>
                                <Link href="/personal/diets/new">
                                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Criar Nova Dieta
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredPlans.map((plan) => (
                            <Card
                                key={plan.id}
                                className="group hover:border-[#F88022]/60 hover:shadow-md transition-all duration-200 bg-card/80 backdrop-blur-sm"
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-4">
                                        <Avatar
                                            name={plan.student?.user?.name || 'Aluno'}
                                            src={plan.student?.user?.avatar}
                                            size="md"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Link
                                                    href={`/personal/diets/${plan.id}`}
                                                    className="font-semibold text-foreground hover:text-[#F88022] transition-colors truncate"
                                                >
                                                    {plan.title}
                                                </Link>
                                                <Badge variant={plan.active ? 'success' : 'default'} className="text-[11px] px-2 py-0.5">
                                                    {plan.active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/personal/students/${plan.student?.id}`}
                                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                                                >
                                                    {plan.student?.user?.name || 'Aluno'}
                                                </Link>
                                            </div>

                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                                                    {plan.calories || 0} kcal
                                                </span>
                                                <span className="text-muted-foreground">
                                                    P: <strong className="text-foreground">{plan.protein || 0}g</strong>
                                                </span>
                                                <span className="text-muted-foreground">
                                                    C: <strong className="text-foreground">{plan.carbs || 0}g</strong>
                                                </span>
                                                <span className="text-muted-foreground">
                                                    G: <strong className="text-foreground">{plan.fat || 0}g</strong>
                                                </span>
                                                <span>•</span>
                                                <span>{plan.meals?.length || 0} refeições</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link href={`/personal/diets/${plan.id}`}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="hidden sm:flex items-center gap-1.5 text-xs hover:border-[#F88022] hover:text-[#F88022]"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                    Editar
                                                </Button>
                                            </Link>

                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setOpenMenuId(openMenuId === plan.id ? null : plan.id)}
                                                    className="p-2"
                                                >
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </Button>

                                                {openMenuId === plan.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden py-1">
                                                        <Link
                                                            href={`/personal/diets/${plan.id}`}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-muted flex items-center gap-2 text-foreground"
                                                        >
                                                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                                                            Editar Dieta
                                                        </Link>
                                                        <Link
                                                            href={`/personal/students/${plan.student?.id}`}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-muted flex items-center gap-2 text-foreground"
                                                        >
                                                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                                            Ficha do Aluno
                                                        </Link>
                                                        <button
                                                            onClick={() => {
                                                                setDietToDelete(plan.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-500 border-t border-border"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Excluir Dieta
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Templates Library Tab */}
            {activeTab === 'templates' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{filteredTemplates.length} modelos nutricionais disponíveis</span>
                    </div>

                    {filteredTemplates.length === 0 ? (
                        <Card className="border-dashed border-border/80 bg-card/40">
                            <CardContent className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4 text-blue-500">
                                    <BookOpen className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-1">
                                    Nenhum modelo cadastrado
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                                    Para criar um modelo, acesse o plano alimentar de qualquer aluno e clique em &quot;Copiar para Biblioteca&quot;.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTemplates.map((template) => (
                                <Card
                                    key={template.id}
                                    className="hover:border-[#F88022]/60 hover:shadow-md transition-all duration-200 bg-card/80 backdrop-blur-sm flex flex-col justify-between"
                                >
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Flame className="w-5 h-5 text-orange-500" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-foreground text-base leading-tight">
                                                        {template.title}
                                                    </h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="font-bold text-sm text-foreground">
                                                            {template.calories || 0} kcal
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">• {template.meals?.length || 0} refeições</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="relative">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setOpenMenuId(openMenuId === template.id ? null : template.id)}
                                                    className="p-1.5"
                                                >
                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                </Button>

                                                {openMenuId === template.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden py-1">
                                                        <button
                                                            onClick={() => {
                                                                setTemplateToDelete(template.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-500"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Excluir Modelo
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Macro breakdown */}
                                        <div className="grid grid-cols-3 gap-2 p-2.5 bg-muted/40 rounded-xl text-center text-xs">
                                            <div>
                                                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Proteína</span>
                                                <span className="font-bold text-foreground">{template.protein || 0}g</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Carboidratos</span>
                                                <span className="font-bold text-foreground">{template.carbs || 0}g</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Gordura</span>
                                                <span className="font-bold text-foreground">{template.fat || 0}g</span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPreviewTemplate(template)}
                                                className="flex-1 text-xs gap-1.5 hover:border-[#F88022] hover:text-[#F88022]"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                Visualizar
                                            </Button>

                                            <Button
                                                size="sm"
                                                onClick={() => openAssignModal(template)}
                                                className="flex-1 text-xs gap-1.5 bg-[#F88022] hover:bg-[#F88022]/90 text-white font-semibold"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                Atribuir a Aluno
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Preview Diet Template Modal */}
            <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Utensils className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">{previewTemplate?.title}</DialogTitle>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                    <span className="font-semibold text-foreground">{previewTemplate?.calories || 0} kcal</span>
                                    <span>•</span>
                                    <span>P: {previewTemplate?.protein || 0}g | C: {previewTemplate?.carbs || 0}g | G: {previewTemplate?.fat || 0}g</span>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 my-2">
                        {previewTemplate?.meals && previewTemplate.meals.length > 0 ? (
                            previewTemplate.meals.map((meal, idx) => (
                                <div key={meal.id || idx} className="border border-border rounded-xl p-4 space-y-2 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-[#F88022]/15 text-[#F88022] text-xs flex items-center justify-center font-bold">
                                                {idx + 1}
                                            </span>
                                            {meal.name}
                                        </h4>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-[#F88022]" />
                                            {meal.time}
                                        </span>
                                    </div>

                                    {meal.items && meal.items.length > 0 ? (
                                        <div className="divide-y divide-border/50 text-xs">
                                            {meal.items.map((food, fIdx) => (
                                                <div key={fIdx} className="py-2 flex items-center justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-foreground truncate">{food.name}</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {food.quantity} {food.portion || 'unidade'}{food.notes ? ` • ${food.notes}` : ''}
                                                        </p>
                                                    </div>
                                                    {typeof food.calories === 'number' && (
                                                        <span className="text-xs font-semibold text-orange-500 shrink-0">
                                                            {Math.round(food.calories)} kcal
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Nenhum alimento nesta refeição.</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Nenhuma refeição configurada neste modelo.
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                        <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(null)}>
                            Fechar
                        </Button>
                        {previewTemplate && (
                            <Button
                                size="sm"
                                className="bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                                onClick={() => {
                                    const tpl = previewTemplate;
                                    setPreviewTemplate(null);
                                    openAssignModal(tpl);
                                }}
                            >
                                <UserPlus className="w-4 h-4 mr-1.5" />
                                Atribuir a Aluno
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assign Diet to Student Modal */}
            <Dialog open={!!assignTemplate} onOpenChange={(open) => !open && setAssignTemplate(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center text-[#F88022]">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Atribuir Dieta a Aluno</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Recalcula e prescreve este modelo para o aluno
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <form onSubmit={handleAssignTemplate} className="space-y-4 my-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Selecione o Aluno *
                            </label>
                            {students.length === 0 ? (
                                <p className="text-xs text-red-500">Nenhum aluno cadastrado.</p>
                            ) : (
                                <Select
                                    value={assignStudentId}
                                    onChange={(e) => setAssignStudentId(e.target.value)}
                                    options={students.map((s) => ({
                                        value: s.id,
                                        label: `${s.user.name} (${s.user.email})`,
                                    }))}
                                />
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Meta Calórica Alvo (kcal) *
                            </label>
                            <Input
                                type="number"
                                min={800}
                                max={6000}
                                value={assignTargetCalories}
                                onChange={(e) => setAssignTargetCalories(Number(e.target.value))}
                                placeholder="Ex: 2200"
                                required
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                O sistema escalará proporcionalmente as quantidades e macros dos alimentos.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Data de Início *
                                </label>
                                <Input
                                    type="date"
                                    value={assignStartDate}
                                    onChange={(e) => setAssignStartDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                    Data de Término *
                                </label>
                                <Input
                                    type="date"
                                    value={assignEndDate}
                                    onChange={(e) => setAssignEndDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-border">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setAssignTemplate(null)}
                                disabled={assigning}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="bg-[#F88022] hover:bg-[#F88022]/90 text-white font-semibold"
                                loading={assigning}
                            >
                                Prescrever Dieta
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Diet Modal */}
            <AlertDialog open={!!dietToDelete} onOpenChange={(open) => !open && setDietToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Plano Alimentar</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir esta dieta? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDietToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteDiet} className="bg-red-600 hover:bg-red-700">
                            Excluir Dieta
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Delete Template Modal */}
            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Modelo de Dieta</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este modelo da sua biblioteca? Planos já atribuídos a alunos não serão afetados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTemplateToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteTemplate} className="bg-red-600 hover:bg-red-700">
                            Excluir Modelo
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
