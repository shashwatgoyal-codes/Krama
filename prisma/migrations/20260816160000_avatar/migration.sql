-- A small avatar, stored in the row.
--
-- No object storage is configured, and one capped image per account is
-- not a load Postgres notices. avatarType holds the type sniffed from
-- the file's own leading bytes — never the Content-Type the browser
-- claimed, because that is how an "image" ends up being served back as
-- an HTML page.

ALTER TABLE "users"
  ADD COLUMN "avatar"     BYTEA,
  ADD COLUMN "avatarType" TEXT,
  ADD COLUMN "avatarAt"   TIMESTAMP(3);

-- Only the three formats every browser renders, and none that can carry
-- script. SVG is deliberately absent.
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_type"
  CHECK ("avatarType" IS NULL
         OR "avatarType" IN ('image/png', 'image/jpeg', 'image/webp'));
