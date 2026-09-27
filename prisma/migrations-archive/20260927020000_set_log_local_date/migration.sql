-- Set logs record the student's calendar day (audit A07) and there is one log per set and day (A13).
-- Older logs keep localDate NULL, and Postgres treats NULLs as distinct: the new index can't fail on them,
-- and the code running before this deploy (which never sets localDate) keeps working.
ALTER TABLE "SetLog" ADD COLUMN IF NOT EXISTS "localDate" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SetLog_studentId_dayId_exerciseId_setIndex_localDate_key" ON "SetLog"("studentId", "dayId", "exerciseId", "setIndex", "localDate");
