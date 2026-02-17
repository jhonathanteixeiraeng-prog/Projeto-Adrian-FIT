'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Target } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';

const goalOptions = [
    'Perda de gordura',
    'Hipertrofia',
    'Manutenção do peso',
    'Condicionamento físico',
];

export default function StudentGoalsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [goal, setGoal] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        let active = true;

        const fetchGoal = async () => {
            try {
                const response = await fetch('/api/student/profile');
                const data = await response.json();

                if (active && data?.success) {
                    setGoal(data?.data?.goal || '');
                } else if (active) {
                    setError(data?.error || 'Não foi possível carregar sua meta.');
                }
            } catch {
                if (active) setError('Não foi possível carregar sua meta.');
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchGoal();

        return () => {
            active = false;
        };
    }, []);

    const saveGoal = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/student/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal }),
            });

            const data = await response.json();
            if (!data?.success) {
                setError(data?.error || 'Erro ao salvar meta.');
                return;
            }

            setSuccess('Meta atualizada com sucesso.');
        } catch {
            setError('Erro ao salvar meta.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in pb-8">
            <div className="flex items-center gap-3">
                <Link href="/student/profile" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-foreground">Minhas Metas</h1>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : (
                        <>
                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">Objetivo principal</label>
                                <div className="relative">
                                    <Target className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={goal}
                                        onChange={(e) => setGoal(e.target.value)}
                                        placeholder="Ex: Hipertrofia"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {goalOptions.map((option) => (
                                    <Button
                                        key={option}
                                        type="button"
                                        variant={goal === option ? 'secondary' : 'outline'}
                                        className="justify-start"
                                        onClick={() => setGoal(option)}
                                    >
                                        {option}
                                    </Button>
                                ))}
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                            {success && <p className="text-sm text-green-500">{success}</p>}

                            <Button onClick={saveGoal} disabled={saving} className="w-full" variant="secondary">
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar meta'}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
