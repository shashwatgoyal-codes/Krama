-- CreateEnum
CREATE TYPE "feedback_kind" AS ENUM ('idea', 'problem', 'praise', 'other');

-- CreateEnum
CREATE TYPE "feedback_status" AS ENUM ('new', 'read', 'done');

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "feedback_kind" NOT NULL DEFAULT 'other',
    "message" TEXT NOT NULL,
    "fromPath" TEXT,
    "status" "feedback_status" NOT NULL DEFAULT 'new',
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_userId_createdAt_idx" ON "feedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_status_createdAt_idx" ON "feedback"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
