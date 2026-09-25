'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    Search,
    Plus,
    ChevronRight,
    Dumbbell,
    Utensils,
    UserPlus,
    Loader2,
    Trash2,
    CreditCard,
    DollarSign,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    MessageCircle,
    FileText,
    TrendingUp,
    Clock,
    X,
    Edit3,
    Sparkles,
    LayoutGrid,
    Table as TableIcon,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Download,
    Filter
} from 'lucide-react';
import { Card, CardContent, Badge, Avatar, Button, Input, useToast } from '@/components/ui';

interface StudentData {
    id: string;
    userId: string;
    personalId: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    goal?: string | null;
    planType?: string | null;
    planValue?: number | null;
    planExpiresAt?: string | null;
    paymentStatus?: 'PAID' | 'PENDENTE' | 'OVERDUE' | string | null;
    user?: {
        id: string;
        name: string;
        email: string;
        phone?: string | null;
        avatar?: string | null;
    };
    workoutPlans?: Array<{
        id: string;
        title: string;
        workoutDays?: Array<{ id: string; name: string }>;
    }>;
    dietPlans?: Array<{
        id: string;
        title: string;
    }>;
    checkins?: Array<{
        id: string;
        date: string;
        workoutAdherence: number;
        dietAdherence: number;
    }>;
    workoutSessions?: Array<{
        completedAt: string;
        dayName: string;
    }>;
}

type FunnelTab = 'ALL' | 'ACTIVE_GOOD' | 'CHURN_RISK' | 'PAYMENT_ALERT' | 'INACTIVE';
type SortField = 'name' | 'planValue' | 'expiresAt' | 'inactivity';
type SortDirection = 'asc' | 'desc';

