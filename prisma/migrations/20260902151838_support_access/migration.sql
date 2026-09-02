-- CreateEnum
CREATE TYPE "support_scope" AS ENUM ('tasks', 'notes', 'events', 'links');

-- CreateTable
CREATE TABLE "support_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "scopes" "support_scope"[],
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestExpiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "accessUntil" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "support_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_views" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "scope" "support_scope" NOT NULL,
    "count" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_access_userId_approvedAt_idx" ON "support_access"("userId", "approvedAt");

-- CreateIndex
CREATE INDEX "support_access_requestExpiresAt_idx" ON "support_access"("requestExpiresAt");

-- CreateIndex
CREATE INDEX "support_views_accessId_idx" ON "support_views"("accessId");

-- AddForeignKey
ALTER TABLE "support_access" ADD CONSTRAINT "support_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_views" ADD CONSTRAINT "support_views_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "support_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The admin portal reads these through its restricted role: it needs to
-- see the state of its own requests, and it needs to write the views it
-- makes. Content itself is still unreachable to that role — unsealing
-- happens through a separate connection, added with the support role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krama_admin') THEN
    GRANT SELECT ON support_access TO krama_admin;
    GRANT SELECT ON support_views  TO krama_admin;
  END IF;
END
$$;
