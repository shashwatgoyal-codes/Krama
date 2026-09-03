/**
 * How long things are kept.
 *
 * Pure policy, no database — so it can be reasoned about and tested
 * without one, and so the client can describe the rules to the person
 * they apply to.
 *
 * The shape of the answer matters more than the numbers. Two categories:
 *
 *   Noise      — rows that record an absence or a moment that has passed.
 *                A routine day you skipped, an expired session, a spent
 *                one-time code, a rate-limit window from last month.
 *                These are swept automatically, because keeping them
 *                serves nobody and they grow one-per-day forever.
 *
 *   History    — what someone actually did. Finished tasks, notes, saved
 *                links, the point ledger, the audit log. None of this is
 *                ever removed without being asked, and the ledger and
 *                audit log cannot be removed at all: both are append-only
 *                at the database level.
 *
 * The distinction is the whole design. Sweeping noise costs nothing;
 * sweeping history to save space would be trading the reason the app
 * exists for a few megabytes.
 */

export const RETENTION = {
  /**
   * A routine day that went by unfinished is marked dropped rather than
   * deleted, so it stays visible for a while — long enough to notice a
   * routine you keep missing. After that it is one row per skipped day
   * per routine, saying nothing.
   */
  droppedRoutineDays: 30,

  /** An expired session cannot be used; it is only a device name now. */
  expiredSessionDays: 7,

  /**
   * Rate-limit rows outlive their window by definition. Past this they
   * cannot influence any decision.
   */
  authAttemptDays: 30,
} as const;

/** The instant before which something of this age may go. */
export function cutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * How long finished tasks are kept, as the setting means it.
 *
 * Zero is forever rather than "delete immediately" — the reading that
 * loses data is never the one a default should take.
 */
export function finishedCutoff(
  keepFinishedDays: number,
  now: Date = new Date(),
): Date | null {
  if (!Number.isFinite(keepFinishedDays) || keepFinishedDays <= 0) return null;
  return cutoff(keepFinishedDays, now);
}

/** The choices offered in settings. */
export const KEEP_OPTIONS = [
  { value: 0, label: "Forever" },
  { value: 365, label: "For a year" },
  { value: 180, label: "For six months" },
  { value: 90, label: "For three months" },
] as const;

/** What never goes, whatever anyone sets. */
export const NEVER_REMOVED = [
  "Your points, which are kept as an append-only ledger the app itself cannot edit or delete",
  "Notes and saved links, which are removed only when you remove them",
  "The admin audit log, for the same reason as the ledger",
] as const;
