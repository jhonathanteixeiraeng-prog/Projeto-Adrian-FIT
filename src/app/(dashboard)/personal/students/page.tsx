'use client';

import { useState, useEffect } from 'react';
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
    MoreVertical,
    X
} from 'lucide-react';
import { Card, CardContent, Badge, Avatar, Button, Input } from '@/components/ui';

interface StudentData {
    id: string;
    userId: string;
    personalId: string;
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
    goal?: string;
    user?: {
        id: string;
        name: string;
        email: string;
        phone?: string;
    };
}

const statusConfig = {
    ACTIVE: { label: 'Ativo', variant: 'success' as const },
    INACTIVE: { label: 'Inativo', variant: 'danger' as const },
    PAUSED: { label: 'Pausado', variant: 'warning' as const },
};

export default function StudentsPage() {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
            } else {
                alert(result.error || 'Erro ao excluir aluno');
            }
        } catch (err) {
            alert('Erro ao conectar com o servidor');
        } finally {
            setDeleting(false);
        }
    };

    const filteredStudents = students.filter((student) => {
        const matchesSearch = student.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
            student.user?.email?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in w-full max-w-full overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Meus Alunos</h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie todos os seus alunos em um só lugar
                    </p>
                </div>
                <Link href="/personal/students/new">
                    <Button className="w-full sm:w-auto bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                        <UserPlus className="w-5 h-5" />
                        Novo Aluno
                    </Button>
                </Link>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar por nome ou e-mail..."
                                className="pl-12"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full lg:w-auto px-4 py-3 bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-[#F88022]"
                            >
                                <option value="all">Todos os status</option>
                                <option value="ACTIVE">Ativos</option>
                                <option value="PAUSED">Pausados</option>
                                <option value="INACTIVE">Inativos</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Students List */}
            <div className="space-y-3">
                {filteredStudents.map((student) => (
                    <Card key={student.id} hover className="mb-3 relative overflow-hidden">
                        <CardContent className="p-4">
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                                <Link href={`/personal/students/${student.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                                    <Avatar name={student.user?.name || ''} size="lg" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                                            <h3 className="font-semibold text-foreground truncate">
                                                {student.user?.name}
                                            </h3>
                                            <Badge variant={statusConfig[student.status]?.variant || 'info'} className="shrink-0">
                                                {statusConfig[student.status]?.label || student.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            {student.user?.email}
                                        </p>
                                        {student.goal && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Objetivo: {student.goal}
                                            </p>
                                        )}
                                    </div>
                                    <div className="hidden lg:flex items-center gap-6 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Dumbbell className="w-4 h-4" />
                                            <span>--</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Utensils className="w-4 h-4" />
                                            <span>--</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                                </Link>

                                {/* Actions Menu */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === student.id ? null : student.id);
                                        }}
                                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                                    </button>

                                    {openMenuId === student.id && (
                                        <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[150px]">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setDeleteConfirm(student.id);
                                                    setOpenMenuId(null);
                                                }}
                                                className="w-full px-4 py-3 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Excluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredStudents.length === 0 && !loading && (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                Nenhum aluno encontrado
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                {search ? 'Tente buscar com outros termos' : 'Comece adicionando seu primeiro aluno'}
                            </p>
                            {!search && (
                                <Link href="/personal/students/new">
                                    <Button className="bg-[#F88022] hover:bg-[#F88022]/90 text-white">
                                        <Plus className="w-5 h-5" />
                                        Adicionar Aluno
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    Mostrando {filteredStudents.length} de {students.length} alunos
                </span>
                <button
                    onClick={fetchStudents}
                    className="text-[#F88022] hover:underline"
                >
                    Atualizar lista
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-foreground">Excluir Aluno</h3>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-muted-foreground">
                            Tem certeza que deseja excluir este aluno? Esta ação não pode ser desfeita.
                        </p>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                                onClick={() => handleDelete(deleteConfirm)}
                                loading={deleting}
                            >
                                <Trash2 className="w-5 h-5" />
                                Excluir
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
