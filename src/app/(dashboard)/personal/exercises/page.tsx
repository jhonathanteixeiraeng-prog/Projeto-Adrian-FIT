'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Play,
    Edit,
    Trash2,
    MoreVertical,
    Video,
    Dumbbell,
    ChevronDown,
    Upload,
    X,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { Card, CardContent, Button, Badge, Input, Select, Dialog, DialogContent, DialogHeader, DialogTitle, AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui';

const muscleGroups = ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas', 'Core', 'Glúteos'];
const difficulties = ['INICIANTE', 'INTERMEDIARIO', 'AVANCADO'];
const difficultyLabels: Record<string, string> = {
    'INICIANTE': 'Iniciante',
    'INTERMEDIARIO': 'Intermediário',
    'AVANCADO': 'Avançado',
};
const equipments = [
    // Pesos Livres
    'Barra Reta',
    'Barra W',
    'Barra H (Triceps)',
    'Halteres',
    'Kettlebell',
    'Anilhas',

    // Máquinas de Pernas
    'Leg Press 45°',
    'Leg Press Horizontal',
    'Cadeira Extensora',
    'Mesa Flexora',
    'Cadeira Flexora',
    'Cadeira Adutora',
    'Cadeira Abdutora',
    'Hack Machine',
    'Smith Machine',
    'Panturrilha Sentado',
    'Panturrilha em Pé',

    // Máquinas Superiores
    'Supino Máquina',
    'Chest Press',
    'Fly Machine (Peck Deck)',
    'Pulldown',
    'Remada Máquina',
    'Shoulder Press Máquina',
    'Crucifixo Máquina',

    // Cabos e Polias
    'Cross Over',
    'Polia Alta',
    'Polia Baixa',
    'Polia Dupla',
    'Cabo (Geral)',

    // Outros Equipamentos
    'Banco Reto',
    'Banco Inclinado',
    'Banco Declinado',
    'Banco Scott',
    'Banco Romano',
    'GHD (Glute Ham Developer)',
    'Prancha de Abdominais',
    'Rolo de Abdominais',
    'Bola Suíça',
    'Bosu',
    'TRX / Suspensão',
    'Elástico / Resistance Band',
    'Corda de Pular',

    // Cardio
    'Esteira',
    'Bicicleta Ergométrica',
    'Elíptico',
    'Remo Ergométrico',

    // Corpo Livre
    'Peso Corporal',
    'Barra Fixa',
    'Paralelas',
];

interface Exercise {
    id: string;
    name: string;
    muscleGroup: string;
    equipment: string | null;
    difficulty: string;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    instructions: string | null;
    tips: string | null;
    createdAt: string;
}

export default function ExercisesPage() {
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMuscle, setFilterMuscle] = useState('');
    const [filterDifficulty, setFilterDifficulty] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        muscleGroup: '',
        equipment: '',
        customEquipment: '',
        difficulty: 'INICIANTE',
        videoUrl: '',
        instructions: '',
        tips: '',
    });

    // Fetch exercises on mount
    useEffect(() => {
        fetchExercises();
    }, []);

    const fetchExercises = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/exercises');
            const result = await res.json();

            if (res.ok && result.success) {
                setExercises(result.data);
            } else {
                console.error('Failed to fetch exercises:', result.error);
            }
        } catch (error) {
            console.error('Error fetching exercises:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesMuscle = !filterMuscle || ex.muscleGroup === filterMuscle;
        const matchesDifficulty = !filterDifficulty || ex.difficulty === filterDifficulty;
        return matchesSearch && matchesMuscle && matchesDifficulty;
    });

    const openCreateModal = () => {
        setEditingExercise(null);
        setFormData({
            name: '',
            muscleGroup: '',
            equipment: '',
            customEquipment: '',
            difficulty: 'INICIANTE',
            videoUrl: '',
            instructions: '',
            tips: '',
        });
        setShowModal(true);
    };

    const openEditModal = (exercise: Exercise) => {
        setEditingExercise(exercise);
        // Check if the equipment is a custom one (not in predefined list)
        const isCustomEquipment = exercise.equipment && !equipments.includes(exercise.equipment);
        setFormData({
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            equipment: isCustomEquipment ? 'Outro' : (exercise.equipment || ''),
            customEquipment: isCustomEquipment ? (exercise.equipment || '') : '',
            difficulty: exercise.difficulty,
            videoUrl: exercise.videoUrl || '',
            instructions: exercise.instructions || '',
            tips: exercise.tips || '',
        });
        setShowModal(true);
        setOpenMenuId(null);
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.muscleGroup) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        // Determine the final equipment value
        const finalEquipment = formData.equipment === 'Outro'
            ? formData.customEquipment
            : formData.equipment;

        const submitData = {
            name: formData.name,
            muscleGroup: formData.muscleGroup,
            equipment: finalEquipment,
            difficulty: formData.difficulty,
            videoUrl: formData.videoUrl,
            instructions: formData.instructions,
            tips: formData.tips,
        };

        setSaving(true);
        try {
            if (editingExercise) {
                // Update existing
                const res = await fetch(`/api/exercises/${editingExercise.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                });
                if (res.ok) {
                    await fetchExercises();
                    setShowModal(false);
                }
            } else {
                // Create new
                const res = await fetch('/api/exercises', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                });
                if (res.ok) {
                    await fetchExercises();
                    setShowModal(false);
                }
            }
        } catch (error) {
            console.error('Error saving exercise:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/exercises/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setExercises(exercises.filter(ex => ex.id !== id));
            }
        } catch (error) {
            console.error('Error deleting exercise:', error);
        }
        setShowDeleteConfirm(null);
        setOpenMenuId(null);
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'INICIANTE': return 'success';
            case 'INTERMEDIARIO': return 'warning';
            case 'AVANCADO': return 'error';
            default: return 'default';
        }
    };

    return (
        <div className="space-y-6 animate-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Biblioteca de Exercícios</h1>
                    <p className="text-muted-foreground">Gerencie seus exercícios com vídeos demonstrativos</p>
                </div>
                <Button onClick={openCreateModal}>
                    <Plus className="w-5 h-5" />
                    Novo Exercício
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar exercício..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select
                    value={filterMuscle}
                    onChange={(e) => setFilterMuscle(e.target.value)}
                    options={[
                        { value: '', label: 'Todos os músculos' },
                        ...muscleGroups.map(m => ({ value: m, label: m }))
                    ]}
                    className="w-full sm:w-40"
                />
                <Select
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                    options={[
                        { value: '', label: 'Todas dificuldades' },
                        ...difficulties.map(d => ({ value: d, label: d }))
                    ]}
                    className="w-full sm:w-40"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Dumbbell className="w-6 h-6 text-secondary mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">{exercises.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <Video className="w-6 h-6 text-accent mx-auto mb-2" />
                        <p className="text-2xl font-bold text-foreground">
                            {exercises.filter(e => e.videoUrl).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Com Vídeo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">
                            {new Set(exercises.map(e => e.muscleGroup)).size}
                        </p>
                        <p className="text-xs text-muted-foreground">Grupos Musculares</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">
                            {exercises.filter(e => e.difficulty === 'Iniciante').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Para Iniciantes</p>
                    </CardContent>
                </Card>
            </div>

            {/* Exercise Grid */}
            {filteredExercises.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                            Nenhum exercício encontrado
                        </h3>
                        <p className="text-muted-foreground mb-4">
                            {searchTerm || filterMuscle || filterDifficulty
                                ? 'Tente ajustar os filtros'
                                : 'Adicione seu primeiro exercício'}
                        </p>
                        <Button onClick={openCreateModal}>
                            <Plus className="w-5 h-5" />
                            Adicionar Exercício
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExercises.map((exercise) => (
                        <Card key={exercise.id} className="overflow-hidden hover:border-secondary/50 transition-colors">
                            {/* Video Thumbnail */}
                            <div className="aspect-video bg-muted relative">
                                {exercise.videoUrl ? (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                                                <Play className="w-6 h-6 text-primary ml-1" />
                                            </div>
                                        </div>
                                        <a
                                            href={exercise.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute bottom-2 right-2 p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4 text-white" />
                                        </a>
                                    </>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                                        <Video className="w-10 h-10 text-muted-foreground/50" />
                                        <span className="text-xs text-muted-foreground">Sem vídeo</span>
                                    </div>
                                )}
                            </div>

                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <h3 className="font-semibold text-foreground">{exercise.name}</h3>
                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenMenuId(openMenuId === exercise.id ? null : exercise.id)}
                                            className="p-1 hover:bg-muted rounded-lg transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                        </button>

                                        {openMenuId === exercise.id && (
                                            <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
                                                <button
                                                    onClick={() => openEditModal(exercise)}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(exercise.id)}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-500"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Excluir
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 mb-3">
                                    <Badge variant="info">{exercise.muscleGroup}</Badge>
                                    <Badge variant={getDifficultyColor(exercise.difficulty) as any}>
                                        {exercise.difficulty}
                                    </Badge>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                    {exercise.instructions}
                                </p>

                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Dumbbell className="w-3 h-3" />
                                    {exercise.equipment}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-4 border-b border-border bg-card">
                        <DialogTitle className="text-lg font-semibold text-foreground">
                            {editingExercise ? 'Editar Exercício' : 'Novo Exercício'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4 bg-card">
                        <Input
                            label="Nome do Exercício *"
                            placeholder="Ex: Supino Reto"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Select
                                label="Grupo Muscular *"
                                value={formData.muscleGroup}
                                onChange={(e) => setFormData({ ...formData, muscleGroup: e.target.value })}
                                options={[
                                    { value: '', label: 'Selecione' },
                                    ...muscleGroups.map(m => ({ value: m, label: m }))
                                ]}
                            />
                            <Select
                                label="Dificuldade"
                                value={formData.difficulty}
                                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                                options={difficulties.map(d => ({ value: d, label: d }))}
                            />
                        </div>

                        <Select
                            label="Equipamento"
                            value={formData.equipment}
                            onChange={(e) => setFormData({ ...formData, equipment: e.target.value, customEquipment: '' })}
                            options={[
                                { value: '', label: 'Selecione um equipamento' },
                                ...equipments.map(e => ({ value: e, label: e })),
                                { value: 'Outro', label: '+ Outro (personalizado)' }
                            ]}
                        />

                        {formData.equipment === 'Outro' && (
                            <Input
                                label="Nome do Equipamento Personalizado *"
                                placeholder="Ex: Máquina de Glúteos, Aparelho XYZ..."
                                value={formData.customEquipment}
                                onChange={(e) => setFormData({ ...formData, customEquipment: e.target.value })}
                            />
                        )}

                        <Input
                            label="URL do Vídeo (YouTube, Vimeo, etc)"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={formData.videoUrl}
                            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                        />

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Instruções de Execução
                            </label>
                            <textarea
                                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all resize-none"
                                rows={3}
                                placeholder="Descreva como executar o exercício corretamente..."
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Dicas e Observações
                            </label>
                            <textarea
                                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all resize-none"
                                rows={2}
                                placeholder="Dicas para melhor execução, erros comuns a evitar..."
                                value={formData.tips}
                                onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-border flex justify-end gap-2 bg-card">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                editingExercise ? 'Salvar Alterações' : 'Criar Exercício'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <AlertDialog open={!!showDeleteConfirm} onOpenChange={(open) => !open && setShowDeleteConfirm(null)}>
                <AlertDialogContent className="max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Exercício</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir este exercício? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white border-none"
                            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
                        >
                            Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
