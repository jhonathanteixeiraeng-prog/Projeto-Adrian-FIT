'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dumbbell, Mail, Lock, User, Phone, Eye, EyeOff, ArrowRight, UserCog, GraduationCap } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { registerSchema, RegisterInput } from '@/lib/validations';

export default function RegisterPage() {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<RegisterInput>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            role: 'STUDENT',
        },
    });

    const selectedRole = watch('role');

    const onSubmit = async (data: RegisterInput) => {
        setError('');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!result.success) {
                setError(result.error);
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch {
            setError('Erro ao criar conta. Tente novamente.');
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-8">
                <div className="text-center animate-in">
                    <div className="w-20 h-20 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
                        <Dumbbell className="w-10 h-10 text-secondary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Conta criada com sucesso!</h2>
                    <p className="text-muted-foreground">Redirecionando para o login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row">
            {/* Left side - Branding */}
            <div className="lg:w-1/2 gradient-primary p-8 lg:p-12 flex flex-col justify-between min-h-[200px] lg:min-h-screen">
                <div>
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                            <Dumbbell className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Enerflux</h1>
                            <p className="text-sm text-primary-200">Fit Coach</p>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:block text-white">
                    <h2 className="text-4xl font-bold mb-4">
                        Comece sua jornada fitness hoje
                    </h2>
                    <p className="text-lg text-primary-200">
                        Seja você personal trainer ou aluno, nossa plataforma conecta vocês para resultados incríveis.
                    </p>
                </div>

                <div className="hidden lg:block" />
            </div>

            {/* Right side - Register Form */}
            <div className="lg:w-1/2 p-8 lg:p-12 flex items-center justify-center bg-background overflow-y-auto">
                <div className="w-full max-w-md animate-in">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-foreground mb-2">Criar conta</h2>
                        <p className="text-muted-foreground">Preencha os dados para começar</p>
                    </div>

                    {/* Role Selection */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                            type="button"
                            onClick={() => setValue('role', 'PERSONAL')}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${selectedRole === 'PERSONAL'
                                    ? 'border-secondary bg-secondary/10'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                        >
                            <UserCog className={`w-8 h-8 mx-auto mb-2 ${selectedRole === 'PERSONAL' ? 'text-secondary' : 'text-muted-foreground'}`} />
                            <p className={`font-medium ${selectedRole === 'PERSONAL' ? 'text-secondary' : 'text-foreground'}`}>
                                Personal Trainer
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Gerenciar alunos</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setValue('role', 'STUDENT')}
                            className={`p-4 rounded-xl border-2 transition-all duration-200 ${selectedRole === 'STUDENT'
                                    ? 'border-secondary bg-secondary/10'
                                    : 'border-border hover:border-muted-foreground'
                                }`}
                        >
                            <GraduationCap className={`w-8 h-8 mx-auto mb-2 ${selectedRole === 'STUDENT' ? 'text-secondary' : 'text-muted-foreground'}`} />
                            <p className={`font-medium ${selectedRole === 'STUDENT' ? 'text-secondary' : 'text-foreground'}`}>
                                Aluno
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Acompanhar treinos</p>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Seu nome completo"
                                className="pl-12"
                                error={errors.name?.message}
                                {...register('name')}
                            />
                        </div>

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
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="tel"
                                placeholder="(11) 99999-9999"
                                className="pl-12"
                                {...register('phone')}
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Crie uma senha"
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

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirme sua senha"
                                className="pl-12 pr-12"
                                error={errors.confirmPassword?.message}
                                {...register('confirmPassword')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <input type="hidden" {...register('role')} />

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            loading={isSubmitting}
                        >
                            Criar conta
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-muted-foreground text-sm">
                            Ao criar uma conta, você concorda com nossos{' '}
                            <Link href="/terms" className="text-accent hover:underline">
                                Termos de Uso
                            </Link>
                        </p>
                    </div>

                    <div className="mt-6 text-center">
                        <p className="text-muted-foreground">
                            Já tem conta?{' '}
                            <Link href="/login" className="text-accent font-medium hover:underline">
                                Faça login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
