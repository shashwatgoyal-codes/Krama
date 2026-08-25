-- Collapse admin_level to the single grantable value.
--
-- The ladder is standard < admin < superadmin, and only the middle rung
-- is a row. `standard` is the absence of one, so an account is powerless
-- by default rather than by remembering to write the right value.
-- `superadmin` comes from SUPER_ADMIN_EMAIL, so the top cannot be
-- reached by writing to this table at all.
--
-- 'support' was a read-only tier that is not being used. Anything still
-- carrying it becomes 'admin' rather than being dropped — silently
-- removing somebody's access during a migration is the wrong direction
-- to fail in, and there is an audit log to explain the change.
--
-- Both columns using the type have to be converted before the old one
-- can go: admin_invites carries a level too, and forgetting it fails
-- with "cannot drop type ... because other objects depend on it".

UPDATE "admin_roles"   SET "level" = 'admin' WHERE "level" = 'support';
UPDATE "admin_invites" SET "level" = 'admin' WHERE "level" = 'support';

ALTER TYPE "admin_level" RENAME TO "admin_level_old";
CREATE TYPE "admin_level" AS ENUM ('admin');

ALTER TABLE "admin_roles"
  ALTER COLUMN "level" TYPE "admin_level"
  USING ("level"::text::"admin_level");

ALTER TABLE "admin_invites"
  ALTER COLUMN "level" TYPE "admin_level"
  USING ("level"::text::"admin_level");

DROP TYPE "admin_level_old";
