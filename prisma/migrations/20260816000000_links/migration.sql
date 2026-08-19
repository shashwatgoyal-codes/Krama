-- Saved links.
--
-- `why` is the column that makes this more than a bookmark list: the
-- reason you kept something is what tells you whether to act on it three
-- weeks later, and it is the part every other read-later tool omits.
--
-- taskId is SET NULL rather than CASCADE: deleting the task you made
-- from a link should not also throw away the link.

CREATE TABLE "links" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "taskId"      TEXT,
  "url"         TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "imageUrl"    TEXT,
  "source"      TEXT NOT NULL,
  "why"         TEXT,
  "tags"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "savedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"      TIMESTAMP(3),
  "archivedAt"  TIMESTAMP(3),

  CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "links_userId_archivedAt_idx" ON "links" ("userId", "archivedAt");
CREATE INDEX "links_userId_savedAt_idx" ON "links" ("userId", "savedAt");

ALTER TABLE "links" ADD CONSTRAINT "links_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "links" ADD CONSTRAINT "links_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
