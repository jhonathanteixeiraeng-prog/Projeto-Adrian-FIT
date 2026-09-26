'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Dumbbell, Eye, EyeOff, Lock } from 'lucide-react';
import { Button, Input } from '@/components/ui';

type Stage = 'loading' | 'form' | 'invalid' | 'done';

/** Sets the new password from the "Esqueci minha senha" e-mail (/reset-password?token=…). */
export function ResetPasswordForm() {
    const [token, setToken] = useState('');
    const [stage, setStage] = useState<Stage>('loading');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const value = new URLSearchParams(window.location.search).get('token') ?? '';
        setToken(value);
        setStage(value ? 'form' : 'invalid');
    }, []);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        if (password.length < 6) {
            setError('A nova senha deve ter no mínimo 6 caracteres');
            return;
        }
        if (password !== confirm) {
            setError('As duas senhas não são iguais');
            return;
        }
        setSaving(true);
        try {
            const response = await fetch('/api/password-reset/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const body = await response.json().catch(() => null);
            if (body?.code === 'INVALID_LINK') {
                setStage('invalid');
                return;
            }
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Não foi possível criar a nova senha. Tente de novo.');
            // The link is spent: take it out of the address bar and the history.
            window.history.replaceState(null, '', '/reset-password');
            setStage('done');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível criar a nova senha. Tente de novo.');
        } finally {
            setSaving(false);
        }
    };

    const heading =
        stage === 'done' ? 'Senha criada' : stage === 'invalid' ? 'Link inválido' : 'Criar nova senha';
    const lead =
        stage === 'done'
            ? 'Pronto. Entre com a nova senha; os aparelhos que estavam conectados vão pedir login de novo.'
            : stage === 'invalid'
              ? 'Este link expirou ou já foi usado. Peça um novo: ele vale por 1 hora.'
              : 'Escolha a nova senha da sua conta.';

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm animate-in">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F88022] text-white shadow-lg shadow-[#F88022]/30">
                        {stage === 'done' ? <CheckCircle2 className="h-8 w-8" /> : <Dumbbell className="h-8 w-8" />}
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-foreground">{heading}</h1>
                    {stage !== 'loading' && <p className="text-muted-foreground">{lead}</p>}
                </div>

                {stage === 'form' && (
                    <form onSubmit={submit} className="space-y-5">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" role="alert">
                                {error}
                            </div>
                        )}
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                aria-label="Nova senha"
                                placeholder="Nova senha (mínimo 6 caracteres)"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="pl-12 pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                aria-label="Repita a nova senha"
                                placeholder="Repita a nova senha"
                                value={confirm}
                                onChange={(event) => setConfirm(event.target.value)}
                                className="pl-12"
                            />
                        </div>
                        <Button type="submit" className="w-full bg-[#F88022] text-white hover:bg-[#e07018]" size="lg" loading={saving}>
                            Criar nova senha
                        </Button>
                    </form>
                )}

                {stage === 'done' && (
                    <Link
                        href="/login"
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F88022] font-semibold text-white transition-colors hover:bg-[#e07018]"
                    >
                        Entrar
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                )}

                {stage === 'invalid' && (
                    <Link
                        href="/forgot-password"
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#F88022] font-semibold text-white transition-colors hover:bg-[#e07018]"
                    >
                        Pedir um novo link
                        <ArrowRight className="h-5 w-5" />
                    </Link>
                )}

                {stage !== 'done' && (
                    <div className="mt-8 text-center">
                        <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                            Voltar para o login
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
