'use client';

import React, { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
    CornerDownLeft,
    Keyboard,
    Lock,
    LogOut,
    MessageSquareText,
    Monitor,
    Moon,
    PanelRight,
    Save,
    SlidersHorizontal,
    Sun,
    User,
    type LucideIcon,
} from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers';
import type { ThemePreference } from '@/lib/theme';
import { modKeyLabel } from '@/hooks/use-hotkey';
import { usePageMeta } from '@/components/personal/page-meta';
import { QuickRepliesForm } from '@/components/personal/chat/quick-replies';
import { useContextPanelOpen, useEnterSends, useQuickReplies } from '@/components/personal/chat/preferences';

interface PreferenceToggleProps {
    icon: LucideIcon;
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function PreferenceToggle({ icon: Icon, label, description, checked, onChange }: PreferenceToggleProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-muted p-4">
            <div className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onChange(!checked)}
                className={cn(
                    'relative h-6 min-h-0 w-11 min-w-0 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    checked ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-700'
                )}
            >
                <span
                    className={cn(
                        // left-0: a button centers its content, so without it the knob starts mid-track.
                        'absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )}
                />
            </button>
        </div>
    );
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
    { value: 'system', label: 'Automático', icon: Monitor },
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
];

/** Automático follows the computer (light by day, dark at night); Claro/Escuro fix the theme. */
function ThemePreferenceRow() {
    const { theme, preference, setTheme } = useTheme();
    const description =
        preference === 'system'
            ? `Segue o computador (agora ${theme === 'dark' ? 'escuro' : 'claro'})`
            : preference === 'dark'
              ? 'Sempre escuro'
              : 'Sempre claro';
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted p-4">
            <div className="flex min-w-0 items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5 shrink-0 text-muted-foreground" /> : <Sun className="h-5 w-5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                    <p className="font-medium text-foreground">Tema</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <div role="group" aria-label="Tema" className="flex shrink-0 rounded-lg border border-border bg-card p-0.5">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                        key={value}
                        type="button"
                        aria-pressed={preference === value}
                        onClick={() => setTheme(value)}
                        className={cn(
                            'inline-flex min-h-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            preference === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function SettingsPage() {
    const { data: session, update } = useSession();
    const { toast } = useToast();
    const [enterSends, setEnterSends] = useEnterSends();
    const [isContextPanelOpen, setIsContextPanelOpen] = useContextPanelOpen();
    const [quickReplies, setQuickReplies] = useQuickReplies();
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [modLabel, setModLabel] = useState('Ctrl');

    const [profile, setProfile] = useState({
        name: session?.user?.name || '',
        email: session?.user?.email || '',
        phone: '',
    });

    const [password, setPassword] = useState({
        current: '',
        new: '',
        confirm: '',
    });

    usePageMeta({ title: 'Configurações', breadcrumbs: [{ label: 'Configurações' }] });

    useEffect(() => setModLabel(modKeyLabel()), []);

    // Loaded once: refetching on every session refresh would wipe unsaved edits.
    useEffect(() => {
        let cancelled = false;
        fetch('/api/profile', { cache: 'no-store' })
            .then((response) => response.json())
            .then((result) => {
                if (cancelled || !result?.success) return;
                setProfile({
                    name: result.data.name || '',
                    email: result.data.email || '',
                    phone: result.data.phone || '',
                });
            })
            .catch(() => {
                if (!cancelled) toast.error('Não foi possível carregar seu perfil');
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveProfile = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!profile.name.trim()) {
            toast.error('Informe seu nome');
            return;
        }
        setSavingProfile(true);
        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.trim() }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'Erro ao salvar perfil');
            toast.success('Perfil atualizado');
            await update();
        } catch (reason) {
            toast.error('Não foi possível salvar o perfil', reason instanceof Error ? reason.message : undefined);
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.new.length < 6) {
            toast.error('A nova senha deve ter no mínimo 6 caracteres');
            return;
        }
        if (password.new !== password.confirm) {
            toast.error('As senhas não coincidem', 'Digite a mesma nova senha nos dois campos.');
            return;
        }
        setSavingPassword(true);
        try {
            const response = await fetch('/api/profile/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: password.current, newPassword: password.new }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'Erro ao alterar senha');
            toast.success('Senha alterada');
            setPassword({ current: '', new: '', confirm: '' });
        } catch (reason) {
            toast.error('Não foi possível alterar a senha', reason instanceof Error ? reason.message : undefined);
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-6 pb-8 animate-in">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Configurações</h1>
                <p className="mt-1 text-muted-foreground">Perfil, segurança e preferências de trabalho</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Informações do perfil
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <Input
                            id="settings-name"
                            label="Nome"
                            value={profile.name}
                            onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                            autoComplete="name"
                            required
                        />
                        <Input
                            id="settings-email"
                            type="email"
                            label="E-mail"
                            value={profile.email}
                            disabled
                            helperText="O e-mail de acesso não pode ser alterado por aqui."
                        />
                        <Input
                            id="settings-phone"
                            type="tel"
                            label="Telefone"
                            value={profile.phone}
                            onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                            autoComplete="tel"
                            placeholder="(11) 91234-5678"
                        />
                        <Button type="submit" className="w-full sm:w-auto" loading={savingProfile}>
                            {!savingProfile && <Save className="h-4 w-4" />}
                            Salvar alterações
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Alterar senha
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <Input
                            id="settings-current-password"
                            type="password"
                            label="Senha atual"
                            value={password.current}
                            onChange={(event) => setPassword({ ...password, current: event.target.value })}
                            autoComplete="current-password"
                            required
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Input
                                id="settings-new-password"
                                type="password"
                                label="Nova senha"
                                value={password.new}
                                onChange={(event) => setPassword({ ...password, new: event.target.value })}
                                autoComplete="new-password"
                                helperText="Mínimo de 6 caracteres."
                                required
                            />
                            <Input
                                id="settings-confirm-password"
                                type="password"
                                label="Confirmar nova senha"
                                value={password.confirm}
                                onChange={(event) => setPassword({ ...password, confirm: event.target.value })}
                                autoComplete="new-password"
                                required
                            />
                        </div>
                        <Button type="submit" variant="outline" className="w-full sm:w-auto" loading={savingPassword}>
                            {!savingPassword && <Lock className="h-4 w-4" />}
                            Alterar senha
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <SlidersHorizontal className="h-5 w-5 text-primary" />
                        Preferências
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Salvas neste navegador.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                    <ThemePreferenceRow />
                    <PreferenceToggle
                        icon={CornerDownLeft}
                        label="Enter envia a mensagem no chat"
                        description={
                            enterSends
                                ? 'Shift+Enter quebra a linha.'
                                : `Enter quebra a linha; ${modLabel}+Enter envia.`
                        }
                        checked={enterSends}
                        onChange={setEnterSends}
                    />
                    <PreferenceToggle
                        icon={PanelRight}
                        label="Painel do aluno nas conversas"
                        description="Contrato, último treino, check-in e planos ao lado do chat (telas largas)."
                        checked={isContextPanelOpen}
                        onChange={setIsContextPanelOpen}
                    />
                    <div className="flex items-center justify-between gap-4 rounded-xl bg-muted p-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Keyboard className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <p className="font-medium text-foreground">Atalhos de teclado</p>
                                <p className="text-sm text-muted-foreground">
                                    {modLabel}+K busca alunos e ações; ? mostra todos os atalhos.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => window.dispatchEvent(new Event('personal:open-shortcuts'))}
                            className="shrink-0 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-card"
                        >
                            Ver atalhos
                        </button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareText className="h-5 w-5 text-primary" />
                        Respostas rápidas do chat
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Aparecem acima do campo de mensagem em todas as conversas. As mesmas podem ser editadas pelo próprio chat.
                    </p>
                </CardHeader>
                <CardContent>
                    <QuickRepliesForm
                        initial={quickReplies}
                        onSave={(next) => {
                            setQuickReplies(next);
                            toast.success('Respostas rápidas salvas');
                        }}
                    />
                </CardContent>
            </Card>

            <Card className="border-red-200 dark:border-red-900/60">
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="font-semibold text-foreground">Sair da conta</h3>
                        <p className="text-sm text-muted-foreground">Encerrar sua sessão neste dispositivo</p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                    >
                        <LogOut className="h-5 w-5" />
                        Sair
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
