/**
 * What a brand-new account starts with.
 *
 * An empty planner is a planner you close again — there is nothing to
 * look at and nothing to finish, so the first session ends before it
 * starts. These are the few things that make the app show what it is
 * for on day one: three areas to file work under, and one routine that
 * is already on the calendar.
 *
 * The gym session is deliberately worth the top of the scale. It is the
 * kind of thing you do not feel like doing and are glad to have done,
 * which is exactly what the points are for.
 */

export const DEFAULT_AREAS = [
  { name: "Work", colour: "acc", order: 0 },
  { name: "Learning", colour: "ok", order: 1 },
  { name: "Personal", colour: "warn", order: 2 },
] as const;

/** Every day but Sunday. */
export const GYM_DAYS = [1, 2, 3, 4, 5, 6];

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
