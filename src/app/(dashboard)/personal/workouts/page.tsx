'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
    Loader2,
    Eye,
    UserPlus,
    BookOpen,
    Clock,
    X,
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
    AlertDialogTitle,
} from '@/components/ui';

interface WorkoutPlan {
    id: string;
    studentId: string;
    title: string;
    startDate: string;
    endDate: string;
    active: boolean;
    version: number;
    student: {
        user: { name: string; email?: string; avatar?: string };
    };
    _count?: {
        workoutDays: number;
    };
}

interface TemplateExerciseItem {
    id: string;
    exercise: {
        id: string;
        name: string;
        muscleGroup?: string;
    };
    sets: number;
    reps: string;
    rest: number;
    notes?: string | null;
}

interface TemplateDay {
    id: string;
    name: string;
    dayOfWeek: number;
    items: TemplateExerciseItem[];
}

interface WorkoutTemplate {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    templateDays?: TemplateDay[];
    _count?: {
        templateDays: number;
    };
}

interface StudentOption {
    id: string;
    user: {
        name: string;
        email: string;
    };
}

const dayNames = [
    'Domingo',
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado'
];

export default function WorkoutsPage() {
    const router = useRouter();
    const { toast } = useToast();

    const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
    const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [activeTab, setActiveTab] = useState<'plans' | 'library'>('plans');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Delete Modals
    const [planToDelete, setPlanToDelete] = useState<string | null>(null);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    // Preview Template Modal
    const [previewTemplate, setPreviewTemplate] = useState<WorkoutTemplate | null>(null);

    // Assign Template Modal
    const [assignTemplate, setAssignTemplate] = useState<WorkoutTemplate | null>(null);
    const [assignStudentId, setAssignStudentId] = useState('');
    const [assignTitle, setAssignTitle] = useState('');
    const [assignStartDate, setAssignStartDate] = useState('');
    const [assignEndDate, setAssignEndDate] = useState('');
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        if (activeTab === 'plans') {
            fetchWorkoutPlans();
        } else {
            fetchTemplates();
        }
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
            // Silently handle students list error
        }
    };

    const fetchWorkoutPlans = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/workout-plans');
            const result = await response.json();

            if (result.success) {
                setWorkoutPlans(result.data || []);
            } else if (result.error) {
                setError(result.error);
            }
        } catch {
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
                setTemplates(result.data || []);
            } else if (result.error) {
                setError(result.error);
            }
        } catch {
            setError('Erro ao carregar biblioteca');
        } finally {
            setLoading(false);
        }
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;

        try {
            const response = await fetch(`/api/workout-templates/${templateToDelete}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTemplates(templates.filter(t => t.id !== templateToDelete));
                toast.success('Modelo excluído!', 'O modelo foi removido da sua biblioteca.');
            } else {
                toast.error('Erro ao excluir modelo');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setTemplateToDelete(null);
            setOpenMenuId(null);
        }
    };

    const confirmDeletePlan = async () => {
        if (!planToDelete) return;

        try {
            const response = await fetch(`/api/workout-plans/${planToDelete}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setWorkoutPlans(workoutPlans.filter(p => p.id !== planToDelete));
                toast.success('Plano excluído!', 'O plano de treino foi removido com sucesso.');
            } else {
                toast.error('Erro ao excluir plano de treino');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setPlanToDelete(null);
            setOpenMenuId(null);
        }
    };

    const openAssignModal = (template: WorkoutTemplate) => {
        setAssignTemplate(template);
        setAssignTitle(template.title);

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
            const response = await fetch('/api/workout-plans/from-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    templateId: assignTemplate.id,
                    studentId: assignStudentId,
                    title: assignTitle.trim() || assignTemplate.title,
                    startDate: assignStartDate,
                    endDate: assignEndDate,
                }),
            });

            const result = await response.json();
            if (response.ok && result.success !== false) {
                toast.success(
                    'Treino atribuído com sucesso!',
                    `O modelo foi prescrito para o aluno.`
                );
                setAssignTemplate(null);
                // Redirect or refresh
                fetchWorkoutPlans();
            } else {
                toast.error(result.error || 'Erro ao atribuir treino ao aluno');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setAssigning(false);
        }
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
        return (
            template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
        });
    };

    if (loading && workoutPlans.length === 0 && templates.length === 0) {
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
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Central de Treinos</h1>
                    <p className="text-sm text-muted-foreground">Gerencie planos ativos, histórico e biblioteca de templates reutilizáveis</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/personal/workouts/new">
                        <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white shadow-sm shadow-[#F88022]/20">
                            <Plus className="w-4 h-4 mr-2" />
                            Novo Plano
                        </Button>
                    </Link>
                </div>
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
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total de Planos</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{workoutPlans.length}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center">
                            <Dumbbell className="w-5 h-5 text-[#F88022]" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Planos Ativos</p>
                            <p className="text-2xl font-bold text-emerald-500 mt-1">
                                {workoutPlans.filter(p => p.active).length}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border/70 shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Alunos Prescritos</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                                {new Set(workoutPlans.map(p => p.studentId)).size}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-500" />
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
                    onClick={() => setActiveTab('plans')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative ${
                        activeTab === 'plans'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Dumbbell className="w-4 h-4" />
                    <span>Meus Planos</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === 'plans'
                            ? 'bg-[#F88022]/15 text-[#F88022]'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {workoutPlans.length}
                    </span>
                    {activeTab === 'plans' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022] shadow-[0_0_8px_rgba(248,128,34,0.5)]" />
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('library')}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all relative ${
                        activeTab === 'library'
                            ? 'text-[#F88022]'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <BookOpen className="w-4 h-4" />
                    <span>Biblioteca de Modelos</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        activeTab === 'library'
                            ? 'bg-[#F88022]/15 text-[#F88022]'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                        {templates.length}
                    </span>
                    {activeTab === 'library' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F88022] shadow-[0_0_8px_rgba(248,128,34,0.5)]" />
                    )}
                </button>
            </div>

            {/* Search & Status Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={
                            activeTab === 'plans'
                                ? "Buscar por nome do aluno ou título do treino..."
                                : "Buscar modelos por título ou objetivo..."
                        }
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-card/60 text-sm"
                    />
                </div>
                {activeTab === 'plans' && (
                    <div className="flex gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
                        <button
                            onClick={() => setFilterActive('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'all'
                                    ? 'bg-card text-foreground shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Todos ({workoutPlans.length})
                        </button>
                        <button
                            onClick={() => setFilterActive('active')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'active'
                                    ? 'bg-card text-emerald-500 shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Ativos ({workoutPlans.filter(p => p.active).length})
                        </button>
                        <button
                            onClick={() => setFilterActive('inactive')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                filterActive === 'inactive'
                                    ? 'bg-card text-muted-foreground shadow-sm font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            Inativos ({workoutPlans.filter(p => !p.active).length})
                        </button>
                    </div>
                )}
            </div>

            {/* Plans List Tab */}
            {activeTab === 'plans' && (
                <div className="space-y-3">
                    {filteredPlans.length === 0 ? (
                        <Card className="border-dashed border-border/80 bg-card/40">
                            <CardContent className="p-12 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-[#F88022]/10 flex items-center justify-center mx-auto mb-4 text-[#F88022]">
                                    <Dumbbell className="w-7 h-7" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-1">
                                    Nenhum plano encontrado
                                </h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                                    {searchTerm
                                        ? 'Nenhum plano corresponde aos filtros aplicados.'
                                        : 'Você ainda não prescreveu planos de treino para seus alunos.'}
                                </p>
                                <Link href="/personal/workouts/new">
                                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Criar Primeiro Plano
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
                                                    href={`/personal/students/${plan.studentId}/workout?planId=${plan.id}`}
                                                    className="font-semibold text-foreground hover:text-[#F88022] transition-colors truncate"
                                                >
                                                    {plan.title}
                                                </Link>
                                                <Badge variant={plan.active ? 'success' : 'default'} className="text-[11px] px-2 py-0.5">
                                                    {plan.active ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                                {plan.version > 1 && (
                                                    <Badge variant="info" className="text-[10px] px-1.5 py-0">
                                                        v{plan.version}
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/personal/students/${plan.studentId}`}
                                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
                                                >
                                                    {plan.student?.user?.name || 'Aluno'}
                                                </Link>
                                            </div>

                                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Dumbbell className="w-3.5 h-3.5 text-[#F88022]" />
                                                    {plan._count?.workoutDays || 0} dias de treino
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link href={`/personal/students/${plan.studentId}/workout?planId=${plan.id}`}>
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
                                                            href={`/personal/students/${plan.studentId}/workout?planId=${plan.id}`}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-muted flex items-center gap-2 text-foreground"
                                                        >
                                                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                                                            Editar Treino
                                                        </Link>
                                                        <Link
                                                            href={`/personal/students/${plan.studentId}`}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-muted flex items-center gap-2 text-foreground"
                                                        >
                                                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                                            Ficha do Aluno
                                                        </Link>
                                                        <button
                                                            onClick={() => {
                                                                setPlanToDelete(plan.id);
                                                                setOpenMenuId(null);
                                                            }}
                                                            className="w-full px-3.5 py-2.5 text-left text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-red-500 border-t border-border"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Excluir Treino
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

            {/* Library Tab */}
            {activeTab === 'library' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{filteredTemplates.length} modelos prontos para prescrição rápida</span>
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
                                    Para criar um modelo, acesse qualquer treino de aluno e use o botão &quot;Copiar para Biblioteca&quot;.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTemplates.map((template) => {
                                const totalExercises = template.templateDays?.reduce(
                                    (sum, day) => sum + (day.items?.length || 0),
                                    0
                                ) || 0;

                                return (
                                    <Card
                                        key={template.id}
                                        className="hover:border-[#F88022]/60 hover:shadow-md transition-all duration-200 bg-card/80 backdrop-blur-sm flex flex-col justify-between"
                                    >
                                        <CardContent className="p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center shrink-0 mt-0.5">
                                                        <Dumbbell className="w-5 h-5 text-[#F88022]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-semibold text-foreground text-base leading-tight">
                                                            {template.title}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                            {template.description || 'Modelo padrão para prescrição rápida.'}
                                                        </p>
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

                                            {/* Badges / Metrics */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                                                <span className="flex items-center gap-1.5 font-medium text-foreground">
                                                    <Calendar className="w-3.5 h-3.5 text-[#F88022]" />
                                                    {template.templateDays?.length || template._count?.templateDays || 0} dias
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1.5">
                                                    <Dumbbell className="w-3.5 h-3.5 text-muted-foreground" />
                                                    {totalExercises} exercícios
                                                </span>
                                                <span>•</span>
                                                <span className="text-muted-foreground text-[11px]">
                                                    Criado em {formatDate(template.createdAt)}
                                                </span>
                                            </div>

                                            {/* Action Buttons */}
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
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Quick Preview Modal */}
            <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center text-[#F88022]">
                                <Dumbbell className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold">{previewTemplate?.title}</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {previewTemplate?.description || 'Estrutura completa do modelo de treino'}
                                </p>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4 my-2">
                        {previewTemplate?.templateDays && previewTemplate.templateDays.length > 0 ? (
                            previewTemplate.templateDays.map((day, idx) => (
                                <div key={day.id || idx} className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-[#F88022]/15 text-[#F88022] text-xs flex items-center justify-center font-bold">
                                                {idx + 1}
                                            </span>
                                            {day.name}
                                        </h4>
                                        <span className="text-xs text-muted-foreground">
                                            {dayNames[day.dayOfWeek] || ''} • {day.items?.length || 0} exercícios
                                        </span>
                                    </div>

                                    {day.items && day.items.length > 0 ? (
                                        <div className="divide-y divide-border/50 text-xs">
                                            {day.items.map((item, itemIdx) => (
                                                <div key={item.id || itemIdx} className="py-2 flex items-center justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-foreground truncate">
                                                            {item.exercise?.name || 'Exercício'}
                                                        </p>
                                                        {item.exercise?.muscleGroup && (
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {item.exercise.muscleGroup}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-muted-foreground shrink-0 font-medium">
                                                        <span>{item.sets} séries × {item.reps}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3 text-[#F88022]" />
                                                            {item.rest}s
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Nenhum exercício neste dia.</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                Nenhum dia configurado neste modelo.
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

            {/* Assign Template to Student Modal */}
            <Dialog open={!!assignTemplate} onOpenChange={(open) => !open && setAssignTemplate(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F88022]/10 flex items-center justify-center text-[#F88022]">
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Atribuir Treino a Aluno</DialogTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Prescreva este modelo diretamente na ficha do aluno
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
                                Título do Plano para o Aluno *
                            </label>
                            <Input
                                value={assignTitle}
                                onChange={(e) => setAssignTitle(e.target.value)}
                                placeholder="Ex: Treino Hipertrofia A/B/C"
                                required
                            />
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
                                Confirmar Prescrição
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Confirm Delete Plan Modal */}
            <AlertDialog open={!!planToDelete} onOpenChange={(open) => !open && setPlanToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Plano de Treino</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este plano de treino? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPlanToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeletePlan} className="bg-red-600 hover:bg-red-700">
                            Excluir Plano
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Delete Template Modal */}
            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Modelo de Treino</AlertDialogTitle>
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
