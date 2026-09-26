'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Dumbbell, Mail, MailCheck } from 'lucide-react';
import { Button, Input } from '@/components/ui';

/** "Esqueci minha senha": asks for the account's e-mail and sends a link to create a new password. */
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState<string | null>(null);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setSending(true);
        try {
            const response = await fetch('/api/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const body = await response.json().catch(() => null);
            if (!response.ok || !body?.success) throw new Error(body?.error || 'Não foi possível enviar. Tente de novo.');
            setSent(body.message);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Não foi possível enviar. Tente de novo.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm animate-in">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-[#F88022] text-white shadow-lg shadow-[#F88022]/30">
                        <Dumbbell className="h-8 w-8" />
                    </div>
                    <h1 className="mb-2 text-2xl font-bold text-foreground">Esqueci minha senha</h1>
                    <p className="text-muted-foreground">Informe o e-mail da sua conta. Enviamos um link para você criar uma nova senha.</p>
                </div>

                {sent ? (
                    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm text-foreground" role="status">
                        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#F88022]" />
                        <p>{sent}</p>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-5">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400" role="alert">
                                {error}
                            </div>
                        )}
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="email"
                                required
                                autoComplete="email"
                                aria-label="E-mail"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="pl-12"
                            />
                        </div>
                        <Button type="submit" className="w-full bg-[#F88022] text-white hover:bg-[#e07018]" size="lg" loading={sending}>
                            Enviar link
                        </Button>
                    </form>
                )}

                <div className="mt-8 text-center">
                    <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para o login
                    </Link>
                </div>
            </div>
        </div>
    );
}
