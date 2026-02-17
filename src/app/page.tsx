'use client';

import Link from 'next/link';
import {
    Dumbbell,
    ArrowRight,
    TrendingUp,
    Utensils,
    MessageCircle,
    CheckCircle2,
    Target,
    Flame,
    Shield
} from 'lucide-react';
import { Button } from '@/components/ui';

export default function HomePage() {
    return (
        <div className="min-h-screen bg-black">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#F88022]/20 to-transparent" />

                <div className="relative container mx-auto px-4 py-16 lg:py-28">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        {/* Left Content */}
                        <div className="flex-1 text-center lg:text-left">
                            {/* Logo */}
                            <div className="flex items-center justify-center lg:justify-start gap-4 mb-8">
                                <div className="w-16 h-16 rounded-2xl bg-[#F88022] flex items-center justify-center shadow-lg shadow-[#F88022]/30">
                                    <Dumbbell className="w-9 h-9 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                        ADRIAN SANTOS
                                    </h1>
                                    <p className="text-sm text-[#F88022] font-semibold tracking-widest uppercase">
                                        Personal Trainer
                                    </p>
                                </div>
                            </div>

                            <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 leading-tight tracking-tight" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                                Disciplina.
                                <br />
                                <span className="text-[#F88022]">Consistência.</span>
                                <br />
                                Alta Performance.
                            </h2>

                            <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
                                Transformação real, física e mental. Acompanhamento profissional
                                para quem busca resultados extraordinários.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <Link href="/login">
                                    <Button size="lg" className="w-full sm:w-auto bg-[#F88022] hover:bg-[#F88022]/90 text-white font-bold px-8 py-6 text-lg shadow-lg shadow-[#F88022]/30">
                                        Login
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Right - Feature Cards */}
                        <div className="flex-1 grid grid-cols-2 gap-4 max-w-md">
                            {[
                                { icon: Dumbbell, title: 'Treinos', desc: 'Personalizados', color: 'bg-[#F88022]' },
                                { icon: Utensils, title: 'Dietas', desc: 'Estratégicas', color: 'bg-[#F88022]' },
                                { icon: TrendingUp, title: 'Evolução', desc: 'Monitorada', color: 'bg-[#F88022]' },
                                { icon: MessageCircle, title: 'Suporte', desc: 'Direto', color: 'bg-[#F88022]' },
                            ].map((feature, index) => (
                                <div
                                    key={index}
                                    className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-[#F88022]/50 transition-all hover:bg-white/10"
                                >
                                    <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
                                        <feature.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">{feature.title}</h3>
                                    <p className="text-sm text-gray-400">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Warrior Philosophy Section */}
            <div className="bg-gradient-to-b from-black to-[#111111] py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h3 className="text-sm text-[#F88022] font-bold tracking-widest uppercase mb-4">
                            Filosofia do Guerreiro
                        </h3>
                        <h2 className="text-3xl lg:text-4xl font-black text-white mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Forte. Confiante. Disciplinado.
                        </h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            A metodologia Adrian Santos transforma não apenas seu corpo, mas sua mentalidade.
                            Resultados reais para quem está disposto a se comprometer.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Target,
                                title: 'Foco no Resultado',
                                description: 'Cada treino, cada refeição, cada decisão alinhada com seu objetivo final.',
                            },
                            {
                                icon: Flame,
                                title: 'Intensidade Controlada',
                                description: 'Treinos progressivos e desafiadores, respeitando seus limites.',
                            },
                            {
                                icon: Shield,
                                title: 'Acompanhamento Premium',
                                description: 'Suporte profissional contínuo para garantir sua evolução.',
                            },
                        ].map((item, index) => (
                            <div key={index} className="bg-[#111111] rounded-2xl p-8 border border-gray-800 hover:border-[#F88022]/50 transition-all group">
                                <div className="w-14 h-14 rounded-xl bg-[#F88022]/10 flex items-center justify-center mb-6 group-hover:bg-[#F88022]/20 transition-all">
                                    <item.icon className="w-7 h-7 text-[#F88022]" />
                                </div>
                                <h4 className="text-xl font-bold text-white mb-3">{item.title}</h4>
                                <p className="text-gray-400">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-[#111111] py-20">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h3 className="text-sm text-[#F88022] font-bold tracking-widest uppercase mb-4">
                            Plataforma Completa
                        </h3>
                        <h2 className="text-3xl lg:text-4xl font-black text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                            Tudo que você precisa para evoluir
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {[
                            {
                                icon: Dumbbell,
                                title: 'Alunos',
                                features: [
                                    'Treino do dia personalizado',
                                    'Dieta com macros calculados',
                                    'Vídeos demonstrativos',
                                    'Check-in semanal',
                                    'Fotos de progresso',
                                    'Chat direto com personal',
                                ],
                            },
                            {
                                icon: TrendingUp,
                                title: 'Resultados',
                                features: [
                                    'Gráficos de evolução',
                                    'Histórico completo',
                                    'Adesão em tempo real',
                                    'Notificações inteligentes',
                                    'Metas personalizadas',
                                    'Análise de desempenho',
                                ],
                            },
                        ].map((section, index) => (
                            <div key={index} className="bg-black rounded-2xl p-8 border border-gray-800">
                                <div className="w-14 h-14 rounded-xl bg-[#F88022]/10 flex items-center justify-center mb-6">
                                    <section.icon className="w-7 h-7 text-[#F88022]" />
                                </div>
                                <h4 className="text-xl font-bold text-white mb-6">{section.title}</h4>
                                <ul className="space-y-3">
                                    {section.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-3 text-gray-400">
                                            <CheckCircle2 className="w-5 h-5 text-[#F88022] flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#F88022] to-[#F88022]/80" />
                <div className="absolute inset-0 bg-[url('/pattern.png')] opacity-10" />

                <div className="relative container mx-auto px-4 py-20 text-center">
                    <h3 className="text-3xl lg:text-4xl font-black text-white mb-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                        Pronto para sua transformação?
                    </h3>
                    <p className="text-white/90 mb-8 max-w-xl mx-auto text-lg">
                        Comece agora e descubra seu verdadeiro potencial.
                        Resultados reais para quem está comprometido.
                    </p>
                    <Link href="/login">
                        <Button size="lg" className="bg-black hover:bg-black/90 text-white font-bold px-10 py-6 text-lg shadow-xl">
                            Fazer Login
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-black py-12 border-t border-gray-800">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F88022] flex items-center justify-center">
                                <Dumbbell className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-white">Adrian Santos</p>
                                <p className="text-xs text-gray-500">Personal Trainer</p>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm">
                            © {new Date().getFullYear()} Adrian Santos Personal Trainer. Todos os direitos reservados.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
