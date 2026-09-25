'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Printer,
    Download,
    Scale,
    TrendingUp,
    TrendingDown,
    Dumbbell,
    Utensils,
    Calendar,
    Ruler,
    Camera,
    CheckCircle2,
    Loader2,
    Shield
} from 'lucide-react';
import { Button } from '@/components/ui';

interface StudentReportData {
    id: string;
    status: string;
    goal: string | null;
    height: number | null;
    weight: number | null;
    gender: string | null;
    birthDate: string | null;
    createdAt: string;
    user: {
        name: string;
        email: string;
        phone: string | null;
    };
    personal?: {
        brandName?: string | null;
        user: {
            name: string;
            email: string;
            phone: string | null;
        };
    };
    checkins: Array<{
        id: string;
        date: string;
        weight: number | null;
        sleepHours?: number | null;
        energyLevel?: number | null;
        hungerLevel?: number | null;
        stressLevel?: number | null;
        workoutAdherence: number;
        dietAdherence: number;
        notes?: string | null;
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
        photos?: Array<{ id: string; url: string; angle: string }>;
    }>;
    progressPhotos?: Array<{
        id: string;
        url: string;
        angle: string;
        weight?: number | null;
        createdAt: string;
    }>;
}

export default function StudentEvolutionReportPage() {
    const params = useParams();
    const router = useRouter();
    const [student, setStudent] = useState<StudentReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (params.id) {
            fetchStudent();
        }
    }, [params.id]);

    const fetchStudent = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/students/${params.id}`);
            const json = await res.json();
            if (json.success) {
                setStudent(json.data);
            } else {
                setError(json.error || 'Erro ao carregar dados do aluno');
            }
        } catch (err) {
            setError('Falha de conexão com o servidor');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#F88022]" />
                <p className="text-sm text-muted-foreground">Gerando relatório de evolução...</p>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="max-w-2xl mx-auto p-6 space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
                    {error || 'Aluno não encontrado'}
                </div>
                <Button onClick={() => router.back()} variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
            </div>
        );
    }

    // Process check-ins ordered chronologically (oldest to newest)
    const sortedCheckins = [...student.checkins].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstCheckin = sortedCheckins[0];
    const latestCheckin = sortedCheckins[sortedCheckins.length - 1];

    const initialWeight = firstCheckin?.weight || student.weight || null;
    const currentWeight = latestCheckin?.weight || student.weight || null;
    const weightDelta = (initialWeight && currentWeight) ? +(currentWeight - initialWeight).toFixed(1) : null;

    // BMI calculation
    const heightInMeters = student.height ? student.height / 100 : null;
    const initialBMI = (initialWeight && heightInMeters) ? +(initialWeight / (heightInMeters * heightInMeters)).toFixed(1) : null;
    const currentBMI = (currentWeight && heightInMeters) ? +(currentWeight / (heightInMeters * heightInMeters)).toFixed(1) : null;

    // Average adherence
    const avgWorkoutAdherence = sortedCheckins.length > 0
        ? Math.round(sortedCheckins.reduce((acc, c) => acc + (c.workoutAdherence || 0), 0) / sortedCheckins.length)
        : 0;
    const avgDietAdherence = sortedCheckins.length > 0
        ? Math.round(sortedCheckins.reduce((acc, c) => acc + (c.dietAdherence || 0), 0) / sortedCheckins.length)
        : 0;

    // Measurements comparison
    const measurementKeys: Array<{ key: keyof typeof firstCheckin; label: string }> = [
        { key: 'chest', label: 'Tórax / Peitoral' },
        { key: 'waist', label: 'Cintura' },
        { key: 'abdomen', label: 'Abdômen' },
        { key: 'hips', label: 'Quadril' },
        { key: 'armRight', label: 'Braço Direito' },
        { key: 'armLeft', label: 'Braço Esquerdo' },
        { key: 'thighRight', label: 'Coxa Direita' },
        { key: 'thighLeft', label: 'Coxa Esquerda' },
        { key: 'calfRight', label: 'Panturrilha Direita' },
        { key: 'calfLeft', label: 'Panturrilha Esquerda' },
        { key: 'bodyFatPercentage', label: '% Gordura (BF)' },
    ];

    const measurementsWithData = measurementKeys.filter(m => {
        return sortedCheckins.some(c => c[m.key] !== null && c[m.key] !== undefined);
    }).map(m => {
        const initialVal = sortedCheckins.find(c => c[m.key] != null)?.[m.key] as number | undefined;
        const currentVal = [...sortedCheckins].reverse().find(c => c[m.key] != null)?.[m.key] as number | undefined;
        const delta = (initialVal != null && currentVal != null) ? +(currentVal - initialVal).toFixed(1) : null;
        return {
            label: m.label,
            isBf: m.key === 'bodyFatPercentage',
            initial: initialVal,
            current: currentVal,
            delta,
        };
    });

    // Photos comparison (oldest vs newest by angle)
    const angles: Array<'FRONT' | 'SIDE' | 'BACK'> = ['FRONT', 'SIDE', 'BACK'];
    const photosComparison = angles.map(angle => {
        const anglePhotos = (student.progressPhotos || []).filter(p => p.angle === angle)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return {
            angle,
            label: angle === 'FRONT' ? 'Frente' : angle === 'SIDE' ? 'Perfil / Lado' : 'Costas',
            before: anglePhotos[0] || null,
            after: anglePhotos.length > 1 ? anglePhotos[anglePhotos.length - 1] : null,
        };
    }).filter(p => p.before || p.after);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-16">
            {/* Top Toolbar - Hidden during print */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border print:hidden shadow-sm">
                <Link
                    href={`/personal/students/${student.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para ficha do aluno
                </Link>
                <div className="flex items-center gap-3">
                    <Button onClick={handlePrint} className="bg-[#F88022] hover:bg-[#F88022]/90 text-white font-medium">
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir / Salvar em PDF
                    </Button>
                </div>
            </div>

            {/* Printable Document Container */}
            <div className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 border border-border rounded-3xl p-6 sm:p-10 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-zinc-900">
                {/* Document Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 print:border-zinc-300">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-xl bg-[#F88022] text-white flex items-center justify-center font-black text-lg">
                                A
                            </div>
                            <span className="text-xl font-black tracking-tight text-[#F88022]">ADRIAN FIT</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Relatório de Evolução Física</h1>
                        <p className="text-xs text-muted-foreground">
                            Acompanhamento de Metas, Métricas Corporais e Adesão ao Planejamento
                        </p>
                    </div>

                    <div className="text-right text-xs space-y-0.5 sm:border-l sm:pl-6 border-zinc-200 dark:border-zinc-800 print:border-zinc-300">
                        <p className="font-semibold text-foreground">
                            Coach: {student.personal?.user?.name || 'Personal Trainer'}
                        </p>
                        {student.personal?.user?.phone && (
                            <p className="text-muted-foreground">{student.personal.user.phone}</p>
                        )}
                        <p className="text-muted-foreground">
                            Emissão: {new Date().toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                </div>

                {/* Student Info Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 print:bg-zinc-50 print:border-zinc-200">
                    <div>
                        <span className="text-xs text-muted-foreground block font-medium">Aluno</span>
                        <strong className="text-sm font-semibold">{student.user.name}</strong>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block font-medium">Objetivo</span>
                        <strong className="text-sm font-semibold">{student.goal || 'Hipertrofia / Performance'}</strong>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block font-medium">Altura</span>
                        <strong className="text-sm font-semibold">{student.height ? `${student.height} cm` : '-'}</strong>
                    </div>
                    <div>
                        <span className="text-xs text-muted-foreground block font-medium">Início do Acompanhamento</span>
                        <strong className="text-sm font-semibold">
                            {new Date(student.createdAt).toLocaleDateString('pt-BR')}
                        </strong>
                    </div>
                </div>

                {/* Key KPIs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Weight Evolution */}
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card space-y-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Scale className="w-3.5 h-3.5 text-blue-500" /> Peso Corporal
                        </span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-xl font-bold">{currentWeight ? `${currentWeight} kg` : '-'}</span>
                            {weightDelta !== null && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                                    weightDelta <= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                                }`}>
                                    {weightDelta > 0 ? `+${weightDelta} kg` : `${weightDelta} kg`}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Inicial: {initialWeight ? `${initialWeight} kg` : '-'}
                        </p>
                    </div>

                    {/* BMI */}
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card space-y-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <TrendingUp className="w-3.5 h-3.5 text-purple-500" /> IMC
                        </span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-xl font-bold">{currentBMI || '-'}</span>
                            {initialBMI && currentBMI && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                                    {(currentBMI - initialBMI) > 0 ? `+${(currentBMI - initialBMI).toFixed(1)}` : (currentBMI - initialBMI).toFixed(1)}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Inicial: {initialBMI || '-'}
                        </p>
                    </div>

                    {/* Workout Adherence */}
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card space-y-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Dumbbell className="w-3.5 h-3.5 text-[#F88022]" /> Média Treino
                        </span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-xl font-bold text-[#F88022]">{avgWorkoutAdherence}%</span>
                            <span className="text-xs font-medium text-muted-foreground">
                                {sortedCheckins.length} check-ins
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Adesão média aos treinos prescritos
                        </p>
                    </div>

                    {/* Diet Adherence */}
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-card space-y-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                            <Utensils className="w-3.5 h-3.5 text-emerald-500" /> Média Dieta
                        </span>
                        <div className="flex items-baseline justify-between">
                            <span className="text-xl font-bold text-emerald-500">{avgDietAdherence}%</span>
                            <span className="text-xs font-medium text-muted-foreground">
                                Consistência
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            Cumprimento do plano alimentar
                        </p>
                    </div>
                </div>

                {/* Body Measurements Evolution Table */}
                {measurementsWithData.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <Ruler className="w-4 h-4 text-emerald-500" />
                                Evolução das Medidas Corporais
                            </h2>
                            <span className="text-xs text-muted-foreground">Valores em centímetros (cm)</span>
                        </div>

                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden print:border-zinc-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-muted-foreground print:bg-zinc-100">
                                        <th className="p-3">Circunferência</th>
                                        <th className="p-3 text-center">Medida Inicial</th>
                                        <th className="p-3 text-center">Medida Atual</th>
                                        <th className="p-3 text-right">Variação (Delta)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {measurementsWithData.map((row, i) => {
                                        const unit = row.isBf ? '%' : ' cm';
                                        return (
                                            <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                                                <td className="p-3 font-medium text-foreground">{row.label}</td>
                                                <td className="p-3 text-center text-muted-foreground">
                                                    {row.initial != null ? `${row.initial}${unit}` : '-'}
                                                </td>
                                                <td className="p-3 text-center font-semibold text-foreground">
                                                    {row.current != null ? `${row.current}${unit}` : '-'}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {row.delta !== null ? (
                                                        <span className={`inline-block font-semibold px-2 py-0.5 rounded-full ${
                                                            row.delta < 0 ? 'bg-emerald-500/10 text-emerald-600' : row.delta > 0 ? 'bg-blue-500/10 text-blue-600' : 'text-muted-foreground'
                                                        }`}>
                                                            {row.delta > 0 ? `+${row.delta}${unit}` : `${row.delta}${unit}`}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Visual Progress - Before and After Photos */}
                {photosComparison.length > 0 && (
                    <div className="space-y-4 break-inside-avoid">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold flex items-center gap-2">
                                <Camera className="w-4 h-4 text-indigo-500" />
                                Comparativo Fotográfico (Antes & Depois)
                            </h2>
                            <span className="text-xs text-muted-foreground">Registros de progresso visual</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {photosComparison.map((item) => (
                                <div key={item.angle} className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 bg-zinc-50 dark:bg-zinc-900/40 space-y-2">
                                    <span className="text-xs font-bold block text-center uppercase tracking-wider text-muted-foreground">
                                        {item.label}
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Before */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-muted-foreground block text-center font-medium">
                                                {item.before ? new Date(item.before.createdAt).toLocaleDateString('pt-BR') : 'Inicial'}
                                            </span>
                                            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-border flex items-center justify-center">
                                                {item.before ? (
                                                    <img
                                                        src={item.before.url}
                                                        alt={`${item.label} Antes`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">Sem foto</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* After */}
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-[#F88022] block text-center font-bold">
                                                {item.after ? new Date(item.after.createdAt).toLocaleDateString('pt-BR') : 'Atual'}
                                            </span>
                                            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 border border-[#F88022]/30 flex items-center justify-center">
                                                {item.after ? (
                                                    <img
                                                        src={item.after.url}
                                                        alt={`${item.label} Atual`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">Aguardando</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Recent Check-in Logs */}
                {sortedCheckins.length > 0 && (
                    <div className="space-y-3 break-inside-avoid">
                        <h2 className="text-base font-bold flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-500" />
                            Histórico Recente de Check-ins
                        </h2>
                        <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden print:border-zinc-200">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 font-semibold text-muted-foreground print:bg-zinc-100">
                                        <th className="p-3">Data</th>
                                        <th className="p-3 text-center">Peso</th>
                                        <th className="p-3 text-center">Sono</th>
                                        <th className="p-3 text-center">Treino</th>
                                        <th className="p-3 text-center">Dieta</th>
                                        <th className="p-3">Observações do Aluno</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {sortedCheckins.slice(-5).reverse().map((c) => (
                                        <tr key={c.id}>
                                            <td className="p-3 font-medium">
                                                {new Date(c.date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="p-3 text-center font-semibold">{c.weight ? `${c.weight} kg` : '-'}</td>
                                            <td className="p-3 text-center text-muted-foreground">{c.sleepHours ? `${c.sleepHours}h` : '-'}</td>
                                            <td className="p-3 text-center font-semibold text-[#F88022]">{c.workoutAdherence}%</td>
                                            <td className="p-3 text-center font-semibold text-emerald-500">{c.dietAdherence}%</td>
                                            <td className="p-3 text-muted-foreground truncate max-w-[200px]">{c.notes || 'Sem observações'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Coach Feedback & Signature Block */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-8 break-inside-avoid print:border-zinc-300">
                    <div className="space-y-2">
                        <h3 className="text-sm font-bold text-foreground">Parecer do Treinador:</h3>
                        <div className="min-h-[80px] p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 text-xs text-muted-foreground">
                            Evolução consistente acompanhada através do protocolo Adrian FIT. Metas de adesão cumpridas dentro da periodicidade estabelecida. Seguir com a progressão da fase vigente.
                        </div>
                    </div>

                    <div className="flex justify-between items-end pt-4">
                        <div className="text-[11px] text-muted-foreground">
                            <p>Adrian FIT App · Plataforma Oficial de Consultoria</p>
                            <p>Relatório gerado em {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="text-center space-y-1">
                            <div className="w-56 border-b border-zinc-400 dark:border-zinc-600 mb-1"></div>
                            <p className="text-xs font-bold text-foreground">
                                {student.personal?.user?.name || 'Personal Trainer'}
                            </p>
                            <p className="text-[10px] text-muted-foreground">Responsável Técnico</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
