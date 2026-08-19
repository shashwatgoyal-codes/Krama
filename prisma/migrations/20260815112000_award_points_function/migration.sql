-- Awarding points is the one operation that must be atomic.
--
-- It reads the day's running total, applies the caps, writes a ledger
-- row and updates the profile. Split across statements, two fast clicks
-- interleave and the same task pays twice.
--
-- It lives in the database rather than in application code because
-- Neon's pooled endpoint runs transaction pooling, where Prisma's
-- interactive transactions are unreliable — statements can land on
-- different backends. A function is a single statement, so it is atomic
-- through a pooler by construction.
--
-- The rules here mirror lib/points.ts. This copy is authoritative; the
-- TypeScript one exists to show the user what an action will pay before
-- they click.

CREATE OR REPLACE FUNCTION krama_award_points(
  p_user_id     TEXT,
  p_source_type "PointSource",
  p_source_id   TEXT,
  p_base_points INT,
  p_counted_for TIMESTAMP,
  p_backdated   BOOLEAN
)
RETURNS TABLE (awarded INT, multiplier NUMERIC) AS $$
DECLARE
  v_streak     INT;
  v_cap        INT;
  v_today      INT;
  v_streak_mul NUMERIC;
  v_cap_mul    NUMERIC;
  v_back_mul   NUMERIC;
  v_total_mul  NUMERIC;
  v_points     INT;
BEGIN
  -- Locks the profile row for the rest of the transaction. A second
  -- concurrent award for the same user waits here rather than reading a
  -- stale daily total.
  SELECT "streakDays", "dailyCap"
    INTO v_streak, v_cap
    FROM "profiles"
   WHERE "userId" = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile for user %', p_user_id;
  END IF;

  SELECT COALESCE(SUM("points"), 0)
    INTO v_today
    FROM "point_ledger"
   WHERE "userId" = p_user_id
     AND "countedFor" = p_counted_for;

  -- Streak multiplier, capped at 1.60 so a long streak can't dwarf the work.
  v_streak_mul := 1 + (LEAST(GREATEST(v_streak, 0), 30) * 0.02);

  -- Past the daily cap awards pay half, then a quarter. Nothing is ever
  -- blocked; the ceiling just stops mattering.
  IF v_today < v_cap THEN
    v_cap_mul := 1;
  ELSIF v_today < v_cap * 2 THEN
    v_cap_mul := 0.5;
  ELSE
    v_cap_mul := 0.25;
  END IF;

  v_back_mul  := CASE WHEN p_backdated THEN 0.5 ELSE 1 END;
  v_total_mul := v_streak_mul * v_cap_mul * v_back_mul;

  -- Effort always counts for something, however capped.
  v_points := GREATEST(1, ROUND(p_base_points * v_total_mul));

  INSERT INTO "point_ledger" ("id", "userId", "sourceType", "sourceId",
                              "points", "multiplier", "countedFor", "createdAt")
  VALUES (gen_random_uuid()::TEXT, p_user_id, p_source_type, p_source_id,
          v_points, v_total_mul, p_counted_for, NOW());

  UPDATE "profiles"
     SET "totalPoints"  = "totalPoints" + v_points,
         "lastActiveOn" = NOW()
   WHERE "userId" = p_user_id;

  RETURN QUERY SELECT v_points, v_total_mul;
END;
$$ LANGUAGE plpgsql;
