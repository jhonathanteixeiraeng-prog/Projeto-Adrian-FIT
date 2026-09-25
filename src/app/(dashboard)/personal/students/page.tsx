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
    paymentStatus?: 'PAID' | 'PENDENTE' | 'PAID' | 'OVERDUE' | string | null;
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

export default function StudentsPage() {
    const { toast } = useToast();
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<FunnelTab>('ALL');

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
                setStudents(students.filter(s => s.id !== studentId));
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
                    planExpiresAt: contractForm.planExpiresAt ? new Date(contractForm.planExpiresAt).toISOString() : null,
                    paymentStatus: contractForm.paymentStatus,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStudents(prev =>
                    prev.map(s => s.id === editingContractStudent.id ? { ...s, ...data.data } : s)
                );
                toast.success('Plano atualizado com sucesso!', `${editingContractStudent.user?.name || 'Aluno'} atualizado.`);
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
        const activeStudents = students.filter(s => s.status === 'ACTIVE');
        const mrr = activeStudents.reduce((sum, s) => sum + (s.planValue || 150), 0);
        const atRiskCount = activeStudents.filter(s => {
            const inact = getInactivityDays(s);
            return inact === null || inact >= 3;
        }).length;
        const billingAlertCount = activeStudents.filter(s => isOverdue(s) || isExpiringSoon(s) || s.paymentStatus === 'PENDENTE').length;

        return {
            total: students.length,
            activeCount: activeStudents.length,
            mrr,
            atRiskCount,
            billingAlertCount,
        };
    }, [students]);

    // Filtering by Funnel Tab
    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            const matchesSearch =
                student.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
                student.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
                student.user?.phone?.includes(search);

            if (!matchesSearch) return false;

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
    }, [students, search, activeTab]);

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
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                        CRM de Alunos & Gestão
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                        Visão executiva de contratos, faturamento, retenção e prescrições
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/personal/students/new"
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F88022] text-white rounded-xl font-medium hover:bg-[#F88022]/90 transition-colors shadow-sm"
                    >
                        <UserPlus className="w-5 h-5" />
                        Cadastrar Aluno
                    </Link>
                </div>
            </div>

            {/* CRM Financial & Retention KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Faturamento Mensal (MRR)
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">
                            R$ {metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {metrics.activeCount} consultorias ativas
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Alunos Ativos
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{metrics.activeCount}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {metrics.total} alunos cadastrados no total
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Risco de Churn
                            </span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${metrics.atRiskCount > 0 ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-foreground">{metrics.atRiskCount}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {metrics.atRiskCount > 0 ? 'Alunos sem treinar há >3 dias' : 'Todos treinando no ritmo!'}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Alertas de Cobrança
                            </span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${metrics.billingAlertCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
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

            {/* CRM Funnel Tabs & Search Bar */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Funnel Tabs */}
                    <div className="flex gap-1.5 p-1 bg-muted rounded-2xl overflow-x-auto text-xs font-medium">
                        <button
                            onClick={() => setActiveTab('ALL')}
                            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'ALL' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Todos ({students.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('ACTIVE_GOOD')}
                            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'ACTIVE_GOOD' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Treinando no Ritmo
                        </button>
                        <button
                            onClick={() => setActiveTab('CHURN_RISK')}
                            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'CHURN_RISK' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Em Risco ({metrics.atRiskCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('PAYMENT_ALERT')}
                            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'PAYMENT_ALERT' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                            Renovação / Cobrança ({metrics.billingAlertCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('INACTIVE')}
                            className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === 'INACTIVE' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Pausados / Inativos
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome, email ou telefone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 text-xs h-10 rounded-xl"
                        />
                    </div>
                </div>
            </div>

            {/* Students CRM Cards Grid */}
            {filteredStudents.length === 0 ? (
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
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map((student) => {
                        const inactDays = getInactivityDays(student);
                        const isAtRisk = student.status === 'ACTIVE' && (inactDays === null || inactDays >= 3);
                        const overdue = isOverdue(student);
                        const expiring = isExpiringSoon(student);
                        const whatsAppUrl = getWhatsAppCobrançaUrl(student);

                        return (
                            <Card key={student.id} className="relative overflow-hidden border-border hover:border-[#F88022]/40 transition-all flex flex-col justify-between">
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
                                                <p className="text-[11px] text-muted-foreground truncate">{student.user?.email}</p>
                                                {student.user?.phone && (
                                                    <p className="text-[10px] text-muted-foreground/80">{student.user.phone}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant={student.status === 'ACTIVE' ? 'success' : 'default'}>
                                                {student.status === 'ACTIVE' ? 'Ativo' : student.status === 'PAUSED' ? 'Pausado' : 'Inativo'}
                                            </Badge>
                                            {isAtRisk && (
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                                                    {inactDays != null ? `${inactDays}d sem treinar` : 'Sem treino'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contract / Financial Box */}
                                    <div className="p-3 rounded-xl bg-muted/60 border border-border space-y-1.5 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground font-medium flex items-center gap-1">
                                                <CreditCard className="w-3.5 h-3.5 text-[#F88022]" />
                                                Plano {student.planType || 'MENSAL'}
                                            </span>
                                            <strong className="text-foreground">
                                                R$ {(student.planValue ?? 150).toFixed(2)}
                                            </strong>
                                        </div>
                                        <div className="flex items-center justify-between pt-0.5">
                                            <span className="text-[11px] text-muted-foreground">
                                                Vencimento: {student.planExpiresAt ? new Date(student.planExpiresAt).toLocaleDateString('pt-BR') : 'Não definido'}
                                            </span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                overdue
                                                    ? 'bg-red-500/15 text-red-500'
                                                    : expiring
                                                    ? 'bg-amber-500/15 text-amber-600'
                                                    : 'bg-emerald-500/15 text-emerald-600'
                                            }`}>
                                                {overdue ? 'ATRASADO' : expiring ? 'VENCENDO' : 'EM DIA'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Prescriptions & Activity Summary */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="p-2.5 rounded-xl border border-border bg-card">
                                            <span className="text-[10px] text-muted-foreground block font-medium">Ficha Ativa</span>
                                            <strong className="text-foreground text-[11px] truncate block mt-0.5">
                                                {student.workoutPlans?.[0]?.title || 'Sem ficha'}
                                            </strong>
                                        </div>
                                        <div className="p-2.5 rounded-xl border border-border bg-card">
                                            <span className="text-[10px] text-muted-foreground block font-medium">Último Treino</span>
                                            <strong className={`text-[11px] truncate block mt-0.5 ${inactDays && inactDays >= 3 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {inactDays === null ? 'Nunca treinou' : inactDays === 0 ? 'Hoje' : inactDays === 1 ? 'Ontem' : `Há ${inactDays} dias`}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            {whatsAppUrl && (
                                                <a
                                                    href={whatsAppUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors border border-emerald-500/30"
                                                    title="Enviar WhatsApp"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </a>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => handleOpenContractModal(student)}
                                                className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                                                title="Editar Contrato / Mensalidade"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <Link
                                                href={`/personal/students/${student.id}/report`}
                                                className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-colors border border-border"
                                                title="Gerar Relatório PDF"
                                            >
                                                <FileText className="w-4 h-4" />
                                            </Link>
                                        </div>

                                        <Link
                                            href={`/personal/students/${student.id}`}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#F88022]/10 hover:bg-[#F88022]/20 text-[#F88022] font-semibold text-xs transition-colors"
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
                                <p className="text-xs text-muted-foreground">{editingContractStudent.user?.name}</p>
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
                                <label className="font-semibold text-foreground block mb-1">Periodicidade do Plano</label>
                                <select
                                    value={contractForm.planType}
                                    onChange={(e) => setContractForm({ ...contractForm, planType: e.target.value })}
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
                                <label className="font-semibold text-foreground block mb-1">Valor do Plano (R$)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={contractForm.planValue}
                                    onChange={(e) => setContractForm({ ...contractForm, planValue: e.target.value })}
                                    placeholder="ex: 150.00"
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-foreground block mb-1">Data de Vencimento / Renovação</label>
                                <Input
                                    type="date"
                                    value={contractForm.planExpiresAt}
                                    onChange={(e) => setContractForm({ ...contractForm, planExpiresAt: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="font-semibold text-foreground block mb-1">Status do Pagamento</label>
                                <select
                                    value={contractForm.paymentStatus}
                                    onChange={(e) => setContractForm({ ...contractForm, paymentStatus: e.target.value })}
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
                                {savingContract ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                Salvar Contrato
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
