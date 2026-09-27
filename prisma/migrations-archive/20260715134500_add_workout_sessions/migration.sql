-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "workoutDayId" TEXT NOT NULL,
    "dayName" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedSets" INTEGER NOT NULL,
    "totalSets" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "totalVolume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkoutSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "SetLog" ADD COLUMN "sessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_studentId_workoutDayId_localDate_key"
ON "WorkoutSession"("studentId", "workoutDayId", "localDate");

-- CreateIndex
CREATE INDEX "WorkoutSession_studentId_completedAt_idx"
ON "WorkoutSession"("studentId", "completedAt");

-- CreateIndex
CREATE INDEX "WorkoutSession_studentId_workoutDayId_idx"
ON "WorkoutSession"("studentId", "workoutDayId");

-- CreateIndex
CREATE INDEX "SetLog_sessionId_idx" ON "SetLog"("sessionId");

-- SQLite não permite adicionar uma foreign key a uma tabela existente sem
-- recriá-la. A relação é mantida pelo Prisma e o índice acima cobre consultas.
