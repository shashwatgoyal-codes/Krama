/**
 * What a brand-new account starts with: three areas to file work under,
 * and nothing else.
 *
 * The gym routine below is deliberately NOT seeded. It was, briefly, and
 * that was wrong: a routine is a personal commitment, and inventing
 * somebody else's is presumptuous however well-meant. An empty planner
 * is a weaker first impression than a full one, but a planner that has
 * already decided you go to the gym is worse.
 *
 * It stays here as a shape — the thing to copy when adding a routine to
 * one account on purpose, and what the projection tests are written
 * against.
 */

export const DEFAULT_AREAS = [
  { name: "Work", colour: "acc", order: 0 },
  { name: "Learning", colour: "ok", order: 1 },
  { name: "Personal", colour: "warn", order: 2 },
] as const;

/** Every day but Sunday. */
export const GYM_DAYS = [1, 2, 3, 4, 5, 6];

/** Not seeded. See the note above. */
export const GYM_ROUTINE = {
  title: "Gym session",
  points: 30,
  /** 08:00, as minutes from midnight. */
  routineStartMinute: 8 * 60,
  /** 08:00 – 09:30. */
  routineMinutes: 90,
  recurrence: "weekly" as const,
  recurrenceDays: GYM_DAYS,
  notes: "Rest on Sunday. Showing up is the whole thing.",
};