export default function StudentsPage() {
    const { toast } = useToast();
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<FunnelTab>('ALL');

    // Phase 2: Dual View, Sorting and Filter States
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
    const [sortField, setSortField] = useState<SortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [planFilter, setPlanFilter] = useState<string>('ALL');
    const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

    // Modals
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [editingContractStudent, setEditingContractStudent] = useState<StudentData | null>(null);
    const [savingContract, setSavingContract] = useState(false);
    const [contractForm, setContractForm] = useState({
        planType: 'MENSAL',
        planValue: '150',
        planExpiresAt: '',
        paymentStatus: 'PAID',
    });

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await fetch('/api/students');
            const result = await response.json();

            if (result.success) {
                setStudents(result.data || []);
            } else {
                setError(result.error || 'Erro ao carregar alunos');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (studentId: string) => {
        try {
            setDeleting(true);
            const response = await fetch(`/api/students/${studentId}`, {
                method: 'DELETE',
            });
            const result = await response.json();

            if (result.success) {
                setStudents(students.filter((s) => s.id !== studentId));
                setDeleteConfirm(null);
                toast.success('Aluno removido com sucesso!');
            } else {
                toast.error(result.error || 'Erro ao excluir aluno');
            }
        } catch (err) {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenContractModal = (student: StudentData) => {
        setEditingContractStudent(student);
        const expiresIso = student.planExpiresAt ? student.planExpiresAt.slice(0, 10) : '';
        setContractForm({
            planType: student.planType || 'MENSAL',
            planValue: String(student.planValue ?? 150),
            planExpiresAt: expiresIso,
            paymentStatus: student.paymentStatus || 'PAID',
        });
    };

    const handleSaveContract = async () => {
        if (!editingContractStudent) return;
        try {
            setSavingContract(true);
            const res = await fetch(`/api/students/${editingContractStudent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planType: contractForm.planType,
                    planValue: parseFloat(contractForm.planValue) || 0,
                    planExpiresAt: contractForm.planExpiresAt
                        ? new Date(contractForm.planExpiresAt).toISOString()
                        : null,
                    paymentStatus: contractForm.paymentStatus,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStudents((prev) =>
                    prev.map((s) => (s.id === editingContractStudent.id ? { ...s, ...data.data } : s))
                );
                toast.success(
                    'Plano atualizado com sucesso!',
                    `${editingContractStudent.user?.name || 'Aluno'} atualizado.`
                );
                setEditingContractStudent(null);
            } else {
                toast.error(data.error || 'Erro ao salvar dados do contrato');
            }
        } catch {
            toast.error('Erro ao conectar com o servidor');
        } finally {
            setSavingContract(false);
        }
    };

    // Helper functions for CRM categorization
    const now = new Date();

    const getInactivityDays = (student: StudentData) => {
        const lastSession = student.workoutSessions?.[0]?.completedAt;
        if (!lastSession) return null;
        return Math.floor((now.getTime() - new Date(lastSession).getTime()) / (24 * 60 * 60 * 1000));
    };

    const isExpiringSoon = (student: StudentData) => {
        if (!student.planExpiresAt) return false;
        const expDate = new Date(student.planExpiresAt);
        const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return diffDays >= 0 && diffDays <= 7;
    };

    const isOverdue = (student: StudentData) => {
        if (student.paymentStatus === 'OVERDUE') return true;
        if (!student.planExpiresAt) return false;
        return new Date(student.planExpiresAt) < now && student.paymentStatus !== 'PAID';
    };

    // CRM Metrics
    const metrics = useMemo(() => {
        const activeStudents = students.filter((s) => s.status === 'ACTIVE');
        const mrr = activeStudents.reduce((sum, s) => sum + (s.planValue || 150), 0);
        const atRiskCount = activeStudents.filter((s) => {
            const inact = getInactivityDays(s);
            return inact === null || inact >= 3;
        }).length;
        const billingAlertCount = activeStudents.filter(
            (s) => isOverdue(s) || isExpiringSoon(s) || s.paymentStatus === 'PENDENTE'
        ).length;

        return {
            total: students.length,
            activeCount: activeStudents.length,
            mrr,
            atRiskCount,
            billingAlertCount,
        };
    }, [students]);

    // Sorting toggle handler
    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Filtering & Sorting
    const sortedStudents = useMemo(() => {
        const filtered = students.filter((student) => {
            const matchesSearch =
                student.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
                student.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                student.user?.phone?.includes(search);

            if (!matchesSearch) return false;

            // Plan filter
            if (planFilter !== 'ALL' && (student.planType || 'MENSAL') !== planFilter) {
                return false;
            }

            // Payment filter
            if (paymentFilter !== 'ALL' && (student.paymentStatus || 'PAID') !== paymentFilter) {
                return false;
            }

            // Funnel tab filter
            if (activeTab === 'ALL') return true;
            if (activeTab === 'ACTIVE_GOOD') {
                const inact = getInactivityDays(student);
                return student.status === 'ACTIVE' && inact !== null && inact < 3;
            }
            if (activeTab === 'CHURN_RISK') {
                const inact = getInactivityDays(student);
                return student.status === 'ACTIVE' && (inact === null || inact >= 3);
            }
            if (activeTab === 'PAYMENT_ALERT') {
                return isOverdue(student) || isExpiringSoon(student) || student.paymentStatus === 'PENDENTE';
            }
            if (activeTab === 'INACTIVE') {
                return student.status === 'INACTIVE' || student.status === 'PAUSED';
            }
            return true;
        });

        // Apply sorting
        return [...filtered].sort((a, b) => {
            let comp = 0;
            if (sortField === 'name') {
                const nameA = a.user?.name || '';
                const nameB = b.user?.name || '';
                comp = nameA.localeCompare(nameB);
            } else if (sortField === 'planValue') {
                const valA = a.planValue ?? 150;
                const valB = b.planValue ?? 150;
                comp = valA - valB;
            } else if (sortField === 'expiresAt') {
                const timeA = a.planExpiresAt ? new Date(a.planExpiresAt).getTime() : 0;
                const timeB = b.planExpiresAt ? new Date(b.planExpiresAt).getTime() : 0;
                comp = timeA - timeB;
            } else if (sortField === 'inactivity') {
                const inactA = getInactivityDays(a) ?? 999;
                const inactB = getInactivityDays(b) ?? 999;
                comp = inactA - inactB;
            }
            return sortDirection === 'asc' ? comp : -comp;
        });
    }, [students, search, activeTab, planFilter, paymentFilter, sortField, sortDirection]);

    const getWhatsAppCobrançaUrl = (student: StudentData) => {
        const cleanPhone = (student.user?.phone || '').replace(/\D/g, '');
        if (!cleanPhone) return null;
        const firstName = student.user?.name?.split(' ')[0] || 'Aluno';
        let msg = '';
        if (isOverdue(student)) {
            msg = `Fala ${firstName}, tudo bem? Passando para te lembrar que a renovação da sua consultoria fitness venceu. Me avise para eu gerar sua chave PIX de renovação e manter seu plano ativo! 💪`;
        } else if (isExpiringSoon(student)) {
            msg = `Fala ${firstName}, tudo bem? Sua consultoria vence nos próximos dias. Vamos garantir a renovação para continuarmos no foco da sua evolução? 👊`;
        } else {
            msg = `Fala ${firstName}, tudo bem? Passando para saber como foram os treinos essa semana e como está o seu ritmo! Tamo junto! 🔥`;
        }
        const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
    };

    const handleExportCSV = () => {
        if (sortedStudents.length === 0) {
            toast.warning('Nenhum aluno para exportar no filtro atual');
            return;
        }

        const headers = [
            'Nome',
            'Email',
            'Telefone',
            'Status Aluno',
            'Plano',
            'Valor (R$)',
            'Status Pagamento',
            'Vencimento',
            'Dias Inativo',
        ];

        const rows = sortedStudents.map((s) => [
            `"${s.user?.name || ''}"`,
            `"${s.user?.email || ''}"`,
            `"${s.user?.phone || ''}"`,
            `"${s.status}"`,
            `"${s.planType || 'MENSAL'}"`,
            s.planValue ?? 150,
            `"${s.paymentStatus || 'PAID'}"`,
            `"${s.planExpiresAt ? s.planExpiresAt.slice(0, 10) : ''}"`,
            getInactivityDays(s) ?? 'Sem registro',
        ]);

        const csvContent =
            'data:text/csv;charset=utf-8,\uFEFF' +
            [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute(
            'download',
            `adrian_fit_alunos_${new Date().toISOString().slice(0, 10)}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Relatório CSV exportado com sucesso!');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-12 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-foreground tracking-tight">
                        CRM de Alunos & Gestão
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                        Visão de alta performance: contratos, faturamento recorrente (MRR), retenção e prescrição
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        className="text-xs h-9 px-3 gap-1.5 rounded-xl border-border"
                        title="Exportar para CSV/Excel"
                    >
                        <Download className="w-4 h-4 text-muted-foreground" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </Button>
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#F88022] text-white rounded-xl text-xs font-semibold hover:bg-[#F88022]/90 transition-colors shadow-xs"
                    >
                        <UserPlus className="w-4 h-4" />
                        Cadastrar Aluno
                    </Link>
                </div>
            </div>

            {/* CRM Financial & Retention KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Faturamento Mensal (MRR)
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">
                            R$ {metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {metrics.activeCount} alunos ativos
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Base de Alunos
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                <UserPlus className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{metrics.total}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {metrics.activeCount} ativos • {metrics.total - metrics.activeCount} pausados
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Risco de Churn
                            </span>
                            <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    metrics.atRiskCount > 0
                                        ? 'bg-red-500/10 text-red-500'
                                        : 'bg-emerald-500/10 text-emerald-500'
                                }`}
                            >
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>
                        <p
                            className={`text-2xl font-black ${
                                metrics.atRiskCount > 0 ? 'text-red-500' : 'text-foreground'
                            }`}
                        >
                            {metrics.atRiskCount}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {metrics.atRiskCount === 0
                                ? 'Nenhum aluno em alerta'
                                : 'Sem treinar há 3+ dias'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                Alertas de Cobrança
                            </span>
                            <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    metrics.billingAlertCount > 0
                                        ? 'bg-amber-500/10 text-amber-500'
                                        : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                <CreditCard className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{metrics.billingAlertCount}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            Vencendo na semana ou atrasados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* CRM Funnel Tabs */}
            <div className="flex gap-1.5 p-1 bg-muted rounded-2xl overflow-x-auto text-xs font-medium">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                        activeTab === 'ALL'
                            ? 'bg-background text-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Todos ({students.length})
                </button>
                <button
                    onClick={() => setActiveTab('ACTIVE_GOOD')}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'ACTIVE_GOOD'
                            ? 'bg-background text-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Treinando no Ritmo
                </button>
                <button
                    onClick={() => setActiveTab('CHURN_RISK')}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'CHURN_RISK'
                            ? 'bg-background text-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Em Risco ({metrics.atRiskCount})
                </button>
                <button
                    onClick={() => setActiveTab('PAYMENT_ALERT')}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        activeTab === 'PAYMENT_ALERT'
                            ? 'bg-background text-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                    Renovação / Cobrança ({metrics.billingAlertCount})
                </button>
                <button
                    onClick={() => setActiveTab('INACTIVE')}
                    className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                        activeTab === 'INACTIVE'
                            ? 'bg-background text-foreground shadow-xs font-semibold'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    Pausados / Inativos
                </button>
            </div>

            {/* Filter Bar & View Toggle */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
                {/* Search */}
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nome, email ou telefone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 text-xs h-9 rounded-xl bg-background"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Filter: Plan */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={planFilter}
                            onChange={(e) => setPlanFilter(e.target.value)}
                            className="bg-background border border-border text-foreground text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                        >
                            <option value="ALL">Todos os Planos</option>
                            <option value="MENSAL">Mensal</option>
                            <option value="TRIMESTRAL">Trimestral</option>
                            <option value="SEMESTRAL">Semestral</option>
                            <option value="ANUAL">Anual</option>
                        </select>
                    </div>

                    {/* Filter: Payment */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="bg-background border border-border text-foreground text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
                        >
                            <option value="ALL">Todos os Status</option>
                            <option value="PAID">Em dia (Pago)</option>
                            <option value="PENDENTE">Pendente</option>
                            <option value="OVERDUE">Atrasado</option>
                        </select>
                    </div>

                    {/* View Switcher: Cards vs Table */}
                    <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-lg transition-colors ${
                                viewMode === 'table'
                                    ? 'bg-card text-[#F88022] shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Visualização em Tabela SaaS"
                        >
                            <TableIcon className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`p-1.5 rounded-lg transition-colors ${
                                viewMode === 'cards'
                                    ? 'bg-card text-[#F88022] shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Visualização em Cards"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Students List: Dual View */}
            {sortedStudents.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                            <Search className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">Nenhum aluno encontrado</h3>
                        <p className="text-xs text-muted-foreground">
                            Tente ajustar seus termos de busca ou selecione outra aba do funil.
                        </p>
                    </CardContent>
                </Card>
            ) : viewMode === 'table' ? (
                /* SaaS Compact Data Table */
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th
                                        className="py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => toggleSort('name')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Aluno</span>
                                            {sortField === 'name' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3 text-[#F88022]" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3 text-[#F88022]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => toggleSort('planValue')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Plano & Valor</span>
                                            {sortField === 'planValue' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3 text-[#F88022]" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3 text-[#F88022]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="py-3 px-4">
                                        <span>Status Pagamento</span>
                                    </th>
                                    <th
                                        className="py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => toggleSort('expiresAt')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Vencimento</span>
                                            {sortField === 'expiresAt' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3 text-[#F88022]" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3 text-[#F88022]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                                            )}
                                        </div>
                                    </th>
                                    <th
                                        className="py-3 px-4 cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => toggleSort('inactivity')}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Último Treino</span>
                                            {sortField === 'inactivity' ? (
                                                sortDirection === 'asc' ? (
                                                    <ArrowUp className="w-3 h-3 text-[#F88022]" />
                                                ) : (
                                                    <ArrowDown className="w-3 h-3 text-[#F88022]" />
                                                )
                                            ) : (
                                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="py-3 px-4">
                                        <span>Adesão Recente</span>
                                    </th>
                                    <th className="py-3 px-4 text-right">
                                        <span>Ações Rápidas</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                                {sortedStudents.map((student) => {
                                    const inactDays = getInactivityDays(student);
                                    const isAtRisk =
                                        student.status === 'ACTIVE' && (inactDays === null || inactDays >= 3);
                                    const overdue = isOverdue(student);
                                    const expiring = isExpiringSoon(student);
                                    const whatsAppUrl = getWhatsAppCobrançaUrl(student);
                                    const latestCheckin = student.checkins?.[0];

                                    return (
                                        <tr
                                            key={student.id}
                                            className="hover:bg-muted/40 transition-colors group"
                                        >
                                            {/* Aluno Column */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar name={student.user?.name || ''} size="sm" />
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={`/personal/students/${student.id}`}
                                                            className="font-bold text-foreground hover:text-[#F88022] transition-colors truncate block text-xs"
                                                        >
                                                            {student.user?.name}
                                                        </Link>
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {student.user?.email}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Plano & Valor Column */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-foreground">
                                                        R$ {(student.planValue || 150).toFixed(2)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                                                        {student.planType || 'MENSAL'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status Pagamento Column */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {overdue ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                                                        Atrasado
                                                    </span>
                                                ) : student.paymentStatus === 'PENDENTE' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        Pendente
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                        Em Dia
                                                    </span>
                                                )}
                                            </td>

                                            {/* Vencimento Column */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {student.planExpiresAt ? (
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-foreground">
                                                            {new Date(student.planExpiresAt).toLocaleDateString(
                                                                'pt-BR'
                                                            )}
                                                        </span>
                                                        {expiring && (
                                                            <span className="text-[10px] text-amber-500 font-semibold">
                                                                Vence em breve
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-[11px]">
                                                        Indeterminado
                                                    </span>
                                                )}
                                            </td>

                                            {/* Último Treino Column */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {inactDays === null ? (
                                                    <span className="text-muted-foreground text-[11px]">
                                                        Sem registro
                                                    </span>
                                                ) : inactDays === 0 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Hoje
                                                    </span>
                                                ) : inactDays === 1 ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Ontem
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`font-semibold ${
                                                            isAtRisk ? 'text-red-500' : 'text-foreground'
                                                        }`}
                                                    >
                                                        Há {inactDays} dias
                                                    </span>
                                                )}
                                            </td>

                                            {/* Adesão Column */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {latestCheckin ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-[#F88022] font-semibold">
                                                            <Dumbbell className="w-3 h-3" />
                                                            {latestCheckin.workoutAdherence}%
                                                        </span>
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-semibold">
                                                            <Utensils className="w-3 h-3" />
                                                            {latestCheckin.dietAdherence}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-[11px]">-</span>
                                                )}
                                            </td>

                                            {/* Ações Column */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {whatsAppUrl && (
                                                        <a
                                                            href={whatsAppUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/15 transition-colors"
                                                            title="WhatsApp"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenContractModal(student)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        title="Editar Contrato"
                                                    >
                                                        <CreditCard className="w-4 h-4" />
                                                    </button>
                                                    <Link
                                                        href={`/personal/students/${student.id}`}
                                                        className="p-1.5 rounded-lg bg-[#F88022]/10 hover:bg-[#F88022]/20 text-[#F88022] transition-colors"
                                                        title="Abrir Ficha 360°"
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteConfirm(student.id)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Excluir Aluno"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Cards Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedStudents.map((student) => {
                        const inactDays = getInactivityDays(student);
                        const isAtRisk =
                            student.status === 'ACTIVE' && (inactDays === null || inactDays >= 3);
                        const overdue = isOverdue(student);
                        const expiring = isExpiringSoon(student);
                        const whatsAppUrl = getWhatsAppCobrançaUrl(student);

                        return (
                            <Card
                                key={student.id}
                                className="relative overflow-hidden border-border hover:border-[#F88022]/40 transition-all flex flex-col justify-between"
                            >
                                <CardContent className="p-5 space-y-4">
                                    {/* Card Top: Avatar, Name, Status Badge */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar name={student.user?.name || ''} size="md" />
                                            <div className="min-w-0">
                                                <Link
                                                    href={`/personal/students/${student.id}`}
                                                    className="font-bold text-foreground hover:text-[#F88022] transition-colors truncate block text-sm"
                                                >
                                                    {student.user?.name}
                                                </Link>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {student.user?.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <Badge
                                                variant={
                                                    student.status === 'ACTIVE'
                                                        ? 'success'
                                                        : student.status === 'PAUSED'
                                                        ? 'warning'
                                                        : 'default'
                                                }
                                            >
                                                {student.status === 'ACTIVE'
                                                    ? 'Ativo'
                                                    : student.status === 'PAUSED'
                                                    ? 'Pausado'
                                                    : 'Inativo'}
                                            </Badge>
                                            <span className="text-[11px] font-bold text-foreground">
                                                R$ {(student.planValue || 150).toFixed(2)}
                                                <span className="text-[10px] text-muted-foreground font-normal">
                                                    /{student.planType === 'ANUAL' ? 'ano' : 'mês'}
                                                </span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* CRM Contract & Rhythm Status Pill */}
                                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 space-y-2 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                                                <Calendar className="w-3 h-3 text-[#F88022]" />
                                                Plano {student.planType || 'MENSAL'}
                                            </span>
                                            {overdue ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/30">
                                                    Atrasado
                                                </span>
                                            ) : student.paymentStatus === 'PENDENTE' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                    Pendente
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                    Em dia
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                                            <span className="text-muted-foreground flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                Último Treino:
                                            </span>
                                            <span
                                                className={`font-semibold ${
                                                    isAtRisk
                                                        ? 'text-red-500'
                                                        : inactDays === 0
                                                        ? 'text-emerald-500'
                                                        : 'text-foreground'
                                                }`}
                                            >
                                                {inactDays === null
                                                    ? 'Nenhum'
                                                    : inactDays === 0
                                                    ? 'Hoje'
                                                    : inactDays === 1
                                                    ? 'Ontem'
                                                    : `Há ${inactDays} dias`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenContractModal(student)}
                                            className="px-2.5 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-medium transition-colors flex items-center gap-1.5"
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                            Plano
                                        </button>

                                        {whatsAppUrl && (
                                            <a
                                                href={whatsAppUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30"
                                            >
                                                <MessageCircle className="w-3.5 h-3.5" />
                                                Cobrar
                                            </a>
                                        )}

                                        <Link
                                            href={`/personal/students/${student.id}`}
                                            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-[#F88022]/10 hover:bg-[#F88022]/20 text-[#F88022] transition-colors text-xs font-semibold text-center ml-auto"
                                        >
                                            Ver Ficha
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal: Editar Contrato & Mensalidade CRM */}
            {editingContractStudent && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="text-base font-bold text-foreground">Gerenciar Plano do Aluno</h3>
                                <p className="text-xs text-muted-foreground">
                                    {editingContractStudent.user?.name}
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingContractStudent(null)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div>
                                <label className="font-semibold text-foreground block mb-1">
                                    Periodicidade do Plano
                                </label>
                                <select
                                    value={contractForm.planType}
                                    onChange={(e) =>
                                        setContractForm({ ...contractForm, planType: e.target.value })
                                    }
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                                >
                                    <option value="MENSAL">Mensal</option>
                                    <option value="TRIMESTRAL">Trimestral</option>
                                    <option value="SEMESTRAL">Semestral</option>
                                    <option value="ANUAL">Anual</option>
                                    <option value="PERSONALIZADO">Personalizado</option>
                                </select>
                            </div>

                            <div>
                                <label className="font-semibold text-foreground block mb-1">
                                    Valor do Plano (R$)
                                </label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={contractForm.planValue}
                                    onChange={(e) =>
                                        setContractForm({ ...contractForm, planValue: e.target.value })
                                    }
                                    placeholder="ex: 150.00"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-foreground block mb-1">
                                    Data de Vencimento / Renovação
                                </label>
                                <Input
                                    type="date"
                                    value={contractForm.planExpiresAt}
                                    onChange={(e) =>
                                        setContractForm({ ...contractForm, planExpiresAt: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-foreground block mb-1">
                                    Status do Pagamento
                                </label>
                                <select
                                    value={contractForm.paymentStatus}
                                    onChange={(e) =>
                                        setContractForm({ ...contractForm, paymentStatus: e.target.value })
                                    }
                                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                                >
                                    <option value="PAID">Em dia (Pago)</option>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="OVERDUE">Atrasado</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <Button variant="outline" onClick={() => setEditingContractStudent(null)}>
                                Cancelar
                            </Button>
                            <Button
                                className="bg-[#F88022] hover:bg-[#F88022]/90 text-white font-semibold"
                                onClick={handleSaveContract}
                                disabled={savingContract}
                            >
                                {savingContract ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : null}
                                Salvar Contrato
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirm Delete */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Excluir Aluno</h3>
                                <p className="text-xs text-muted-foreground">
                                    Esta ação não pode ser desfeita e removerá o histórico.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                className="bg-red-500 hover:bg-red-600 text-white"
                                onClick={() => handleDelete(deleteConfirm)}
                                disabled={deleting}
                            >
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
