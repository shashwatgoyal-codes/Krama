-- CreateTable
CREATE TABLE "auth_attempts" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "firstAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "auth_attempts_lockedUntil_idx" ON "auth_attempts"("lockedUntil");
