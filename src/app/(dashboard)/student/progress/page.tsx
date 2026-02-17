'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Scale,
    Dumbbell,
    Utensils,
    Camera,
    ChevronLeft,
    ChevronRight,
    Calendar
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';

// Mock data
const mockProgress = {
    currentWeight: 75.2,
    startWeight: 78.5,
    goalWeight: 72,
    weightChange: -3.3,
    checkins: [
        { date: '2024-01-14', weight: 75.2, workoutAdherence: 90, dietAdherence: 75 },
        { date: '2024-01-07', weight: 75.8, workoutAdherence: 85, dietAdherence: 70 },
        { date: '2023-12-31', weight: 76.2, workoutAdherence: 80, dietAdherence: 68 },
        { date: '2023-12-24', weight: 76.8, workoutAdherence: 75, dietAdherence: 65 },
        { date: '2023-12-17', weight: 77.3, workoutAdherence: 82, dietAdherence: 72 },
        { date: '2023-12-10', weight: 77.8, workoutAdherence: 88, dietAdherence: 70 },
        { date: '2023-12-03', weight: 78.1, workoutAdherence: 78, dietAdherence: 68 },
        { date: '2023-11-26', weight: 78.5, workoutAdherence: 70, dietAdherence: 60 },
    ],
    photos: [
        { date: '2024-01-14', front: '/placeholder.jpg', side: '/placeholder.jpg', back: '/placeholder.jpg' },
        { date: '2023-12-14', front: '/placeholder.jpg', side: '/placeholder.jpg', back: '/placeholder.jpg' },
        { date: '2023-11-14', front: '/placeholder.jpg', side: '/placeholder.jpg', back: '/placeholder.jpg' },
    ],
    averages: {
        workoutAdherence: 81,
        dietAdherence: 69,
        sleepHours: 7.2,
    },
};

