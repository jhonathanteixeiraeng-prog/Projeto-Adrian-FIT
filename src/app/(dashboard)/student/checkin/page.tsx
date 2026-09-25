'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Scale,
    Moon,
    Zap,
    Brain,
    Utensils,
    Dumbbell,
    Camera,
    Send,
    CheckCircle2,
    Ruler,
    X,
    Loader2,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';

type PhotoSlot = {
    angle: 'FRONT' | 'SIDE' | 'BACK';
    label: string;
    url: string | null;
    uploading: boolean;
};

export default function CheckinPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showMeasurements, setShowMeasurements] = useState(false);
    const [adherenceData, setAdherenceData] = useState<{
        workout: { adherence: number; summary: string };
        diet: { adherence: number; summary: string };
    } | null>(null);

    const [photos, setPhotos] = useState<PhotoSlot[]>([
        { angle: 'FRONT', label: 'Frente', url: null, uploading: false },
        { angle: 'SIDE', label: 'Lado', url: null, uploading: false },
        { angle: 'BACK', label: 'Costas', url: null, uploading: false },
    ]);

    const fileInputRefs = {
        FRONT: useRef<HTMLInputElement>(null),
        SIDE: useRef<HTMLInputElement>(null),
        BACK: useRef<HTMLInputElement>(null),
    };

    const [formData, setFormData] = useState({
        weight: '',
        sleepHours: '',
        energyLevel: 3,
        hungerLevel: 3,
        stressLevel: 3,
        workoutAdherence: 80,
        dietAdherence: 70,
        notes: '',
        // Medidas corporais (cm)
        chest: '',
        waist: '',
        abdomen: '',
        hips: '',
        armRight: '',
        armLeft: '',
        thighRight: '',
        thighLeft: '',
        calfRight: '',
        calfLeft: '',
        bodyFatPercentage: '',
    });

    useEffect(() => {
        fetch('/api/student/adherence')
            .then(res => res.json())
            .then(json => {
                if (json?.success && json?.data) {
                    setAdherenceData(json.data);
                    setFormData(prev => ({
                        ...prev,
                        workoutAdherence: json.data.workout.adherence,
                        dietAdherence: json.data.diet.adherence,
                    }));
                }
            })
            .catch(err => {
                console.warn('Não foi possível calcular adesão automaticamente:', err);
            });
    }, []);

    const handleFileUpload = async (angle: 'FRONT' | 'SIDE' | 'BACK', file: File) => {
        setPhotos(prev => prev.map(p => p.angle === angle ? { ...p, uploading: true } : p));
        setError(null);

        try {
            const uploadData = new FormData();
            uploadData.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: uploadData,
            });

            const result = await res.json();
            if (!res.ok || !result.success) {
                throw new Error(result.error || 'Falha ao enviar foto');
            }

            setPhotos(prev => prev.map(p => p.angle === angle ? { ...p, url: result.url, uploading: false } : p));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro no envio da foto');
            setPhotos(prev => prev.map(p => p.angle === angle ? { ...p, uploading: false } : p));
        }
    };

    const removePhoto = (angle: 'FRONT' | 'SIDE' | 'BACK') => {
        setPhotos(prev => prev.map(p => p.angle === angle ? { ...p, url: null } : p));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.weight || !formData.sleepHours) {
            setError('Preencha seu peso atual e as horas de sono.');
            return;
        }

        setLoading(true);

        try {
            const uploadedPhotosPayload = photos
                .filter(p => !!p.url)
                .map(p => ({ url: p.url!, angle: p.angle }));

            const response = await fetch('/api/checkins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    weight: formData.weight,
                    sleepHours: formData.sleepHours,
                    energyLevel: formData.energyLevel,
                    hungerLevel: formData.hungerLevel,
                    stressLevel: formData.stressLevel,
                    workoutAdherence: formData.workoutAdherence,
                    dietAdherence: formData.dietAdherence,
                    notes: formData.notes,
                    chest: formData.chest || null,
                    waist: formData.waist || null,
                    abdomen: formData.abdomen || null,
                    hips: formData.hips || null,
                    armRight: formData.armRight || null,
                    armLeft: formData.armLeft || null,
                    thighRight: formData.thighRight || null,
                    thighLeft: formData.thighLeft || null,
                    calfRight: formData.calfRight || null,
                    calfLeft: formData.calfLeft || null,
                    bodyFatPercentage: formData.bodyFatPercentage || null,
                    photos: uploadedPhotosPayload,
                }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erro ao enviar check-in');
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/student/progress');
            }, 1800);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao enviar check-in.');
        } finally {
            setLoading(false);
        }
    };

    const RatingSelector = ({
        value,
        onChange,
        label,
        icon: Icon,
        color
    }: {
        value: number;
        onChange: (v: number) => void;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
    }) => (
        <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${color}`} />
                <span className="font-medium text-foreground">{label}</span>
            </div>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                    <button
                        key={num}
                        type="button"
                        onClick={() => onChange(num)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all duration-200 touch-bounce ${value === num
                            ? `bg-[#F88022] text-white shadow-glow-orange scale-105`
                            : 'bg-muted text-muted-foreground hover:bg-muted/70'
                            }`}
                    >
                        {num}
                    </button>
                ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>Muito baixo</span>
                <span>Muito alto</span>
            </div>
        </div>
    );

    const PercentageSlider = ({
        value,
        onChange,
        label,
        icon: Icon,
        color,
    }: {
        value: number;
        onChange: (v: number) => void;
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
    }) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${color}`} />
                    <span className="font-medium text-foreground">{label}</span>
                </div>
                <span className="text-lg font-bold text-foreground">{value}%</span>
            </div>
            <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-[#F88022]"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
            </div>
        </div>
    );

    if (success) {
        return (
            <div className="min-h-full flex flex-col items-center justify-center p-4 animate-in">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Check-in Enviado! ✨</h1>
                <p className="text-muted-foreground text-center">
                    Seu progresso foi registrado e seu personal já foi notificado.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-12 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/progress" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Check-in Semanal</h1>
                    <p className="text-sm text-muted-foreground">Registre sua evolução para o seu personal</p>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 stagger-in">
                {/* Weight & Sleep */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Scale className="w-5 h-5 text-[#F88022]" />
                            Métricas Fundamentais
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                                    <Scale className="w-4 h-4 text-blue-500" />
                                    Peso atual (kg)*
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="ex: 75.5"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                                    <Moon className="w-4 h-4 text-purple-500" />
                                    Sono por noite (h)*
                                </label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="ex: 7.5"
                                    value={formData.sleepHours}
                                    onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Medidas Corporais (Expansível) */}
                <Card>
                    <CardHeader className="cursor-pointer select-none" onClick={() => setShowMeasurements(!showMeasurements)}>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Ruler className="w-5 h-5 text-emerald-500" />
                                Medidas Corporais (cm)
                                <span className="text-xs font-normal text-muted-foreground ml-1">Opcional</span>
                            </CardTitle>
                            <button type="button" className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
                                {showMeasurements ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                        </div>
                    </CardHeader>
                    {showMeasurements && (
                        <CardContent className="space-y-4 pt-0">
                            <p className="text-xs text-muted-foreground">
                                Meça com fita métrica relaxada para acompanhar mudanças na circunferência.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tórax / Peitoral</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.chest}
                                        onChange={(e) => setFormData({ ...formData, chest: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cintura</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.waist}
                                        onChange={(e) => setFormData({ ...formData, waist: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Abdômen</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.abdomen}
                                        onChange={(e) => setFormData({ ...formData, abdomen: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Quadril</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.hips}
                                        onChange={(e) => setFormData({ ...formData, hips: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Braço Direito</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.armRight}
                                        onChange={(e) => setFormData({ ...formData, armRight: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Braço Esquerdo</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.armLeft}
                                        onChange={(e) => setFormData({ ...formData, armLeft: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Coxa Direita</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.thighRight}
                                        onChange={(e) => setFormData({ ...formData, thighRight: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Coxa Esquerda</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        placeholder="cm"
                                        value={formData.thighLeft}
                                        onChange={(e) => setFormData({ ...formData, thighLeft: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">% Gordura (BF)</label>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        placeholder="%"
                                        value={formData.bodyFatPercentage}
                                        onChange={(e) => setFormData({ ...formData, bodyFatPercentage: e.target.value })}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>

                {/* Fotos de Progresso com Upload Real */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Camera className="w-5 h-5 text-indigo-500" />
                                Fotos de Progresso
                            </span>
                            <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-[#F88022]" /> Salvas na nuvem
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                            {photos.map((slot) => (
                                <div key={slot.angle} className="space-y-1 text-center">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/heic"
                                        className="hidden"
                                        ref={fileInputRefs[slot.angle]}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleFileUpload(slot.angle, file);
                                        }}
                                    />

                                    {slot.url ? (
                                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border group bg-black/40">
                                            <img
                                                src={slot.url}
                                                alt={slot.label}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removePhoto(slot.angle)}
                                                className="absolute top-1.5 right-1.5 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors"
                                                title="Remover foto"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRefs[slot.angle].current?.click()}
                                            disabled={slot.uploading}
                                            className="w-full aspect-[3/4] bg-muted/60 hover:bg-muted rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-[#F88022] transition-colors p-2"
                                        >
                                            {slot.uploading ? (
                                                <Loader2 className="w-6 h-6 text-[#F88022] animate-spin" />
                                            ) : (
                                                <>
                                                    <Camera className="w-6 h-6 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground font-medium">Adicionar</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                    <span className="text-xs font-medium text-foreground block">{slot.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            Dica: use luz natural e mantenha a mesma postura nas fotos semanais.
                        </p>
                    </CardContent>
                </Card>

                {/* Ratings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Como você se sentiu na semana?</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <RatingSelector
                            value={formData.energyLevel}
                            onChange={(v) => setFormData({ ...formData, energyLevel: v })}
                            label="Nível de Energia"
                            icon={Zap}
                            color="text-yellow-500"
                        />
                        <RatingSelector
                            value={formData.hungerLevel}
                            onChange={(v) => setFormData({ ...formData, hungerLevel: v })}
                            label="Nível de Fome"
                            icon={Utensils}
                            color="text-orange-500"
                        />
                        <RatingSelector
                            value={formData.stressLevel}
                            onChange={(v) => setFormData({ ...formData, stressLevel: v })}
                            label="Nível de Estresse"
                            icon={Brain}
                            color="text-red-500"
                        />
                    </CardContent>
                </Card>

                {/* Adherence */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                            <span>Adesão ao Planejado</span>
                            {adherenceData && (
                                <span className="text-xs font-normal text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1 border border-emerald-500/20">
                                    <Sparkles className="w-3.5 h-3.5" /> Calculada automaticamente
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {adherenceData && (
                            <div className="p-3 bg-muted/60 rounded-xl text-xs space-y-1 text-muted-foreground border border-border">
                                <p className="text-foreground font-medium flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#F88022]" />
                                    Baseado no seu histórico real dos últimos 7 dias:
                                </p>
                                <p>• <strong>Treino:</strong> {adherenceData.workout.summary}</p>
                                <p>• <strong>Dieta:</strong> {adherenceData.diet.summary}</p>
                                <p className="text-[11px] text-muted-foreground/80 mt-1">
                                    Você pode ajustar as porcentagens abaixo se desejar.
                                </p>
                            </div>
                        )}
                        <PercentageSlider
                            value={formData.workoutAdherence}
                            onChange={(v) => setFormData({ ...formData, workoutAdherence: v })}
                            label="Adesão aos Treinos"
                            icon={Dumbbell}
                            color="text-emerald-500"
                        />
                        <PercentageSlider
                            value={formData.dietAdherence}
                            onChange={(v) => setFormData({ ...formData, dietAdherence: v })}
                            label="Adesão à Dieta"
                            icon={Utensils}
                            color="text-blue-500"
                        />
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Comentários para o Personal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            placeholder="Conte como foi sua rotina, dores musculares, dificuldades ou comemorações da semana..."
                            className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#F88022] resize-none h-24 text-sm"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </CardContent>
                </Card>

                {/* Submit */}
                <Button
                    type="submit"
                    variant="secondary"
                    size="lg"
                    className="w-full bg-gradient-to-r from-[#F88022] to-[#e06b10] text-white border-0 shadow-glow-orange touch-bounce py-6 text-base font-semibold"
                    loading={loading}
                >
                    <Send className="w-5 h-5 mr-2" />
                    Enviar Check-in Semanal
                </Button>
            </form>
        </div>
    );
}
