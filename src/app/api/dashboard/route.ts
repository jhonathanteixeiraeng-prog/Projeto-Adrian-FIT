import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { appClockStart, sinceAppStart, usesStudentApp } from '@/lib/student-app';
import { CHECKIN_EXPECTED_DAYS, monthlyValue } from '@/lib/student-status';
import { parseTzOffset } from '@/lib/viewer-time';
import { whatsappLink } from '@/lib/whatsapp';
import { getConversationSummaries } from '@/app/api/personal/conversations/summary';
import {
    attentionReasons,
    attentionScore,
    billingFor,
    highestSeverity,
} from '@/components/personal/dashboard/attention-rules';

export const dynamic = 'force-dynamic';

const DAY_MS = 24 * 60 * 60 * 1000;
// Workout or diet plan ending within PLAN_ENDING_WINDOW_DAYS or already over: time to renew and resend.
const PLAN_END_KEYS = new Set(['WORKOUT_PLAN_ENDING', 'WORKOUT_PLAN_ENDED', 'DIET_PLAN_ENDING', 'DIET_PLAN_ENDED']);
// A legacy WorkoutCompletion this close to a WorkoutSession of the same workout day is the same workout.
const SAME_WORKOUT_WINDOW_MS = 36 * 60 * 60 * 1000;
// Same rule as /api/student/adherence: a session counts as done when completed or at least 60% done.
const isDoneSession = (session: { status: string; percentage: number }) =>
    session.status === 'COMPLETED' || session.percentage >= 60;

