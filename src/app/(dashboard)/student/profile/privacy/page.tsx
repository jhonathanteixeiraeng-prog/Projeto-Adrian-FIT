'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui';

export default function StudentPrivacyPage() {
    return (
        <div className="space-y-6 animate-in pb-8">
            <div className="flex items-center gap-3">
                <Link href="/student/profile" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-foreground">Privacidade</h1>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Dados protegidos</p>
                            <p className="text-sm text-muted-foreground">
                                Suas informações são acessíveis apenas por você e pelo personal responsável.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Lock className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Acesso seguro</p>
                            <p className="text-sm text-muted-foreground">
                                Recomendamos não compartilhar seu login e alterar sua senha periodicamente.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Eye className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Uso das informações</p>
                            <p className="text-sm text-muted-foreground">
                                Os dados de treino e dieta são usados para personalizar sua evolução.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <Server className="w-5 h-5 text-accent mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Armazenamento</p>
                            <p className="text-sm text-muted-foreground">
                                Suas informações ficam armazenadas de forma segura na plataforma.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
