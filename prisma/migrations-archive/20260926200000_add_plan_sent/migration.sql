-- When the trainer last sent (exported) each workout plan and diet as PDF, and which plan version it
-- had: version > sentVersion means the plan changed since. Additive, nullable columns.
ALTER TABLE "WorkoutPlan" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "WorkoutPlan" ADD COLUMN IF NOT EXISTS "sentVersion" INTEGER;
ALTER TABLE "DietPlan" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "DietPlan" ADD COLUMN IF NOT EXISTS "sentVersion" INTEGER;
