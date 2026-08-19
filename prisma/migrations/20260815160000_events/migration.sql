-- Blocks of time.
--
-- taskId is the link that makes the app more than three separate tools:
-- drag a task onto the plan and it becomes a block, complete the block
-- and the task completes with it. ON DELETE CASCADE because a block for
-- a task that no longer exists is not a calendar entry, it's a ghost.

CREATE TABLE "events" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "taskId"    TEXT,
  "areaId"    TEXT,
  "title"     TEXT NOT NULL,
  "startsAt"  TIMESTAMP(3) NOT NULL,
  "endsAt"    TIMESTAMP(3) NOT NULL,
  "allDay"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_userId_startsAt_idx" ON "events" ("userId", "startsAt");
CREATE INDEX "events_taskId_idx" ON "events" ("taskId");

ALTER TABLE "events" ADD CONSTRAINT "events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A block must not end before it starts. Cheap to enforce here and
-- impossible to get wrong later.
ALTER TABLE "events" ADD CONSTRAINT "events_ends_after_start"
  CHECK ("endsAt" > "startsAt");
