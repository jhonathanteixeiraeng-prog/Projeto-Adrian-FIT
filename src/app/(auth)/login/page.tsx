'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dumbbell, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { loginSchema, LoginInput } from '@/lib/validations';

export default function LoginPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginInput) => {
        setError('');

        const result = await signIn('credentials', {
            email: data.email,
            password: data.password,
            redirect: false,
        });

        if (result?.error) {
            setError(result.error);
            return;
        }

        // Fetch session to get user role
        const sessionResponse = await fetch('/api/auth/session');
        const session = await sessionResponse.json();

        // Redirect based on role
        if (session?.user?.role === 'PERSONAL') {
            router.push('/personal/dashboard');
        } else {
            router.push('/student/home');
        }
        router.refresh();
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left side - Branding */}
            <div className="lg:w-1/2 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f1a] p-8 lg:p-12 flex flex-col justify-between min-h-[300px] lg:min-h-screen relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-10 w-64 h-64 bg-[#F88022] rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-48 h-48 bg-[#F88022] rounded-full blur-3xl" />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-14 h-14 rounded-xl bg-[#F88022] flex items-center justify-center shadow-lg shadow-[#F88022]/30">
                            <Dumbbell className="w-8 h-8" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Adrian Santos</h1>
                            <p className="text-sm text-gray-400">Personal Trainer</p>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block text-white relative z-10">
                    <h2 className="text-4xl font-bold mb-4 leading-tight">
                        Transforme seu corpo,<br />
                        <span className="text-[#F88022]">transforme sua vida</span>
                    </h2>
                    <p className="text-lg text-gray-300">
                        Acompanhamento personalizado para alcançar seus objetivos de forma eficiente e saudável.
                    </p>
                </div>

                <div className="hidden lg:flex items-center gap-6 text-white/80 relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F88022]" />
                        <span>Treinos personalizados</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F88022]" />
                        <span>Dieta sob medida</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F88022]" />
                        <span>Acompanhamento diário</span>
                    </div>
                </div>
            </div>

            {/* Right side - Login Form */}
            <div className="lg:w-1/2 p-8 lg:p-12 flex items-center justify-center bg-background">
                <div className="w-full max-w-md animate-in">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-foreground mb-2">Bem-vindo!</h2>
                        <p className="text-muted-foreground">Entre com suas credenciais para acessar</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="seu@email.com"
                                className="pl-12"
                                error={errors.email?.message}
                                {...register('email')}
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Sua senha"
                                className="pl-12 pr-12"
                                error={errors.password?.message}
                                {...register('password')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-border accent-[#F88022]" />
                                <span className="text-muted-foreground">Lembrar de mim</span>
                            </label>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-[#F88022] hover:bg-[#e07018] text-white"
                            size="lg"
                            loading={isSubmitting}
                        >
                            Entrar
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Credenciais fornecidas pelo seu Personal Trainer
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
