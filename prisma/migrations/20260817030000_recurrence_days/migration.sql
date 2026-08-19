-- Weekly routines can run on several days.
--
-- recurrenceValue held one weekday, so a routine could be "every
-- Monday" but never "every day except Sunday" — six separate routines
-- was the only way to say it, and six routines is six things to edit
-- when the time changes.
ALTER TABLE "tasks"
  ADD COLUMN IF NOT EXISTS "recurrenceDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

-- Existing weekly routines move onto the array so there is one rule to
-- read rather than two. The old column stays for monthly, which still
-- uses it for the day of the month.
UPDATE "tasks"
SET "recurrenceDays" = ARRAY["recurrenceValue"]
WHERE "recurrence" = 'weekly'
  AND "recurrenceValue" IS NOT NULL
  AND cardinality("recurrenceDays") = 0;
