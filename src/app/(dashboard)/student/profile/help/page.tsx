'use client';

import Link from 'next/link';
import { ArrowLeft, HelpCircle, MessageCircle, Mail, Clock } from 'lucide-react';
import { Card, CardContent, Button } from '@/components/ui';

export default function StudentHelpPage() {
    return (
        <div className="space-y-6 animate-in pb-8">
            <div className="flex items-center gap-3">
                <Link href="/student/profile" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl font-bold text-foreground">Ajuda</h1>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                        <HelpCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Precisa de suporte?</p>
                            <p className="text-sm text-muted-foreground">
                                Se tiver dúvidas sobre treino, dieta ou acesso, fale com seu personal.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3">
                        <MessageCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-foreground">Chat no app</p>
                            <p className="text-sm text-muted-foreground">
                                Use o chat para tirar dúvidas rápidas sobre sua rotina.
                            </p>
                        </div>
                    </div>

                    <Link href="/student/chat">
                        <Button className="w-full" variant="secondary">
                            <MessageCircle className="w-4 h-4" />
                            Abrir chat com personal
                        </Button>
                    </Link>

                    <div className="pt-2 border-t border-border space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            suporte@enerflux.app
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            Atendimento: seg a sex, 08h às 18h
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
