-- CreateTable
CREATE TABLE "capture_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triagedAt" TIMESTAMP(3),
    "resultType" TEXT,
    "resultId" TEXT,

    CONSTRAINT "capture_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "capture_items_userId_triagedAt_idx" ON "capture_items"("userId", "triagedAt");

-- AddForeignKey
ALTER TABLE "capture_items" ADD CONSTRAINT "capture_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
