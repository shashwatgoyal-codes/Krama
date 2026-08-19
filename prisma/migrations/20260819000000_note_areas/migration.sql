-- Notes get an area, like tasks and events already have.
--
-- The board is the one place in the app where things accumulate quietly,
-- and a note with no home is a note you cannot find again. Nullable:
-- filing is optional, and forcing it at capture time would slow down the
-- one screen that exists to be fast.
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "areaId" TEXT;

ALTER TABLE "notes"
  ADD CONSTRAINT "notes_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "areas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
