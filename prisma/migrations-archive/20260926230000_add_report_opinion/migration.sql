-- Trainer's opinion on the evolution report, saved per student (was only in the browser).
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "reportOpinion" TEXT;
