-- Phase 2 pilot: the trainer marks which students use the student area / app (Student.usesApp), and when
-- they started (usesAppSince: their app activity counts from then). Everyone starts off (plans keep going
-- as PDF over WhatsApp); nothing existing changes.
-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "usesApp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usesAppSince" TIMESTAMP(3);
