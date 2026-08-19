-- The settings the design specifies but the schema had nowhere to put.
--
-- All defaulted, so existing profiles keep working without a backfill,
-- and every default is the behaviour the app already had.

ALTER TABLE "profiles"
  ADD COLUMN "weekStartsOn"       INTEGER      NOT NULL DEFAULT 1,
  ADD COLUMN "timeFormat"         TEXT         NOT NULL DEFAULT '24',
  ADD COLUMN "passwordChangedAt"  TIMESTAMP(3),
  ADD COLUMN "morningReminder"    TEXT,
  ADD COLUMN "eveningReminder"    TEXT,
  ADD COLUMN "backdateLimitDays"  INTEGER      NOT NULL DEFAULT 2,
  ADD COLUMN "rolloverUnfinished" BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN "catchUpRoutines"    BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "density"            TEXT         NOT NULL DEFAULT 'comfortable',
  ADD COLUMN "reduceMotion"       BOOLEAN      NOT NULL DEFAULT false;

-- Cheap guards so a crafted request can't store a value the UI would
-- then have to defend against every time it renders.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_week_starts_on" CHECK ("weekStartsOn" IN (0, 1)),
  ADD CONSTRAINT "profiles_time_format"    CHECK ("timeFormat" IN ('12', '24')),
  ADD CONSTRAINT "profiles_density"        CHECK ("density" IN ('comfortable', 'compact')),
  ADD CONSTRAINT "profiles_backdate_limit" CHECK ("backdateLimitDays" BETWEEN 0 AND 30);
