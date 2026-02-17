'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowLeft,
    User,
    Mail,
    Phone,
    Calendar,
    Ruler,
    Scale,
    Target,
    Save,
    Lock,
    Eye,
    EyeOff,
    Copy,
    Check,
    KeyRound
} from 'lucide-react';
import Link from 'next/link';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { studentSchema, StudentInput } from '@/lib/validations';

interface CreatedStudent {
    name: string;
    email: string;
    password: string;
}

export default function NewStudentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [createdStudent, setCreatedStudent] = useState<CreatedStudent | null>(null);
    const [copied, setCopied] = useState<'email' | 'password' | 'all' | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<StudentInput>({
        resolver: zodResolver(studentSchema),
    });

    const passwordValue = watch('password');

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

    const onSubmit = async (data: StudentInput) => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/students', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao cadastrar aluno');
            }

            // Show credentials modal
            setCreatedStudent({
                name: data.name,
                email: data.email,
                password: data.password,
            });
        } catch (err: any) {
            setError(err.message || 'Erro ao cadastrar aluno. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string, type: 'email' | 'password' | 'all') => {
        await navigator.clipboard.writeText(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
    };

    const copyAllCredentials = () => {
        if (!createdStudent) return;
        const text = `Acesso ao App Adrian Santos Personal Trainer\n\nE-mail: ${createdStudent.email}\nSenha: ${createdStudent.password}\n\nAcesse: ${window.location.origin}/login`;
        copyToClipboard(text, 'all');
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/personal/students"
                    className="p-2 rounded-xl hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Novo Aluno</h1>
                    <p className="text-muted-foreground">Cadastre um novo aluno com credenciais de acesso</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Credentials */}
                <Card className="border-secondary/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-secondary" />
                            Credenciais de Acesso
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Defina o e-mail e senha que o aluno usará para acessar a plataforma.
                        </p>

                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="email"
                                placeholder="E-mail do aluno"
                                className="pl-12"
                                error={errors.email?.message}
                                {...register('email')}
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Senha de acesso (mín. 6 caracteres)"
                                className="pl-12 pr-12"
                                error={errors.password?.message}
                                {...register('password')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const field = document.querySelector('input[name="password"]') as HTMLInputElement;
                                if (field) {
                                    field.value = generatePassword();
                                    field.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }}
                        >
                            Gerar Senha Automática
                        </Button>
                    </CardContent>
                </Card>

                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Informações Pessoais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                placeholder="Nome completo"
                                className="pl-12"
                                error={errors.name?.message}
                                {...register('name')}
                            />
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                            <Input
                                type="tel"
                                placeholder="Telefone (opcional)"
                                className="pl-12"
                                {...register('phone')}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Physical Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Dados Físicos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    type="date"
                                    placeholder="Data de nascimento"
                                    className="pl-12"
                                    {...register('birthDate')}
                                />
                            </div>

                            <Select
                                label=""
                                options={[
                                    { value: 'MALE', label: 'Masculino' },
                                    { value: 'FEMALE', label: 'Feminino' },
                                    { value: 'OTHER', label: 'Outro' },
                                ]}
                                placeholder="Sexo"
                                {...register('gender')}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    placeholder="Altura (cm)"
                                    className="pl-12"
                                    {...register('height', { valueAsNumber: true })}
                                />
                            </div>

                            <div className="relative">
                                <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    type="number"
                                    step="0.1"
                                    placeholder="Peso (kg)"
                                    className="pl-12"
                                    {...register('weight', { valueAsNumber: true })}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Goal */}
                <Card>
                    <CardHeader>
                        <CardTitle>Objetivo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative">
                            <Target className="absolute left-4 top-4 w-5 h-5 text-muted-foreground" />
                            <textarea
                                placeholder="Descreva o objetivo do aluno (ex: Hipertrofia, emagrecimento, condicionamento...)"
                                className="w-full px-4 py-3 pl-12 bg-muted border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                                {...register('goal')}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex gap-4">
                    <Link href="/personal/students" className="flex-1">
                        <Button type="button" variant="outline" className="w-full">
                            Cancelar
                        </Button>
                    </Link>
                    <Button type="submit" variant="secondary" className="flex-1" loading={loading}>
                        <Save className="w-5 h-5" />
                        Cadastrar Aluno
                    </Button>
                </div>
            </form>

            {/* Success Modal with Credentials */}
            {createdStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Aluno Cadastrado!</h3>
                            <p className="text-muted-foreground mt-2">
                                Compartilhe as credenciais abaixo com <strong>{createdStudent.name}</strong>
                            </p>
                        </div>

                        <div className="space-y-3 bg-muted p-4 rounded-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">E-mail</p>
                                    <p className="font-mono text-sm text-foreground">{createdStudent.email}</p>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(createdStudent.email, 'email')}
                                    className="p-2 hover:bg-background rounded-lg transition-colors"
                                >
                                    {copied === 'email' ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            </div>

                            <div className="border-t border-border" />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Senha</p>
                                    <p className="font-mono text-sm text-foreground">{createdStudent.password}</p>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(createdStudent.password, 'password')}
                                    className="p-2 hover:bg-background rounded-lg transition-colors"
                                >
                                    {copied === 'password' ? (
                                        <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-muted-foreground" />
                                    )}
                                </button>
                            </div>
                        </div>

                        <Button
                            onClick={copyAllCredentials}
                            variant="outline"
                            className="w-full"
                        >
                            {copied === 'all' ? (
                                <>
                                    <Check className="w-5 h-5 text-green-500" />
                                    Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-5 h-5" />
                                    Copiar Tudo para WhatsApp
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={() => router.push('/personal/students')}
                            className="w-full"
                        >
                            Ir para Lista de Alunos
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
