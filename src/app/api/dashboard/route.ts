import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/dashboard - Get personal trainer dashboard data with Churn & Retention Radar
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.personalId) {
            return NextResponse.json(
                { success: false, error: 'Acesso não autorizado' },
                { status: 401 }
            );
        }

        const personalId = session.user.personalId;

        // Get total and active students
        const [totalStudents, activeStudents] = await Promise.all([
            prisma.student.count({ where: { personalId } }),
            prisma.student.count({ where: { personalId, status: 'ACTIVE' } }),
        ]);

        // Get students with recent workouts, checkins and plans
        const students = await prisma.student.findMany({
            where: { personalId, status: 'ACTIVE' },
            include: {
                user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
                workoutSessions: {
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                    select: { completedAt: true, status: true, percentage: true, dayName: true },
                },
                workoutPlans: {
                    where: { active: true },
                    include: {
                        workoutDays: {
                            include: {
                                completions: {
                                    orderBy: { completedAt: 'desc' },
                                    take: 1,
                                    select: { completedAt: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        let totalWorkoutAdherence = 0;
        let totalDietAdherence = 0;
        let studentsWithCheckinData = 0;
        let pendingCheckins = 0;

        const lowAdherenceStudents: any[] = [];
        const studentsWithoutWorkout72hList: any[] = [];
        const radarStudents: any[] = [];

        for (const student of students) {
            const latestCheckin = student.checkins[0];

            // 1. Checkin adherence metrics
            if (latestCheckin) {
                totalWorkoutAdherence += latestCheckin.workoutAdherence;
                totalDietAdherence += latestCheckin.dietAdherence;
                studentsWithCheckinData++;

                if (latestCheckin.workoutAdherence < 60 || latestCheckin.dietAdherence < 60) {
                    lowAdherenceStudents.push({
                        id: student.id,
                        name: student.user.name,
                        email: student.user.email,
                        workoutAdherence: latestCheckin.workoutAdherence,
                        dietAdherence: latestCheckin.dietAdherence,
                    });
                }

                if (new Date(latestCheckin.date) < sevenDaysAgo) {
                    pendingCheckins++;
                }
            } else {
                pendingCheckins++;
            }

            // 2. Compute latest workout from modern WorkoutSession AND legacy WorkoutCompletion
            const sessionDate = student.workoutSessions[0]?.completedAt
                ? new Date(student.workoutSessions[0].completedAt)
                : null;

            let legacyDate: Date | null = null;
            for (const plan of student.workoutPlans) {
                for (const day of plan.workoutDays) {
                    for (const comp of day.completions) {
                        const compDate = new Date(comp.completedAt);
                        if (!legacyDate || compDate > legacyDate) {
                            legacyDate = compDate;
                        }
                    }
                }
            }

            let latestWorkoutDate: Date | null = null;
            if (sessionDate && legacyDate) {
                latestWorkoutDate = sessionDate > legacyDate ? sessionDate : legacyDate;
            } else {
                latestWorkoutDate = sessionDate || legacyDate;
            }

            const daysSinceLastWorkout = latestWorkoutDate
                ? Math.floor((now.getTime() - latestWorkoutDate.getTime()) / (24 * 60 * 60 * 1000))
                : null;

            const daysSinceLastCheckin = latestCheckin
                ? Math.floor((now.getTime() - new Date(latestCheckin.date).getTime()) / (24 * 60 * 60 * 1000))
                : null;

            const hasWorkoutIn72h = latestWorkoutDate ? latestWorkoutDate > threeDaysAgo : false;

            if (!hasWorkoutIn72h) {
                studentsWithoutWorkout72hList.push({
                    id: student.id,
                    name: student.user.name,
                    daysInactive: daysSinceLastWorkout,
                });
            }

            // 3. Retention Radar & Churn Risk Assessment
            const reasons: string[] = [];
            let riskLevel: 'CRITICAL' | 'WARNING' | null = null;

            if (daysSinceLastWorkout === null) {
                const daysSinceCreation = Math.floor((now.getTime() - new Date(student.createdAt).getTime()) / (24 * 60 * 60 * 1000));
                if (daysSinceCreation >= 3) {
                    reasons.push('Nenhum treino iniciado desde o cadastro');
                    riskLevel = daysSinceCreation >= 7 ? 'CRITICAL' : 'WARNING';
                }
            } else if (daysSinceLastWorkout >= 7) {
                reasons.push(`${daysSinceLastWorkout} dias sem treinar`);
                riskLevel = 'CRITICAL';
            } else if (daysSinceLastWorkout >= 3) {
                reasons.push(`${daysSinceLastWorkout} dias sem treinar`);
                riskLevel = riskLevel || 'WARNING';
            }

            if (latestCheckin) {
                if (latestCheckin.workoutAdherence < 50) {
                    reasons.push(`Adesão baixa aos treinos (${latestCheckin.workoutAdherence}%)`);
                    riskLevel = 'CRITICAL';
                } else if (latestCheckin.workoutAdherence < 60) {
                    reasons.push(`Adesão aos treinos em alerta (${latestCheckin.workoutAdherence}%)`);
                    riskLevel = riskLevel || 'WARNING';
                }

                if (latestCheckin.dietAdherence < 50) {
                    reasons.push(`Adesão baixa à dieta (${latestCheckin.dietAdherence}%)`);
                    riskLevel = riskLevel || 'WARNING';
                }
            }

            if (daysSinceLastCheckin === null) {
                const daysSinceCreation = Math.floor((now.getTime() - new Date(student.createdAt).getTime()) / (24 * 60 * 60 * 1000));
                if (daysSinceCreation >= 7) {
                    reasons.push('Nenhum check-in enviado');
                    riskLevel = riskLevel || 'WARNING';
                }
            } else if (daysSinceLastCheckin >= 7) {
                reasons.push(`Check-in atrasado (${daysSinceLastCheckin} dias)`);
                riskLevel = riskLevel || 'WARNING';
            }

            if (riskLevel && reasons.length > 0) {
                // Generate WhatsApp pre-filled link
                const cleanPhone = (student.user.phone || '').replace(/\D/g, '');
                let whatsappUrl: string | null = null;
                if (cleanPhone) {
                    const studentFirstName = student.user.name.split(' ')[0];
                    let text = '';
                    if (daysSinceLastWorkout && daysSinceLastWorkout >= 3) {
                        text = `Fala ${studentFirstName}, tudo bem? Notei que você não treina há ${daysSinceLastWorkout} dias. Como posso te ajudar a retomar o ritmo essa semana? Tamo junto! 💪`;
                    } else if (latestCheckin && latestCheckin.workoutAdherence < 60) {
                        text = `Fala ${studentFirstName}, tudo bem? Passando para ver como estão os treinos e se você precisa de algum ajuste na ficha para bater a meta da semana! 👊`;
                    } else if (daysSinceLastCheckin && daysSinceLastCheckin >= 7) {
                        text = `Fala ${studentFirstName}, tudo bem? Lembrete rápido: não esqueça de preencher o seu check-in semanal no app para avaliarmos sua evolução! 🚀`;
                    } else {
                        text = `Fala ${studentFirstName}, tudo bem? Como estão os treinos e a alimentação por aí? Qualquer dúvida, estou por aqui! 💪`;
                    }
                    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                    whatsappUrl = `https://wa.me/${fullPhone}?text=${encodeURIComponent(text)}`;
                }

                radarStudents.push({
                    id: student.id,
                    name: student.user.name,
                    email: student.user.email,
                    phone: student.user.phone,
                    avatar: student.user.avatar,
                    riskLevel,
                    daysSinceLastWorkout,
                    lastWorkoutDate: latestWorkoutDate ? latestWorkoutDate.toISOString() : null,
                    workoutAdherence: latestCheckin ? latestCheckin.workoutAdherence : null,
                    dietAdherence: latestCheckin ? latestCheckin.dietAdherence : null,
                    daysSinceLastCheckin,
                    reasons,
                    whatsappUrl,
                });
            }
        }

        // Sort radar students: CRITICAL first, then highest days inactive
        radarStudents.sort((a, b) => {
            if (a.riskLevel === 'CRITICAL' && b.riskLevel !== 'CRITICAL') return -1;
            if (b.riskLevel === 'CRITICAL' && a.riskLevel !== 'CRITICAL') return 1;
            const aDays = a.daysSinceLastWorkout ?? 999;
            const bDays = b.daysSinceLastWorkout ?? 999;
            return bDays - aDays;
        });

        const averageWorkoutAdherence = studentsWithCheckinData > 0
            ? Math.round(totalWorkoutAdherence / studentsWithCheckinData)
            : 0;
        const averageDietAdherence = studentsWithCheckinData > 0
            ? Math.round(totalDietAdherence / studentsWithCheckinData)
            : 0;

        const criticalCount = radarStudents.filter(s => s.riskLevel === 'CRITICAL').length;
        const warningCount = radarStudents.filter(s => s.riskLevel === 'WARNING').length;

        return NextResponse.json({
            success: true,
            data: {
                totalStudents,
                activeStudents,
                studentsWithoutWorkout72h: studentsWithoutWorkout72hList.length,
                averageWorkoutAdherence,
                averageDietAdherence,
                pendingCheckins,
                lowAdherenceStudents,
                studentsWithoutWorkout72hList: studentsWithoutWorkout72hList.slice(0, 5),
                retentionRadar: {
                    criticalCount,
                    warningCount,
                    totalAtRisk: radarStudents.length,
                    students: radarStudents,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        return NextResponse.json(
            { success: false, error: 'Erro ao carregar dashboard' },
            { status: 500 }
        );
    }
}