export default function ProgressPage() {
    const [activeTab, setActiveTab] = useState<'weight' | 'adherence' | 'photos'>('weight');
    const [selectedPhotoSet, setSelectedPhotoSet] = useState(0);

    const progressToGoal = ((mockProgress.startWeight - mockProgress.currentWeight) /
        (mockProgress.startWeight - mockProgress.goalWeight)) * 100;

    // Simple chart visualization
    const maxWeight = Math.max(...mockProgress.checkins.map(c => c.weight));
    const minWeight = Math.min(...mockProgress.checkins.map(c => c.weight));
    const weightRange = maxWeight - minWeight || 1;

    return (
        <div className="space-y-6 animate-in pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/student/home" className="p-2 rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Minha Evolução</h1>
                    <p className="text-sm text-muted-foreground">Acompanhe seu progresso</p>
                </div>
            </div>

            {/* Current Stats */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                    <Scale className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{mockProgress.currentWeight}kg</p>
                    <p className="text-xs text-muted-foreground">Peso atual</p>
                </Card>
                <Card className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        {mockProgress.weightChange < 0 ? (
                            <TrendingDown className="w-5 h-5 text-secondary" />
                        ) : (
                            <TrendingUp className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <p className={`text-xl font-bold ${mockProgress.weightChange < 0 ? 'text-secondary' : 'text-red-500'}`}>
                        {mockProgress.weightChange > 0 ? '+' : ''}{mockProgress.weightChange}kg
                    </p>
                    <p className="text-xs text-muted-foreground">Variação</p>
                </Card>
                <Card className="p-3 text-center">
                    <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-foreground">{mockProgress.checkins.length}</p>
                    <p className="text-xs text-muted-foreground">Check-ins</p>
                </Card>
            </div>

            {/* Goal Progress */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">Progresso para a meta</span>
                        <Badge variant={progressToGoal >= 100 ? 'success' : 'info'}>
                            {Math.min(progressToGoal, 100).toFixed(0)}%
                        </Badge>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-gradient-to-r from-secondary to-accent rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progressToGoal, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Início: {mockProgress.startWeight}kg</span>
                        <span>Meta: {mockProgress.goalWeight}kg</span>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { id: 'weight', label: 'Peso', icon: Scale },
                    { id: 'adherence', label: 'Adesão', icon: TrendingUp },
                    { id: 'photos', label: 'Fotos', icon: Camera },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === tab.id
                                ? 'bg-[#F88022] text-white'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Weight Chart */}
            {activeTab === 'weight' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Peso</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Simple Bar Chart */}
                        <div className="h-48 flex items-end justify-between gap-2 mb-4">
                            {mockProgress.checkins.slice(0, 8).reverse().map((checkin, index) => {
                                const height = ((checkin.weight - minWeight) / weightRange) * 100;
                                return (
                                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs font-medium text-foreground">{checkin.weight}</span>
                                        <div
                                            className="w-full bg-gradient-to-t from-secondary to-accent rounded-t-lg transition-all duration-500"
                                            style={{ height: `${Math.max(height, 10)}%` }}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(checkin.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Checkin List */}
                        <div className="space-y-2">
                            {mockProgress.checkins.slice(0, 4).map((checkin, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {new Date(checkin.date).toLocaleDateString('pt-BR')}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Check-in semanal</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-foreground">{checkin.weight}kg</p>
                                        {index < mockProgress.checkins.length - 1 && (
                                            <p className={`text-xs ${checkin.weight < mockProgress.checkins[index + 1].weight
                                                    ? 'text-secondary'
                                                    : 'text-red-500'
                                                }`}>
                                                {checkin.weight < mockProgress.checkins[index + 1].weight ? '-' : '+'}
                                                {Math.abs(checkin.weight - mockProgress.checkins[index + 1].weight).toFixed(1)}kg
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Adherence Chart */}
            {activeTab === 'adherence' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Adesão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Averages */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="p-4 bg-secondary/10 rounded-xl text-center">
                                <Dumbbell className="w-6 h-6 text-secondary mx-auto mb-2" />
                                <p className="text-2xl font-bold text-secondary">{mockProgress.averages.workoutAdherence}%</p>
                                <p className="text-sm text-muted-foreground">Média Treino</p>
                            </div>
                            <div className="p-4 bg-accent/10 rounded-xl text-center">
                                <Utensils className="w-6 h-6 text-accent mx-auto mb-2" />
                                <p className="text-2xl font-bold text-accent">{mockProgress.averages.dietAdherence}%</p>
                                <p className="text-sm text-muted-foreground">Média Dieta</p>
                            </div>
                        </div>

                        {/* Checkin List with Adherence */}
                        <div className="space-y-2">
                            {mockProgress.checkins.slice(0, 6).map((checkin, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-xl">
                                    <div>
                                        <p className="font-medium text-foreground">
                                            {new Date(checkin.date).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1">
                                            <Dumbbell className="w-4 h-4 text-secondary" />
                                            <span className={`font-medium ${checkin.workoutAdherence >= 80 ? 'text-secondary' :
                                                    checkin.workoutAdherence >= 60 ? 'text-yellow-500' : 'text-red-500'
                                                }`}>
                                                {checkin.workoutAdherence}%
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Utensils className="w-4 h-4 text-accent" />
                                            <span className={`font-medium ${checkin.dietAdherence >= 80 ? 'text-accent' :
                                                    checkin.dietAdherence >= 60 ? 'text-yellow-500' : 'text-red-500'
                                                }`}>
                                                {checkin.dietAdherence}%
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Photos */}
            {activeTab === 'photos' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Fotos de Progresso</CardTitle>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setSelectedPhotoSet(Math.max(0, selectedPhotoSet - 1))}
                                disabled={selectedPhotoSet === 0}
                                className="p-1 rounded-lg hover:bg-muted disabled:opacity-50"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm text-muted-foreground">
                                {selectedPhotoSet + 1} / {mockProgress.photos.length}
                            </span>
                            <button
                                onClick={() => setSelectedPhotoSet(Math.min(mockProgress.photos.length - 1, selectedPhotoSet + 1))}
                                disabled={selectedPhotoSet === mockProgress.photos.length - 1}
                                className="p-1 rounded-lg hover:bg-muted disabled:opacity-50"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-center text-sm text-muted-foreground mb-4">
                            {new Date(mockProgress.photos[selectedPhotoSet].date).toLocaleDateString('pt-BR')}
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {['Frente', 'Lado', 'Costas'].map((angle, index) => (
                                <div key={angle} className="aspect-[3/4] bg-muted rounded-xl flex flex-col items-center justify-center">
                                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                                    <span className="text-xs text-muted-foreground">{angle}</span>
                                </div>
                            ))}
                        </div>

                        {/* Upload New */}
                        <Link href="/student/checkin">
                            <Button variant="outline" className="w-full mt-4">
                                <Camera className="w-4 h-4" />
                                Adicionar Novas Fotos
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
