-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing sessions get their creation time rather than "now": claiming
-- every old session was active this second would make the device list
-- wrong on the one day people are most likely to read it.
UPDATE "sessions" SET "lastSeenAt" = "createdAt";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krama_admin') THEN
    GRANT SELECT ("lastSeenAt") ON sessions TO krama_admin;
  END IF;
END
$$;
