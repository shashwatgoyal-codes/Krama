-- When a routine stops.
--
-- Open-ended is still the default, because most routines genuinely are:
-- a standup or a gym session has no end date, and forcing everyone to
-- invent one would be friction for the common case. This is for the
-- routines that do end — a course that runs a term, a habit you are
-- trying for a month.
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrenceUntil" TIMESTAMP(3);
