-- The award function read profiles."streakDays" to size the streak
-- multiplier. Nothing ever wrote that column, so it sat at 0 and every
-- award since the beginning has quietly paid a flat 1.00x — the streak
-- bonus existed in the schema, in the SQL and in the tests, and never
-- once reached a user.
--
-- The streak is now derived from the ledger (lib/streak.ts), which makes
-- it correct without a scheduled job: a counter only notices a missed
-- day when something else happens to update it, so it stays wrong for
-- exactly as long as someone stays away.
--
-- Rather than reimplement that walk in plpgsql and have two definitions
-- of the rule drift apart, the caller computes it and passes it in. The
-- value is derived server-side from the same ledger this function
-- writes to, never supplied by a client. The column is still updated so
-- that anything reading the profile row sees the truth.

DROP FUNCTION IF EXISTS krama_award_points(TEXT, "PointSource", TEXT, INT, TIMESTAMP, BOOLEAN);

CREATE OR REPLACE FUNCTION krama_award_points(
  p_user_id     TEXT,
  p_source_type "PointSource",
  p_source_id   TEXT,
  p_base_points INT,
  p_counted_for TIMESTAMP,
  p_backdated   BOOLEAN,
  p_streak      INT
)
RETURNS TABLE (awarded INT, multiplier NUMERIC) AS $$
DECLARE
  v_cap        INT;
  v_today      INT;
  v_streak     INT;
  v_streak_mul NUMERIC;
  v_cap_mul    NUMERIC;
  v_back_mul   NUMERIC;
  v_total_mul  NUMERIC;
  v_points     INT;
BEGIN
  -- Locks the profile row for the rest of the transaction. A second
  -- concurrent award for the same user waits here rather than reading a
  -- stale daily total.
  SELECT "dailyCap" INTO v_cap
    FROM "profiles"
   WHERE "userId" = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile for user %', p_user_id;
  END IF;

  v_streak := LEAST(GREATEST(COALESCE(p_streak, 0), 0), 30);

  SELECT COALESCE(SUM("points"), 0)
    INTO v_today
    FROM "point_ledger"
   WHERE "userId" = p_user_id
     AND "countedFor" = p_counted_for;

  -- Streak multiplier, capped at 1.60 so a long streak can't dwarf the work.
  v_streak_mul := 1 + (v_streak * 0.02);

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
         "streakDays"   = COALESCE(p_streak, "streakDays"),
         "lastActiveOn" = NOW()
   WHERE "userId" = p_user_id;

  RETURN QUERY SELECT v_points, v_total_mul;
END;
$$ LANGUAGE plpgsql;
