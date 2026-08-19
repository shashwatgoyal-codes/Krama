-- One-time codes for password reset and email confirmation.
--
-- Only an HMAC of the code is stored, keyed with SESSION_SECRET. Six
-- digits is a million possibilities, so a plain hash would be a rainbow
-- table anyone could build in an afternoon; without the server-side key
-- a leak of this table is worth nothing on its own.
--
-- The attempt counter lives here rather than in process memory so the
-- ceiling survives a restart. An in-memory counter would hand an
-- attacker a fresh allowance with every deploy.

CREATE TYPE "VerificationPurpose" AS ENUM ('password_reset', 'email_verify');

CREATE TABLE "verification_codes" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "purpose"    "VerificationPurpose" NOT NULL,
  "codeHash"   TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verification_codes_userId_purpose_idx"
  ON "verification_codes" ("userId", "purpose");

CREATE INDEX "verification_codes_expiresAt_idx"
  ON "verification_codes" ("expiresAt");

ALTER TABLE "verification_codes"
  ADD CONSTRAINT "verification_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
