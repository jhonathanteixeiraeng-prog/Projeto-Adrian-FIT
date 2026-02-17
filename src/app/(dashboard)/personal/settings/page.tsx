'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import {
    User,
    Mail,
    Phone,
    Lock,
    Save,
    LogOut,
    Loader2,
    Check,
    Moon,
    Sun,
    Bell
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@/components/ui';
import { useTheme } from '@/components/providers';

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const { theme, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [notifications, setNotifications] = useState(true);

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        phone: '',
    });

    const [password, setPassword] = useState({
        current: '',
        new: '',
        confirm: '',
    });

    useEffect(() => {
        if (session?.user) {
            setProfile({
                name: session.user.name || '',
                email: session.user.email || '',
                phone: '',
            });
        }
        fetchProfile();
    }, [session]);

    const fetchProfile = async () => {
        try {
            const response = await fetch('/api/profile');
            const result = await response.json();
            if (result.success) {
                setProfile({
                    name: result.data.name || '',
                    email: result.data.email || '',
                    phone: result.data.phone || '',
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess('Perfil atualizado com sucesso!');
                await update(); // Refresh session
            } else {
                setError(result.error || 'Erro ao salvar perfil');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (password.new !== password.confirm) {
            setError('As senhas não coincidem');
            return;
        }

        if (password.new.length < 6) {
            setError('A nova senha deve ter no mínimo 6 caracteres');
            return;
        }

        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const response = await fetch('/api/profile/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: password.current,
                    newPassword: password.new,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess('Senha alterada com sucesso!');
                setPassword({ current: '', new: '', confirm: '' });
            } else {
                setError(result.error || 'Erro ao alterar senha');
            }
        } catch (err) {
            setError('Erro ao conectar com o servidor');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        signOut({ callbackUrl: '/login' });
    };

    return (
        <div className="space-y-6 animate-in max-w-2xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Configurações</h1>
                <p className="text-muted-foreground mt-1">
                    Gerencie seu perfil e preferências
                </p>
            </div>

            {success && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    {success}
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Profile Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="w-5 h-5 text-[#F88022]" />
                        Informações do Perfil
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Seu nome"
                            className="pl-12"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                        />
                    </div>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="email"
                            placeholder="Seu e-mail"
                            className="pl-12"
                            value={profile.email}
                            disabled
                        />
                    </div>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="tel"
                            placeholder="Seu telefone"
                            className="pl-12"
                            value={profile.phone}
                            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        />
                    </div>
                    <Button
                        onClick={handleSaveProfile}
                        className="w-full bg-[#F88022] hover:bg-[#F88022]/90 text-white"
                        loading={saving}
                    >
                        <Save className="w-5 h-5" />
                        Salvar Alterações
                    </Button>
                </CardContent>
            </Card>

            {/* Password Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-[#F88022]" />
                        Alterar Senha
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        type="password"
                        placeholder="Senha atual"
                        value={password.current}
                        onChange={(e) => setPassword({ ...password, current: e.target.value })}
                    />
                    <Input
                        type="password"
                        placeholder="Nova senha"
                        value={password.new}
                        onChange={(e) => setPassword({ ...password, new: e.target.value })}
                    />
                    <Input
                        type="password"
                        placeholder="Confirmar nova senha"
                        value={password.confirm}
                        onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                    />
                    <Button
                        onClick={handleChangePassword}
                        variant="outline"
                        className="w-full"
                        loading={saving}
                    >
                        <Lock className="w-5 h-5" />
                        Alterar Senha
                    </Button>
                </CardContent>
            </Card>

            {/* Preferences Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-[#F88022]" />
                        Preferências
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-3">
                            {theme === 'dark' ? (
                                <Moon className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <Sun className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div>
                                <p className="font-medium text-foreground">Modo Escuro</p>
                                <p className="text-sm text-muted-foreground">
                                    {theme === 'dark' ? 'Tema escuro ativado' : 'Tema claro ativado'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className={`w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-[#F88022]' : 'bg-muted-foreground/30'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl">
                        <div className="flex items-center gap-3">
                            <Bell className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium text-foreground">Notificações</p>
                                <p className="text-sm text-muted-foreground">Receber alertas</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setNotifications(!notifications)}
                            className={`w-12 h-6 rounded-full transition-colors ${notifications ? 'bg-[#F88022]' : 'bg-muted-foreground/30'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Logout Section */}
            <Card className="border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-foreground">Sair da conta</h3>
                            <p className="text-sm text-muted-foreground">
                                Encerrar sua sessão neste dispositivo
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            className="text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-5 h-5" />
                            Sair
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
