/**
 * Product phase switches.
 *
 * STUDENTS_USE_APP — since 2026-09-26 students don't use the student area or the iOS app: the
 * trainer manages everything on the web and sends workouts and diets as PDFs over WhatsApp.
 * While it is off, the personal area hides what only exists through the students' app: training
 * and check-in activity, adherence, "em risco", unanswered messages, the activity feed, the chat,
 * app reminders and "Avisar o aluno". Queues and counters work from what the trainer controls
 * (plans, their end dates and billing). The student area and the app keep working for anyone who
 * logs in. Turn it back on when every student uses the app.
 *
 * Phase 2 pilot (2026-09-27): while it is off, the trainer can switch the student area on for chosen
 * students ("Usa a área do aluno" on the student's profile, Student.usesApp). Those students get
 * everything above back (plan notices, chat, reminders, activity and adherence); the others stay on
 * PDFs over WhatsApp. Per student, ask usesStudentApp (src/lib/student-app.ts); for the app-wide
 * parts (the chat menu, the activity feed), useNotifications().studentAppInUse.
 */
export const STUDENTS_USE_APP = false;
