/**
 * When a routine stops.
 *
 * The presets exist because the honest answer to "when does this end?"
 * is usually one of four things — never, this month, this year, or a
 * date you have in mind — and a bare date picker makes you compute the
 * first three yourself. "End of this month" is one click; working out
 * that it means the 30th is not something anyone should have to do to
 * set up a routine.
 *
 * Pure functions only: this is imported by client components, so it must
 * never reach for a repository.
 */

export const UNTIL_PRESETS = [
  { value: "never", label: "Never" },
  { value: "month", label: "End of this month" },
  { value: "year", label: "End of this year" },
  { value: "date", label: "On a date…" },
] as const;

export type UntilPreset = (typeof UNTIL_PRESETS)[number]["value"];

export function isUntilPreset(value: string): value is UntilPreset {
  return UNTIL_PRESETS.some((p) => p.value === value);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The last day of the month containing `dayKey`. */
export function endOfMonth(dayKey: string): string {
  const [y, m] = dayKey.split("-").map(Number);
  // Day 0 of the next month is the last day of this one, which also
  // gets February right in a leap year without a table of lengths.
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${y}-${pad(m!)}-${pad(last)}`;
}

/** The last day of the year containing `dayKey`. */
export function endOfYear(dayKey: string): string {
  return `${dayKey.slice(0, 4)}-12-31`;
}

/**
 * Turns a chosen preset into the day the routine last runs.
 *
 * Returns null for "never", which is the default: most routines are
 * genuinely open-ended, and making everyone invent an end date would be
 * friction for the common case.
 */
export function resolveUntil(
  preset: UntilPreset,
  today: string,
  chosenDate?: string | null,
): string | null {
  if (preset === "never") return null;
  if (preset === "month") return endOfMonth(today);
  if (preset === "year") return endOfYear(today);
  // A date that is missing or malformed means the picker was opened and
  // never filled in — treat that as open-ended rather than as an error,
  // since refusing to save the whole routine over it would be worse.
  if (!chosenDate || !/^\d{4}-\d{2}-\d{2}$/.test(chosenDate)) return null;
  return chosenDate;
}

/** Which preset a stored date corresponds to, for showing the control. */
export function presetFor(
  until: string | null,
  today: string,
): UntilPreset {
  if (!until) return "never";
  if (until === endOfMonth(today)) return "month";
  if (until === endOfYear(today)) return "year";
  return "date";
}

/** "until 31 March" — how the end reads next to the routine. */
export function describeUntil(until: string | null): string {
  if (!until) return "";
  const at = new Date(`${until}T00:00:00.000Z`);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(at);
}

/** Whether a routine has already finished as of `today`. */
export function hasEnded(until: string | null, today: string): boolean {
  return Boolean(until && today > until);
}
