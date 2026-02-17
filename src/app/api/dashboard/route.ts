import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// GET /api/dashboard - Get personal trainer dashboard data
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

        // Get total students
        const totalStudents = await prisma.student.count({
            where: { personalId },
        });

        const activeStudents = await prisma.student.count({
            where: { personalId, status: 'ACTIVE' },
        });

        // Get students with their latest checkins
        const studentsWithCheckins = await prisma.student.findMany({
            where: { personalId, status: 'ACTIVE' },
            include: {
                user: { select: { name: true, email: true } },
                checkins: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
                workoutPlans: {
                    where: { active: true },
                    include: {
                        workoutDays: {
                            include: {
                                completions: {
                                    where: {
                                        completedAt: {
                                            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Calculate metrics
        let totalWorkoutAdherence = 0;
        let totalDietAdherence = 0;
        let studentsWithCheckinData = 0;
        const lowAdherenceStudents: any[] = [];
        const studentsWithoutWorkout72h: any[] = [];
        let pendingCheckins = 0;

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        for (const student of studentsWithCheckins) {
            const latestCheckin = student.checkins[0];

            if (latestCheckin) {
                totalWorkoutAdherence += latestCheckin.workoutAdherence;
                totalDietAdherence += latestCheckin.dietAdherence;
                studentsWithCheckinData++;

                // Check for low adherence
                if (latestCheckin.workoutAdherence < 60 || latestCheckin.dietAdherence < 60) {
                    lowAdherenceStudents.push({
                        id: student.id,
                        name: student.user.name,
                        email: student.user.email,
                        workoutAdherence: latestCheckin.workoutAdherence,
                        dietAdherence: latestCheckin.dietAdherence,
                    });
                }

                // Check if check-in is older than 7 days
                if (new Date(latestCheckin.date) < sevenDaysAgo) {
                    pendingCheckins++;
                }
            } else {
                pendingCheckins++;
            }

            // Check for no workout in 72h
            const hasRecentWorkout = student.workoutPlans.some(plan =>
                plan.workoutDays.some(day =>
                    day.completions.some(comp => new Date(comp.completedAt) > threeDaysAgo)
                )
            );

            if (!hasRecentWorkout) {
                studentsWithoutWorkout72h.push({
                    id: student.id,
                    name: student.user.name,
                });
            }
        }

        const averageWorkoutAdherence = studentsWithCheckinData > 0
            ? Math.round(totalWorkoutAdherence / studentsWithCheckinData)
            : 0;
        const averageDietAdherence = studentsWithCheckinData > 0
            ? Math.round(totalDietAdherence / studentsWithCheckinData)
            : 0;

        return NextResponse.json({
            success: true,
            data: {
                totalStudents,
                activeStudents,
                studentsWithoutWorkout72h: studentsWithoutWorkout72h.length,
                averageWorkoutAdherence,
                averageDietAdherence,
                pendingCheckins,
                lowAdherenceStudents,
                studentsWithoutWorkout72hList: studentsWithoutWorkout72h.slice(0, 5),
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
