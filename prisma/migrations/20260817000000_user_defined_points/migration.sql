-- Pace gets its own yardstick.
--
-- It used to be dailyFloor * 20, which assumed every task was worth 20
-- points. That was true only because nothing could set a task's points.
-- Now that they are chosen per task, the assumption is wrong, and the
-- floor is answering a different question anyway.
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "dailyTargetPoints" INTEGER NOT NULL DEFAULT 60;

-- Seed it from what pace was actually using, so nobody's pace moves on
-- the day of the migration.
UPDATE "profiles" SET "dailyTargetPoints" = GREATEST(20, "dailyFloor" * 20);

-- The streak now means "did you show up", so any one finished thing
-- keeps it. Anyone still on the old default of 3 moves to 1; a floor
-- that was deliberately customised to something else is left alone.
ALTER TABLE "profiles" ALTER COLUMN "dailyFloor" SET DEFAULT 1;
UPDATE "profiles" SET "dailyFloor" = 1 WHERE "dailyFloor" = 3;
