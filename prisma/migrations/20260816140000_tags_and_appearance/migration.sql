-- Tags, the accent choice, and where a quick capture lands.
--
-- Tags are their own table rather than a string column so a rename is
-- one write instead of a scan, and so "which tags haven't been used in
-- 90 days" is a query rather than a guess.

ALTER TABLE "profiles"
  ADD COLUMN "accent"        TEXT NOT NULL DEFAULT 'amber',
  ADD COLUMN "defaultAreaId" TEXT;

CREATE TABLE "tags" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags" ("userId", "name");
CREATE INDEX "tags_userId_idx" ON "tags" ("userId");

ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
