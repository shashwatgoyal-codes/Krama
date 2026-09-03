-- One instance per routine per day.
--
-- The materialiser passed skipDuplicates to createMany, which does
-- nothing without a unique index to skip on. Two tabs opening the app at
-- the same moment could each see "no instance yet" and each insert one.
--
-- Collapse any pair that already exists before adding the guard. A done
-- row is kept over an open one, so a duplicate that was already ticked
-- never loses its completion; otherwise the oldest survives, since that
-- is the one anything else may already point at.
DELETE FROM tasks t
USING tasks keep
WHERE t."recurrenceParentId" IS NOT NULL
  AND t."recurrenceParentId" = keep."recurrenceParentId"
  AND t."createdForDate"     = keep."createdForDate"
  AND t.id <> keep.id
  AND (
    (keep.status = 'done' AND t.status <> 'done')
    OR ((keep.status = 'done') = (t.status = 'done') AND keep."createdAt" < t."createdAt")
  );

CREATE UNIQUE INDEX "tasks_recurrenceParentId_createdForDate_key"
  ON tasks ("recurrenceParentId", "createdForDate");
