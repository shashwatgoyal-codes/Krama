-- What time a routine happens.
--
-- Scheduling a recurring task used to produce exactly one calendar
-- block — this Monday's — and next Monday showed an empty morning even
-- though the routine was still running. The time lives on the template
-- so the calendar can draw every future occurrence without a row
-- existing for each one.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "routineStartMinute" INTEGER;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "routineMinutes" INTEGER;
