-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- The flags themselves, seeded here rather than created through the
-- portal. Which switches exist is a fact about the codebase; only their
-- values are an operational decision.
--
-- Everything starts off. A flag that ships on has no rollout to do, and
-- one that ships on by accident is the failure this whole mechanism is
-- meant to prevent.
INSERT INTO "feature_flags" ("key", "description", "enabled", "rollout", "updatedAt")
VALUES
  ('open_registration', 'Anyone can create an account. With this off, /signup is closed and only invited people get in.', true, 100, now()),
  ('email_digest',      'A weekly summary by email. Needs a verified sending domain first.', false, 0, now()),
  ('focus_timer',       'Start a timer against a task; the time logged feeds the points.', false, 0, now()),
  ('weekly_review',     'A guided pass over the week, closing the loop the scoring opens.', false, 0, now()),
  ('habits',            'Habits measured by consistency, separate from recurring tasks.', false, 0, now())
ON CONFLICT ("key") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'krama_admin') THEN
    GRANT SELECT ON feature_flags TO krama_admin;
  END IF;
END
$$;
