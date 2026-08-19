-- Ship with the reminder times the design shows.
--
-- A reminder you have to go and switch on is one almost nobody switches
-- on, and these are in-app nudges only — nothing is pushed, nothing is
-- emailed, they simply appear on Today when you next open it. Existing
-- accounts are backfilled only where the value was never set, so anyone
-- who deliberately chose "Off" keeps that choice.

ALTER TABLE "profiles"
  ALTER COLUMN "morningReminder" SET DEFAULT '08:30',
  ALTER COLUMN "eveningReminder" SET DEFAULT '21:00';

UPDATE "profiles" SET "morningReminder" = '08:30' WHERE "morningReminder" IS NULL;
UPDATE "profiles" SET "eveningReminder" = '21:00' WHERE "eveningReminder" IS NULL;
