'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Scale,
    Dumbbell,
    Utensils,
    Camera,
    Calendar,
    Ruler,
    Plus,
    Split,
    Trash2,
    Loader2,
    SlidersHorizontal,
    FileText
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';

type ProgressTab = 'weight' | 'measurements' | 'photos' | 'adherence';

type StudentProfile = {
    goal: string | null;
    weight: number | null;
};

type CheckinItem = {
    id: string;
    date: string;
    weight: number;
    workoutAdherence: number;
    dietAdherence: number;
    chest?: number | null;
    waist?: number | null;
    abdomen?: number | null;
    hips?: number | null;
    armRight?: number | null;
    armLeft?: number | null;
    thighRight?: number | null;
    thighLeft?: number | null;
    calfRight?: number | null;
    calfLeft?: number | null;
    bodyFatPercentage?: number | null;
    photos?: { id: string; url: string; angle: string }[];
};

type ProgressPhotoItem = {
    id: string;
    url: string;
    angle: string;
    weight?: number | null;
    createdAt: string;
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
    const [checkins, setCheckins] = useState<CheckinItem[]>([]);
    const [photos, setPhotos] = useState<ProgressPhotoItem[]>([]);
    const [photoAngleFilter, setPhotoAngleFilter] = useState<'ALL' | 'FRONT' | 'SIDE' | 'BACK'>('ALL');

    // Before/After comparison state
    const [compareBeforeId, setCompareBeforeId] = useState<string | null>(null);
    const [compareAfterId, setCompareAfterId] = useState<string | null>(null);
    const [sliderPos, setSliderPos] = useState(50); // 0% to 100%
    const [uploadingDirect, setUploadingDirect] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadProgressData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [profileResponse, checkinsResponse, photosResponse] = await Promise.all([
                fetch('/api/student/profile', { cache: 'no-store' }),
                fetch('/api/checkins', { cache: 'no-store' }),
                fetch('/api/student/photos', { cache: 'no-store' }),
            ]);

            const profileResult = await profileResponse.json();
            const checkinsResult = await checkinsResponse.json();
            const photosResult = await photosResponse.json();

            if (!profileResponse.ok || !profileResult?.success) {
                throw new Error(profileResult?.error || 'Não foi possível carregar o perfil.');
            }

            if (!checkinsResponse.ok || !checkinsResult?.success) {
                throw new Error(checkinsResult?.error || 'Não foi possível carregar os check-ins.');
            }

            const rawCheckins = Array.isArray(checkinsResult?.data) ? checkinsResult.data : [];
            setProfile({
                goal: profileResult?.data?.goal ?? null,
                weight: profileResult?.data?.weight ?? null,
            });
            setCheckins(rawCheckins);

            const rawPhotos = Array.isArray(photosResult?.data) ? photosResult.data : [];
            setPhotos(rawPhotos);

            // Pré-seleciona fotos para antes/depois se houver ao menos 2
            if (rawPhotos.length >= 2) {
                setCompareBeforeId(rawPhotos[rawPhotos.length - 1].id);
                setCompareAfterId(rawPhotos[0].id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar evolução.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProgressData();
    }, []);

    const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDirect(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadJson = await uploadRes.json();
            if (!uploadRes.ok || !uploadJson.success) {
                throw new Error(uploadJson.error || 'Erro no upload da foto');
            }

            const photoRes = await fetch('/api/student/photos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: uploadJson.url,
                    angle: photoAngleFilter === 'ALL' ? 'FRONT' : photoAngleFilter,
                    weight: profile?.weight ?? null,
                }),
            });
            const photoJson = await photoRes.json();
            if (!photoRes.ok || !photoJson.success) {
                throw new Error(photoJson.error || 'Erro ao registrar foto');
            }

            await loadProgressData();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Falha ao salvar foto');
        } finally {
            setUploadingDirect(false);
        }
    };

    const handleDeletePhoto = async (id: string) => {
        if (!confirm('Deseja excluir esta foto de progresso?')) return;
        try {
            const res = await fetch(`/api/student/photos/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setPhotos(prev => prev.filter(p => p.id !== id));
            }
        } catch (err) {
            alert('Não foi possível excluir a foto.');
        }
    };

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
            ? Math.round(checkins.reduce((acc, item) => acc + (item.workoutAdherence || 0), 0) / checkins.length)
            : 0;
        const dietAvg = checkins.length
            ? Math.round(checkins.reduce((acc, item) => acc + (item.dietAdherence || 0), 0) / checkins.length)
            : 0;

        return {
            currentWeight,
            startWeight,
            goalWeight,
            weightChange,
            progressToGoal,
            workoutAvg,
            dietAvg,
            latestCheckin,
            oldestCheckin,
        };
    }, [checkins, profile]);

    // Filtragem de fotos
    const filteredPhotos = useMemo(() => {
        if (photoAngleFilter === 'ALL') return photos;
        return photos.filter(p => p.angle === photoAngleFilter);
    }, [photos, photoAngleFilter]);

    const beforePhoto = photos.find(p => p.id === compareBeforeId);
    const afterPhoto = photos.find(p => p.id === compareAfterId);

    // Lista de medidas corporais
    const measurementMetrics = useMemo(() => {
        const latest = progressData.latestCheckin;
        const oldest = progressData.oldestCheckin;
        if (!latest) return [];

        const defs: { key: keyof CheckinItem; label: string; unit: string; invertColor?: boolean }[] = [
            { key: 'chest', label: 'Tórax / Peitoral', unit: 'cm' },
            { key: 'waist', label: 'Cintura', unit: 'cm', invertColor: true },
            { key: 'abdomen', label: 'Abdômen', unit: 'cm', invertColor: true },
            { key: 'hips', label: 'Quadril', unit: 'cm' },
            { key: 'armRight', label: 'Braço Direito', unit: 'cm' },
            { key: 'armLeft', label: 'Braço Esquerdo', unit: 'cm' },
            { key: 'thighRight', label: 'Coxa Direita', unit: 'cm' },
            { key: 'thighLeft', label: 'Coxa Esquerda', unit: 'cm' },
            { key: 'calfRight', label: 'Panturrilha Direita', unit: 'cm' },
            { key: 'calfLeft', label: 'Panturrilha Esquerda', unit: 'cm' },
            { key: 'bodyFatPercentage', label: 'Gordura Corporal (BF)', unit: '%', invertColor: true },
        ];

        return defs
            .map(def => {
                const current = typeof latest[def.key] === 'number' ? (latest[def.key] as number) : null;
                const initial = typeof oldest?.[def.key] === 'number' ? (oldest[def.key] as number) : current;
                const diff = current !== null && initial !== null ? current - initial : null;
                return {
                    label: def.label,
                    unit: def.unit,
                    current,
                    initial,
                    diff,
                    invertColor: def.invertColor,
                };
            })
            .filter(item => item.current !== null);
    }, [progressData]);

    return (
        <div className="space-y-6 animate-in pb-12 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Sua Evolução</h1>
                        <p className="text-sm text-muted-foreground">Métricas, fotos e adesão semana a semana</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/student/report">
                        <Button variant="outline" size="sm" className="gap-1.5 border-border">
                            <FileText className="w-4 h-4 text-[#F88022]" />
                            Relatório PDF
                        </Button>
                    </Link>
                    <Link href="/student/checkin">
                        <Button variant="secondary" size="sm" className="bg-[#F88022] hover:bg-[#e06b10] text-white">
                            <Plus className="w-4 h-4 mr-1" />
                            Novo Check-in
                        </Button>
                    </Link>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                    {error}
                </div>
            )}

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Scale className="w-4 h-4 text-blue-500" />
                        <span>Peso Atual</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        {formatWeight(progressData.currentWeight)}
                    </p>
                    {progressData.weightChange !== null && (
                        <p className={`text-xs flex items-center gap-1 mt-1 font-medium ${progressData.weightChange <= 0 ? 'text-emerald-500' : 'text-blue-500'}`}>
                            {progressData.weightChange <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                            {progressData.weightChange > 0 ? `+${progressData.weightChange.toFixed(1)}kg` : `${progressData.weightChange.toFixed(1)}kg`}
                        </p>
                    )}
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Dumbbell className="w-4 h-4 text-emerald-500" />
                        <span>Média Treinos</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        {progressData.workoutAvg}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Adesão global</p>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Utensils className="w-4 h-4 text-amber-500" />
                        <span>Média Dieta</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        {progressData.dietAvg}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Adesão global</p>
                </Card>

                <Card className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                        <Camera className="w-4 h-4 text-indigo-500" />
                        <span>Fotos Salvas</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        {photos.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Registros visuais</p>
                </Card>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 p-1.5 bg-muted rounded-2xl overflow-x-auto">
                <button
                    onClick={() => setActiveTab('weight')}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'weight'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Scale className="w-4 h-4" />
                    Peso & Meta
                </button>
                <button
                    onClick={() => setActiveTab('measurements')}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'measurements'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Ruler className="w-4 h-4" />
                    Medidas Corporais
                </button>
                <button
                    onClick={() => setActiveTab('photos')}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'photos'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Camera className="w-4 h-4" />
                    Fotos & Comparador
                </button>
                <button
                    onClick={() => setActiveTab('adherence')}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-xs sm:text-sm whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === 'adherence'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Calendar className="w-4 h-4" />
                    Histórico
                </button>
            </div>

            {/* TAB 1: PESO & META */}
            {activeTab === 'weight' && (
                <div className="space-y-4">
                    {progressData.goalWeight !== null && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span>Progresso rumo à meta</span>
                                    <span className="text-sm font-normal text-muted-foreground">
                                        Meta: {progressData.goalWeight}kg
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-[#F88022] to-emerald-500 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${progressData.progressToGoal ?? 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Inicial: {formatWeight(progressData.startWeight)}</span>
                                    <span className="font-semibold text-foreground">
                                        {Math.round(progressData.progressToGoal ?? 0)}% alcançado
                                    </span>
                                    <span>Alvo: {formatWeight(progressData.goalWeight)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Histórico de Pesagens</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {checkins.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Nenhum check-in registrado ainda. Clique em "Novo Check-in" para começar.
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {checkins.map((item, idx) => {
                                        const prev = checkins[idx + 1];
                                        const delta = prev ? item.weight - prev.weight : null;
                                        return (
                                            <div key={item.id} className="py-3 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-sm text-foreground">
                                                        {new Date(item.date).toLocaleDateString('pt-BR', {
                                                            weekday: 'short',
                                                            day: '2-digit',
                                                            month: 'short',
                                                        })}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Sono: {item.weight ? `${item.weight}kg` : '--'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-bold text-base text-foreground">
                                                        {item.weight.toFixed(1)} kg
                                                    </span>
                                                    {delta !== null && (
                                                        <span className={`block text-xs font-medium ${delta <= 0 ? 'text-emerald-500' : 'text-blue-500'}`}>
                                                            {delta > 0 ? `+${delta.toFixed(1)}kg` : `${delta.toFixed(1)}kg`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 2: MEDIDAS CORPORAIS */}
            {activeTab === 'measurements' && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Ruler className="w-5 h-5 text-emerald-500" />
                                    Evolução das Medidas
                                </span>
                                <Link href="/student/checkin">
                                    <Button variant="outline" size="sm" className="text-xs">
                                        Atualizar Medidas
                                    </Button>
                                </Link>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {measurementMetrics.length === 0 ? (
                                <div className="text-center py-10 space-y-3">
                                    <Ruler className="w-10 h-10 text-muted-foreground mx-auto" />
                                    <p className="text-muted-foreground text-sm">
                                        Nenhuma medida corporal registrada nos seus check-ins.
                                    </p>
                                    <Link href="/student/checkin">
                                        <Button variant="secondary" size="sm" className="bg-[#F88022] text-white">
                                            Informar Medidas no Check-in
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {measurementMetrics.map(item => {
                                        const isGood = item.invertColor
                                            ? (item.diff !== null && item.diff < 0)
                                            : (item.diff !== null && item.diff > 0);
                                        const isNeutral = item.diff === 0 || item.diff === null;

                                        return (
                                            <div key={item.label} className="p-3.5 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                                                    <p className="text-lg font-bold text-foreground mt-0.5">
                                                        {item.current} {item.unit}
                                                    </p>
                                                    {item.initial !== null && item.initial !== item.current && (
                                                        <span className="text-[11px] text-muted-foreground">
                                                            Inicial: {item.initial} {item.unit}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.diff !== null && (
                                                    <Badge
                                                        className={`text-xs px-2 py-1 font-semibold ${
                                                            isNeutral
                                                                ? 'bg-muted text-muted-foreground'
                                                                : isGood
                                                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                        }`}
                                                    >
                                                        {item.diff > 0 ? `+${item.diff.toFixed(1)}` : item.diff.toFixed(1)} {item.unit}
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 3: FOTOS & COMPARADOR ANTES / DEPOIS */}
            {activeTab === 'photos' && (
                <div className="space-y-6">
                    {/* Barra de Ações e Filtro de Ângulo */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex gap-1 bg-muted p-1 rounded-xl">
                            {(['ALL', 'FRONT', 'SIDE', 'BACK'] as const).map(angle => (
                                <button
                                    key={angle}
                                    onClick={() => setPhotoAngleFilter(angle)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                        photoAngleFilter === angle
                                            ? 'bg-background text-foreground shadow-xs'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {angle === 'ALL' ? 'Todas' : angle === 'FRONT' ? 'Frente' : angle === 'SIDE' ? 'Lado' : 'Costas'}
                                </button>
                            ))}
                        </div>

                        <div>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleDirectPhotoUpload}
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingDirect}
                                size="sm"
                                className="bg-[#F88022] hover:bg-[#e06b10] text-white"
                            >
                                {uploadingDirect ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="w-4 h-4 mr-1" />
                                        Nova Foto
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* COMPARADOR ANTES / DEPOIS COM SLIDER */}
                    {beforePhoto && afterPhoto && beforePhoto.id !== afterPhoto.id && (
                        <Card className="overflow-hidden border-[#F88022]/30">
                            <CardHeader className="bg-muted/40 pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Split className="w-5 h-5 text-[#F88022]" />
                                        Comparador Interativo Antes & Depois
                                    </CardTitle>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-muted-foreground">Arraste o slider para comparar:</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                {/* Visualizador com Slider Interativo */}
                                <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden select-none bg-black">
                                    {/* Imagem do DEPOIS (Fundo total) */}
                                    <img
                                        src={afterPhoto.url}
                                        alt="Depois"
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none">
                                        Depois • {new Date(afterPhoto.createdAt).toLocaleDateString('pt-BR')}
                                    </div>

                                    {/* Imagem do ANTES (Cortada pelo slider) */}
                                    <div
                                        className="absolute inset-y-0 left-0 overflow-hidden"
                                        style={{ width: `${sliderPos}%` }}
                                    >
                                        <img
                                            src={beforePhoto.url}
                                            alt="Antes"
                                            className="absolute inset-0 w-full h-full object-cover"
                                            style={{
                                                width: '100%',
                                                maxWidth: 'none',
                                            }}
                                        />
                                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-full pointer-events-none">
                                            Antes • {new Date(beforePhoto.createdAt).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>

                                    {/* Linha divisora do Slider */}
                                    <div
                                        className="absolute inset-y-0 w-1 bg-white shadow-2xl pointer-events-none"
                                        style={{ left: `${sliderPos}%` }}
                                    >
                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-black">
                                            <SlidersHorizontal className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* Input invisível para toque/arrasto */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={sliderPos}
                                        onChange={(e) => setSliderPos(Number(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                                    />
                                </div>

                                {/* Seletores de quais fotos comparar */}
                                <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-xs">
                                    <div>
                                        <label className="text-muted-foreground block mb-1">Foto Antes:</label>
                                        <select
                                            value={compareBeforeId || ''}
                                            onChange={(e) => setCompareBeforeId(e.target.value)}
                                            className="w-full bg-muted border border-border rounded-lg p-2 text-foreground"
                                        >
                                            {photos.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {new Date(p.createdAt).toLocaleDateString('pt-BR')} ({p.angle})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-muted-foreground block mb-1">Foto Depois:</label>
                                        <select
                                            value={compareAfterId || ''}
                                            onChange={(e) => setCompareAfterId(e.target.value)}
                                            className="w-full bg-muted border border-border rounded-lg p-2 text-foreground"
                                        >
                                            {photos.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {new Date(p.createdAt).toLocaleDateString('pt-BR')} ({p.angle})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Galeria de Fotos */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between">
                                <span>Galeria de Evolução</span>
                                <span className="text-xs text-muted-foreground font-normal">
                                    {filteredPhotos.length} fotos
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredPhotos.length === 0 ? (
                                <div className="text-center py-10 space-y-3">
                                    <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                                    <p className="text-muted-foreground text-sm">
                                        Nenhuma foto registrada para este ângulo.
                                    </p>
                                    <Button
                                        onClick={() => fileInputRef.current?.click()}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Adicionar Foto
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {filteredPhotos.map(photo => (
                                        <div
                                            key={photo.id}
                                            className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-black/40 border border-border"
                                        >
                                            <img
                                                src={photo.url}
                                                alt={photo.angle}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-2.5 flex flex-col justify-between">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                                                        {photo.angle === 'FRONT' ? 'Frente' : photo.angle === 'SIDE' ? 'Lado' : 'Costas'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="text-white text-xs">
                                                    <p className="font-semibold">
                                                        {new Date(photo.createdAt).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    {photo.weight && (
                                                        <p className="text-[11px] text-white/80">{photo.weight}kg</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB 4: ADESÃO & HISTÓRICO */}
            {activeTab === 'adherence' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Histórico Completo de Check-ins</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {checkins.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                                Nenhum check-in registrado.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {checkins.map(checkin => (
                                    <div key={checkin.id} className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <p className="font-semibold text-foreground text-sm">
                                                {new Date(checkin.date).toLocaleDateString('pt-BR', {
                                                    weekday: 'long',
                                                    day: '2-digit',
                                                    month: 'long',
                                                })}
                                            </p>
                                            <span className="text-sm font-bold text-foreground">
                                                {checkin.weight.toFixed(1)}kg
                                            </span>
                                        </div>

                                        <div className="flex gap-4 text-xs">
                                            <span className="text-emerald-500 font-medium">
                                                Treino: {checkin.workoutAdherence}%
                                            </span>
                                            <span className="text-blue-500 font-medium">
                                                Dieta: {checkin.dietAdherence}%
                                            </span>
                                            {checkin.photos && checkin.photos.length > 0 && (
                                                <span className="text-indigo-400 font-medium flex items-center gap-1">
                                                    <Camera className="w-3 h-3" />
                                                    {checkin.photos.length} fotos
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
