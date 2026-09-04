-- Remove the flags for features that are not going to be built.
--
-- Four rows were seeded for a v2 that has been dropped: the app does what
-- it needs to in its present state, and the four were only ever promises.
-- No code has ever read them — they existed solely so the admin Flags
-- screen could list what was coming.
--
-- A flag at 0% for something nobody is building is worse than no flag. It
-- reads as work in progress on a screen whose whole job is to say what is
-- switched on, and the next person to see it has to go and find out that
-- the answer is "nothing, ever".
--
-- open_registration stays: it is wired to /signup and does real work.
DELETE FROM feature_flags
 WHERE "key" IN ('email_digest', 'focus_timer', 'weekly_review', 'habits');
