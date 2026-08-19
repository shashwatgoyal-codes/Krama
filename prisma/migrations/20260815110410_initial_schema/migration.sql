-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'dropped');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('none', 'daily', 'weekdays', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "PointSource" AS ENUM ('task', 'habit', 'manual');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "pace" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dayEndsAtHour" INTEGER NOT NULL DEFAULT 4,
    "dailyFloor" INTEGER NOT NULL DEFAULT 3,
    "dailyCap" INTEGER NOT NULL DEFAULT 150,
    "scoringVisibility" TEXT NOT NULL DEFAULT 'normal',
    "restDays" INTEGER[] DEFAULT ARRAY[0, 6]::INTEGER[],
    "lastActiveOn" TIMESTAMP(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colour" TEXT NOT NULL DEFAULT 'acc',
    "points" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "points" INTEGER NOT NULL DEFAULT 20,
    "dueOn" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdForDate" TIMESTAMP(3) NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'none',
    "recurrenceValue" INTEGER,
    "recurrenceParentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "PointSource" NOT NULL,
    "sourceId" TEXT,
    "points" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "countedFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_userId_key" ON "profiles"("userId");

-- CreateIndex
CREATE INDEX "areas_userId_idx" ON "areas"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "areas_userId_name_key" ON "areas"("userId", "name");

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_createdForDate_idx" ON "tasks"("userId", "createdForDate");

-- CreateIndex
CREATE INDEX "tasks_recurrenceParentId_idx" ON "tasks"("recurrenceParentId");

-- CreateIndex
CREATE INDEX "point_ledger_userId_countedFor_idx" ON "point_ledger"("userId", "countedFor");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_ledger" ADD CONSTRAINT "point_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