// GET /api/dashboard?tz=<Date#getTimezoneOffset()> - Personal trainer dashboard.
// Legacy fields (used by the iOS app) are kept; `attentionQueue` and `kpis` feed the web daily queue.
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
        const tzOffset = parseTzOffset(new URL(request.url).searchParams.get('tz'));

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - CHECKIN_EXPECTED_DAYS * DAY_MS);
        const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        const [students, otherStudents] = await Promise.all([
            prisma.student.findMany({
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
                        orderBy: { createdAt: 'desc' },
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
                    dietPlans: {
                        where: { active: true },
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        // version/sent*: whether the student has the current PDF (see src/lib/plan-send.ts).
                        select: { id: true, title: true, startDate: true, endDate: true, version: true, sentAt: true, sentVersion: true },
                    },
                },
            }),
            // Paused/inactive students only matter here when they write.
            prisma.student.findMany({
                where: { personalId, status: { not: 'ACTIVE' } },
                select: {
                    id: true,
                    userId: true,
                    status: true,
                    usesApp: true,
                    createdAt: true,
                    user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
                },
            }),
        ]);

        const totalStudents = students.length + otherStudents.length;
        const activeStudents = students.length;
        const activeIds = students.map((student) => student.id);

        const [conversations, recentSessions, recentCompletions] = await Promise.all([
            getConversationSummaries(
                session.user.id,
                [...students, ...otherStudents].map((student) => student.userId)
            ),
            activeIds.length
                ? prisma.workoutSession.findMany({
                    where: { studentId: { in: activeIds }, completedAt: { gte: sevenDaysAgo } },
                    select: { studentId: true, workoutDayId: true, localDate: true, completedAt: true, status: true, percentage: true },
                })
                : Promise.resolve([]),
            activeIds.length
                ? prisma.workoutCompletion.findMany({
                    where: { studentId: { in: activeIds }, completedAt: { gte: sevenDaysAgo } },
                    select: { studentId: true, workoutDayId: true, completedAt: true },
                })
                : Promise.resolve([]),
        ]);

        // Workouts done in the last 7 days, per student: sessions plus legacy completions that
        // have no matching session (the current app writes both for the same workout).
        const doneDaysByStudent = new Map<string, Set<string>>();
        let workoutsLast7Days = 0;
        const addDoneDay = (studentId: string, dayKey: string) => {
            const set = doneDaysByStudent.get(studentId) ?? new Set<string>();
            set.add(dayKey);
            doneDaysByStudent.set(studentId, set);
        };
        for (const workoutSession of recentSessions) {
            if (!isDoneSession(workoutSession)) continue;
            workoutsLast7Days++;
            addDoneDay(workoutSession.studentId, workoutSession.localDate || workoutSession.completedAt.toISOString().slice(0, 10));
        }
        for (const completion of recentCompletions) {
            const hasSession = recentSessions.some(
                (workoutSession) =>
                    workoutSession.studentId === completion.studentId &&
                    workoutSession.workoutDayId === completion.workoutDayId &&
                    Math.abs(workoutSession.completedAt.getTime() - completion.completedAt.getTime()) < SAME_WORKOUT_WINDOW_MS
            );
            if (hasSession) continue;
            workoutsLast7Days++;
            addDoneDay(completion.studentId, completion.completedAt.toISOString().slice(0, 10));
        }

        const expectsDiet = students.some((student) => student.dietPlans.length > 0);

        let totalWorkoutAdherence = 0;
        let totalDietAdherence = 0;
        let studentsWithCheckinData = 0;
        let pendingCheckins = 0;
        let expectedWorkouts = 0;
        let doneWorkouts = 0;
        let adherenceStudents = 0;
        let mrr = 0;
        let pendingCharges = 0;
        let expiringSoon = 0;
        let studentsWithoutWorkout = 0;
        let plansToRenew = 0;

        const lowAdherenceStudents: any[] = [];
        const studentsWithoutWorkout72hList: any[] = [];
        const radarStudents: any[] = [];
        const attentionQueue: any[] = [];

        for (const student of students) {
            // Activity, check-ins, adherence and messages only exist for students who use the student area
            // (the phase 2 pilot, see src/lib/student-app.ts); the others count for plans and billing. Their
            // activity counts from when they joined (appClockStart): older workouts and check-ins don't.
            const app = usesStudentApp(student);
            const clockStart = appClockStart(student);
            const latestCheckin = app && sinceAppStart(student.checkins[0]?.date, clockStart) ? student.checkins[0] : undefined;

            // 1. Checkin adherence metrics
            if (!app) {
                // Nothing to measure: the student doesn't send check-ins.
            } else if (latestCheckin) {
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
            latestWorkoutDate = sinceAppStart(latestWorkoutDate, clockStart);

            const daysSinceLastWorkout = latestWorkoutDate
                ? Math.floor((now.getTime() - latestWorkoutDate.getTime()) / DAY_MS)
                : null;

            const daysSinceLastCheckin = latestCheckin
                ? Math.floor((now.getTime() - new Date(latestCheckin.date).getTime()) / DAY_MS)
                : null;

            const hasWorkoutIn72h = latestWorkoutDate ? latestWorkoutDate > threeDaysAgo : false;

            if (app && !hasWorkoutIn72h) {
                studentsWithoutWorkout72hList.push({
                    id: student.id,
                    name: student.user.name,
                    daysInactive: daysSinceLastWorkout,
                });
            }

            // 3. Retention Radar & Churn Risk Assessment (legacy, kept for the iOS app)
            const reasons: string[] = [];
            let riskLevel: 'CRITICAL' | 'WARNING' | null = null;

            if (daysSinceLastWorkout === null) {
                const daysSinceCreation = Math.floor((now.getTime() - clockStart.getTime()) / DAY_MS);
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
                const daysSinceCreation = Math.floor((now.getTime() - clockStart.getTime()) / DAY_MS);
                if (daysSinceCreation >= CHECKIN_EXPECTED_DAYS) {
                    reasons.push('Nenhum check-in enviado');
                    riskLevel = riskLevel || 'WARNING';
                }
            } else if (daysSinceLastCheckin >= CHECKIN_EXPECTED_DAYS) {
                reasons.push(`Check-in atrasado (${daysSinceLastCheckin} dias)`);
                riskLevel = riskLevel || 'WARNING';
            }

            if (app && riskLevel && reasons.length > 0) {
                // Generate WhatsApp pre-filled link
                let whatsappUrl: string | null = null;
                if (student.user.phone) {
                    const studentFirstName = student.user.name.split(' ')[0];
                    let text = '';
                    if (daysSinceLastWorkout && daysSinceLastWorkout >= 3) {
                        text = `Fala ${studentFirstName}, tudo bem? Notei que você não treina há ${daysSinceLastWorkout} dias. Como posso te ajudar a retomar o ritmo essa semana? Tamo junto! 💪`;
                    } else if (latestCheckin && latestCheckin.workoutAdherence < 60) {
                        text = `Fala ${studentFirstName}, tudo bem? Passando para ver como estão os treinos e se você precisa de algum ajuste na ficha para bater a meta da semana! 👊`;
                    } else if (daysSinceLastCheckin && daysSinceLastCheckin >= CHECKIN_EXPECTED_DAYS) {
                        text = `Fala ${studentFirstName}, tudo bem? Lembrete rápido: não esqueça de preencher o seu check-in semanal no app para avaliarmos sua evolução! 🚀`;
                    } else {
                        text = `Fala ${studentFirstName}, tudo bem? Como estão os treinos e a alimentação por aí? Qualquer dúvida, estou por aqui! 💪`;
                    }
                    whatsappUrl = whatsappLink(student.user.phone, text);
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

            // 4. Real workout adherence: days trained vs. days prescribed while the plan was running (and the
            // student was using the app).
            const workoutPlan = student.workoutPlans[0] ?? null;
            const daysPerWeek = workoutPlan?.workoutDays.length ?? 0;
            if (app && workoutPlan && daysPerWeek > 0) {
                const windowStart = Math.max(sevenDaysAgo.getTime(), new Date(workoutPlan.startDate).getTime(), clockStart.getTime());
                const windowEnd = Math.min(now.getTime(), new Date(workoutPlan.endDate).getTime());
                const coveredDays = (windowEnd - windowStart) / DAY_MS;
                if (coveredDays >= 1) {
                    const expected = Math.max(1, Math.round((daysPerWeek * Math.min(7, coveredDays)) / 7));
                    const done = doneDaysByStudent.get(student.id)?.size ?? 0;
                    expectedWorkouts += expected;
                    doneWorkouts += Math.min(done, expected);
                    adherenceStudents++;
                }
            }

            // 5. Money
            const billing = billingFor(student, { now, tzOffset });
            const monthly = monthlyValue(student.planType, student.planValue);
            if (monthly !== null) mrr += monthly;
            if (billing.status === 'OVERDUE' || billing.status === 'PENDING') pendingCharges++;
            if (billing.status === 'EXPIRING') expiringSoon++;

            // 6. Daily attention queue: one entry per student with every reason merged.
            // Messages only reach students who use the student area.
            const conversation = app ? conversations.get(student.userId) : undefined;
            const lastMessage = conversation?.lastMessage ?? null;
            const unanswered = lastMessage && !lastMessage.fromMe ? lastMessage : null;
            const dietPlan = student.dietPlans[0] ?? null;
            if (!workoutPlan) studentsWithoutWorkout++;
            const attention = attentionReasons(
                {
                    status: student.status,
                    createdAt: clockStart,
                    planExpiresAt: student.planExpiresAt,
                    paymentStatus: student.paymentStatus,
                    lastWorkoutAt: latestWorkoutDate,
                    lastCheckin: latestCheckin ?? null,
                    workoutPlan,
                    dietPlan,
                    expectsDiet,
                    unansweredMessageAt: unanswered?.createdAt ?? null,
                },
                { now, tzOffset, appSignals: app }
            );
            if (attention.some((reason) => PLAN_END_KEYS.has(reason.key))) plansToRenew++;

            if (attention.length > 0) {
                attentionQueue.push({
                    studentId: student.id,
                    userId: student.userId,
                    usesApp: app,
                    name: student.user.name,
                    email: student.user.email,
                    phone: student.user.phone,
                    avatar: student.user.avatar,
                    status: student.status,
                    severity: highestSeverity(attention),
                    score: attentionScore(attention),
                    reasons: attention,
                    unansweredMessage: unanswered
                        ? { text: unanswered.text.slice(0, 160), createdAt: unanswered.createdAt.toISOString() }
                        : null,
                    billing: {
                        status: billing.status,
                        label: billing.label,
                        daysToExpire: billing.daysToExpire,
                        planType: student.planType,
                        planValue: student.planValue,
                        planExpiresAt: student.planExpiresAt ? student.planExpiresAt.toISOString() : null,
                        paymentStatus: student.paymentStatus,
                    },
                    workoutPlan: workoutPlan
                        ? { id: workoutPlan.id, title: workoutPlan.title, endDate: workoutPlan.endDate.toISOString() }
                        : null,
                    dietPlan: dietPlan
                        ? { id: dietPlan.id, title: dietPlan.title, endDate: dietPlan.endDate ? dietPlan.endDate.toISOString() : null }
                        : null,
                    lastWorkoutAt: latestWorkoutDate ? latestWorkoutDate.toISOString() : null,
                    lastCheckinAt: latestCheckin ? new Date(latestCheckin.date).toISOString() : null,
                });
            }
        }

        // Paused/inactive students only enter the queue with an unanswered message.
        for (const student of otherStudents.filter(usesStudentApp)) {
            const lastMessage = conversations.get(student.userId)?.lastMessage ?? null;
            if (!lastMessage || lastMessage.fromMe) continue;
            const attention = attentionReasons(
                { status: student.status, createdAt: student.createdAt, unansweredMessageAt: lastMessage.createdAt },
                { now, tzOffset }
            );
            if (attention.length === 0) continue;
            attentionQueue.push({
                studentId: student.id,
                userId: student.userId,
                usesApp: true,
                name: student.user.name,
                email: student.user.email,
                phone: student.user.phone,
                avatar: student.user.avatar,
                status: student.status,
                severity: highestSeverity(attention),
                score: attentionScore(attention),
                reasons: attention,
                unansweredMessage: { text: lastMessage.text.slice(0, 160), createdAt: lastMessage.createdAt.toISOString() },
                billing: null,
                workoutPlan: null,
                dietPlan: null,
                lastWorkoutAt: null,
                lastCheckinAt: null,
            });
        }

        attentionQueue.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const aWaiting = a.unansweredMessage?.createdAt ?? '9999';
            const bWaiting = b.unansweredMessage?.createdAt ?? '9999';
            if (aWaiting !== bWaiting) return aWaiting.localeCompare(bWaiting);
            return a.name.localeCompare(b.name, 'pt-BR');
        });

        const unansweredMessages = attentionQueue.filter((item) => item.unansweredMessage).length;

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
                // Students who use the student area (phase 2 pilot): the app alerts and numbers are theirs.
                appStudents: [...students, ...otherStudents].filter(usesStudentApp).length,
                studentsWithoutWorkout72h: studentsWithoutWorkout72hList.length,
                // Average of each active student's latest self-reported check-in, whatever its date.
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
                attentionQueue,
                kpis: {
                    totalStudents,
                    activeStudents,
                    workoutsLast7Days,
                    // Days trained vs. prescribed in the last 7 days (null when no active plan has workout days).
                    workoutAdherence7d: expectedWorkouts > 0 ? Math.round((doneWorkouts / expectedWorkouts) * 100) : null,
                    workoutAdherenceStudents: adherenceStudents,
                    reportedWorkoutAdherence: studentsWithCheckinData > 0 ? averageWorkoutAdherence : null,
                    mrr: Math.round(mrr * 100) / 100,
                    pendingCharges,
                    expiringSoon,
                    unansweredMessages,
                    pendingCheckins,
                    // Active students without an active workout plan.
                    studentsWithoutWorkout,
                    // Active students whose workout or diet plan ends within 7 days or is already over.
                    plansToRenew,
                },
                generatedAt: now.toISOString(),
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
