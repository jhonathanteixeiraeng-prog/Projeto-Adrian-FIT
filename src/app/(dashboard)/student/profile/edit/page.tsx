'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, User, Mail, Phone } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@/components/ui';

interface ProfileData {
    name: string;
    email: string;
    phone: string;
}

export default function StudentProfileEditPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [profile, setProfile] = useState<ProfileData>({
        name: '',
        email: '',
        phone: '',
    });

    useEffect(() => {
        let active = true;

        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/profile');
                const data = await response.json();

                if (active && data?.success && data?.data) {
                    setProfile({
                        name: data.data.name || '',
                        email: data.data.email || '',
                        phone: data.data.phone || '',
                    });
                } else if (active) {
                    setError(data?.error || 'Não foi possível carregar seus dados.');
                }
            } catch {
                if (active) setError('Não foi possível carregar seus dados.');
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchProfile();

        return () => {
            active = false;
        };
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: profile.name.trim(),
                    phone: profile.phone.trim(),
                }),
            });

            const data = await response.json();
            if (!data?.success) {
                setError(data?.error || 'Erro ao salvar os dados.');
                return;
            }

            setSuccess('Dados atualizados com sucesso.');
        } catch {
            setError('Erro ao salvar os dados.');
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
                <h1 className="text-xl font-bold text-foreground">Dados Pessoais</h1>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Carregando...</p>
                    ) : (
                        <>
                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">Nome</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={profile.name}
                                        onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                                        placeholder="Seu nome"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">E-mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={profile.email}
                                        disabled
                                        placeholder="Seu e-mail"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">Telefone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={profile.phone}
                                        onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                            {success && <p className="text-sm text-green-500">{success}</p>}

                            <Button onClick={handleSave} disabled={saving} className="w-full" variant="secondary">
                                <Save className="w-4 h-4" />
                                {saving ? 'Salvando...' : 'Salvar alterações'}
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
