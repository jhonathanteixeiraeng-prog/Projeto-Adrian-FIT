'use client';

import { useState } from 'react';
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
    CheckCircle2
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';

export default function CheckinPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        weight: '',
        sleepHours: '',
        energyLevel: 3,
        hungerLevel: 3,
        stressLevel: 3,
        workoutAdherence: 80,
        dietAdherence: 70,
        notes: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setSuccess(true);
        setTimeout(() => {
            router.push('/student/home');
        }, 2000);
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
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${value === num
                                ? `bg-[#F88022] text-white`
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
                className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-secondary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
            </div>
        </div>
    );

    if (success) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-in">
                <div className="w-24 h-24 rounded-full bg-secondary/20 flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12 text-secondary" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Check-in Enviado! ✨</h1>
                <p className="text-muted-foreground text-center">
                    Seu personal irá analisar seu progresso.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Check-in Semanal</h1>
                    <p className="text-sm text-muted-foreground">Como foi sua semana?</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Weight & Sleep */}
                <Card>
                    <CardHeader>
                        <CardTitle>Métricas Básicas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                                    <Scale className="w-4 h-4 text-blue-500" />
                                    Peso (kg)
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="75.5"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                                    <Moon className="w-4 h-4 text-purple-500" />
                                    Sono (horas)
                                </label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    placeholder="7.5"
                                    value={formData.sleepHours}
                                    onChange={(e) => setFormData({ ...formData, sleepHours: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Ratings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Como você se sentiu?</CardTitle>
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
                        <CardTitle>Adesão da Semana</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <PercentageSlider
                            value={formData.workoutAdherence}
                            onChange={(v) => setFormData({ ...formData, workoutAdherence: v })}
                            label="Treino"
                            icon={Dumbbell}
                            color="text-secondary"
                        />
                        <PercentageSlider
                            value={formData.dietAdherence}
                            onChange={(v) => setFormData({ ...formData, dietAdherence: v })}
                            label="Dieta"
                            icon={Utensils}
                            color="text-accent"
                        />
                    </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                    <CardHeader>
                        <CardTitle>Observações</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            placeholder="Como foi sua semana? Alguma dificuldade ou conquista para compartilhar?"
                            className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </CardContent>
                </Card>

                {/* Photo Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle>Fotos de Progresso</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                            {['Frente', 'Lado', 'Costas'].map((angle) => (
                                <button
                                    key={angle}
                                    type="button"
                                    className="aspect-square bg-muted rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border hover:border-secondary transition-colors"
                                >
                                    <Camera className="w-6 h-6 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{angle}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-3">
                            Opcional: tire fotos para acompanhar sua evolução
                        </p>
                    </CardContent>
                </Card>

                {/* Submit */}
                <Button type="submit" variant="secondary" size="lg" className="w-full" loading={loading}>
                    <Send className="w-5 h-5" />
                    Enviar Check-in
                </Button>
            </form>
        </div>
    );
}
