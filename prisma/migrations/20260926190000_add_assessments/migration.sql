-- Assessments the trainer records (weight, body fat, circumferences, photos), separate from the
-- students' app check-ins. Additive only: a new table and a nullable column on ProgressPhoto.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION,
    "bodyFatPercentage" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "abdomen" DOUBLE PRECISION,
    "hips" DOUBLE PRECISION,
    "armRight" DOUBLE PRECISION,
    "armLeft" DOUBLE PRECISION,
    "thighRight" DOUBLE PRECISION,
    "thighLeft" DOUBLE PRECISION,
    "calfRight" DOUBLE PRECISION,
    "calfLeft" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Assessment_studentId_date_idx" ON "Assessment"("studentId", "date");

-- AlterTable
ALTER TABLE "ProgressPhoto" ADD COLUMN IF NOT EXISTS "assessmentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProgressPhoto_assessmentId_idx" ON "ProgressPhoto"("assessmentId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_studentId_fkey') THEN
        ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProgressPhoto_assessmentId_fkey') THEN
        ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
