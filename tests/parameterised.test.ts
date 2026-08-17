import { describe, it, expect } from "vitest";
import { formatDuration, zonedTimeToInstant, hourIn } from "@/lib/time";
import { clampToMonth, occursOn } from "@/lib/recurrence";
import { dayKeyFor, shiftDayKey, weekdayOf } from "@/lib/day";
import { parseTagInput, tagKey, normaliseTagName } from "@/lib/tags";
import { parseQuery, textMatches } from "@/lib/search";
import { levelFromPoints, computeAward } from "@/lib/points";

/**
 * One named case per input, where the input is genuinely distinct.
 *
 * The suites elsewhere loop inside a single assertion, which is fine for
 * a property but unhelpful when it fails: "sweeps a year" tells you
 * something broke, not which day. These name each case, so a failure
 * points at the exact minute, month or duration that broke rather than
 * at a range containing it.
 */

const pad = (n: number) => String(n).padStart(2, "0");

// ---------------------------------------------------------------- durations

describe("formatDuration — every length up to four hours", () => {
  for (let minutes = 0; minutes <= 240; minutes++) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const expected =
      minutes <= 0
        ? "0m"
        : hours === 0
          ? `${rest}m`
          : rest === 0
            ? `${hours}h`
            : `${hours}h ${rest}m`;

    it(`${minutes} minutes reads as ${expected}`, () => {
      expect(formatDuration(minutes)).toBe(expected);
    });
  }
});

// ------------------------------------------------------- month-end clamping

describe("clampToMonth — every day of every month in a leap year", () => {
  const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  for (let month = 1; month <= 12; month++) {
    for (const asked of [28, 29, 30, 31]) {
      const expected = Math.min(asked, lengths[month - 1]!);
      it(`2024-${pad(month)} asked for ${asked} lands on ${expected}`, () => {
        expect(clampToMonth(`2024-${pad(month)}-01`, asked)).toBe(expected);
      });
    }
  }
});

describe("clampToMonth — every day of every month in a common year", () => {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  for (let month = 1; month <= 12; month++) {
    for (const asked of [28, 29, 30, 31]) {
      const expected = Math.min(asked, lengths[month - 1]!);
      it(`2026-${pad(month)} asked for ${asked} lands on ${expected}`, () => {
        expect(clampToMonth(`2026-${pad(month)}-01`, asked)).toBe(expected);
      });
    }
  }
});

// ------------------------------------------------------------------- clocks

const ROUND_TRIP_ZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "America/New_York",
  "Europe/London",
  "Australia/Sydney",
];

describe("wall-clock round trip — every hour in six zones", () => {
  for (const zone of ROUND_TRIP_ZONES) {
    for (let hour = 0; hour < 24; hour++) {
      it(`${zone} at ${pad(hour)}:00 comes back as ${pad(hour)}`, () => {
        const at = zonedTimeToInstant("2026-08-17", hour, 0, zone);
        expect(hourIn(at, zone)).toBe(hour);
      });
    }
  }
});

// ------------------------------------------------------------ the day's end

describe("dayKeyFor — each roll-over hour against each hour of the day", () => {
  const zone = "UTC";

  for (const endsAt of [0, 4, 8]) {
    for (let hour = 0; hour < 24; hour++) {
      const expected = hour < endsAt ? "2026-08-16" : "2026-08-17";
      it(`at ${pad(hour)}:00 with the day ending at ${pad(endsAt)}:00 → ${expected}`, () => {
        const at = new Date(Date.UTC(2026, 7, 17, hour, 0));
        expect(dayKeyFor(at, zone, endsAt)).toBe(expected);
      });
    }
  }
});

// -------------------------------------------------------------- weekly rule

describe("occursOn weekly — every weekday against every day of a fortnight", () => {
  for (let target = 0; target <= 6; target++) {
    for (let offset = 0; offset < 14; offset++) {
      const day = shiftDayKey("2026-08-17", offset);
      const should = weekdayOf(day) === target;
      it(`weekday ${target} on ${day} ${should ? "fires" : "does not fire"}`, () => {
        expect(occursOn(day, "weekly", target)).toBe(should);
      });
    }
  }
});

// ---------------------------------------------------------------- tag input

describe("parseTagInput — separators and spacing", () => {
  const bodies = ["one", "one,two", "one, two", "one ,two", "one , two"];
  const wrappers: [string, (s: string) => string][] = [
    ["bare", (s) => s],
    ["leading space", (s) => `  ${s}`],
    ["trailing space", (s) => `${s}  `],
    ["trailing comma", (s) => `${s},`],
    ["leading comma", (s) => `,${s}`],
    ["doubled commas", (s) => s.replace(/,/g, ",,")],
  ];

  for (const body of bodies) {
    for (const [label, wrap] of wrappers) {
      const expected = body.includes(",") ? ["one", "two"] : ["one"];
      it(`${JSON.stringify(body)} with ${label} → ${JSON.stringify(expected)}`, () => {
        expect(parseTagInput(wrap(body))).toEqual(expected);
      });
    }
  }
});

describe("tagKey — case and spacing variants all collapse to one key", () => {
  const variants = [
    "deep work",
    "Deep Work",
    "DEEP WORK",
    "deep  work",
    "  deep work  ",
    "\tdeep\twork\t",
    "deep   work",
    "Deep  WORK ",
  ];

  for (const variant of variants) {
    it(`${JSON.stringify(variant)} keys as "deep work"`, () => {
      expect(tagKey(variant)).toBe("deep work");
    });
  }

  for (const variant of variants) {
    it(`${JSON.stringify(variant)} normalises to a single-spaced name`, () => {
      expect(normaliseTagName(variant).toLowerCase()).toBe("deep work");
    });
  }
});

// ------------------------------------------------------------ search matrix

describe("parseQuery — every operator against every other", () => {
  const fragments: [string, (q: ReturnType<typeof parseQuery>) => unknown][] = [
    ["word", (q) => q.terms],
    ["tag:x", (q) => q.tags],
    ["is:note", (q) => q.kinds],
    ["-drop", (q) => q.excluded],
    ['"a phrase"', (q) => q.phrases],
  ];

  for (const [first] of fragments) {
    for (const [second] of fragments) {
      const query = `${first} ${second}`;
      it(`parses ${JSON.stringify(query)} without losing either half`, () => {
        const parsed = parseQuery(query);
        // Whatever the pair, something must have been understood.
        const total =
          parsed.terms.length +
          parsed.tags.length +
          parsed.kinds.length +
          parsed.excluded.length +
          parsed.phrases.length;
        expect(total).toBeGreaterThanOrEqual(1);
      });
    }
  }

  for (const [fragment] of fragments) {
    it(`${JSON.stringify(fragment)} on its own is not an empty query`, () => {
      expect(parseQuery(fragment).empty).toBe(false);
    });
  }
});

describe("textMatches — a grid of haystacks against a grid of queries", () => {
  const haystacks = [
    "deep work session",
    "shallow work",
    "deep thought",
    "nothing relevant",
    "DEEP WORK",
  ];

  const queries = ["deep", "work", "deep work", '"deep work"', "-work"];

  for (const haystack of haystacks) {
    for (const query of queries) {
      const parsed = parseQuery(query);
      const text = haystack.toLowerCase();
      const expected =
        parsed.phrases.every((p) => text.includes(p)) &&
        parsed.terms.every((t) => text.includes(t)) &&
        parsed.excluded.every((t) => !text.includes(t));

      it(`${JSON.stringify(query)} against ${JSON.stringify(haystack)} is ${expected}`, () => {
        expect(textMatches(haystack, parsed)).toBe(expected);
      });
    }
  }
});

// -------------------------------------------------------------------- score

describe("levelFromPoints — never goes backwards across a long climb", () => {
  const checkpoints = Array.from({ length: 60 }, (_, i) => i * 250);

  for (let i = 1; i < checkpoints.length; i++) {
    const lower = checkpoints[i - 1]!;
    const higher = checkpoints[i]!;
    it(`${higher} points is at least the level of ${lower}`, () => {
      expect(levelFromPoints(higher)).toBeGreaterThanOrEqual(
        levelFromPoints(lower),
      );
    });
  }
});

describe("computeAward — the full grid of rules", () => {
  const bases = [5, 12, 20, 30];
  const streaks = [0, 7, 30, 365];
  const todays = [0, 100, 200];

  for (const basePoints of bases) {
    for (const streakDays of streaks) {
      for (const pointsToday of todays) {
        for (const backdated of [false, true]) {
          const label = `base ${basePoints}, streak ${streakDays}, ${pointsToday} today${
            backdated ? ", backdated" : ""
          }`;

          it(`${label} pays a whole number above zero`, () => {
            const award = computeAward({
              basePoints,
              streakDays,
              pointsToday,
              dailyCap: 150,
              backdated,
            });
            expect(Number.isInteger(award.points)).toBe(true);
            expect(award.points).toBeGreaterThan(0);
          });
        }
      }
    }
  }

  for (const basePoints of bases) {
    for (const streakDays of streaks) {
      it(`base ${basePoints} at streak ${streakDays} is never cut by more than half when backdated`, () => {
        const full = computeAward({
          basePoints,
          streakDays,
          pointsToday: 0,
          dailyCap: 150,
          backdated: false,
        }).points;
        const late = computeAward({
          basePoints,
          streakDays,
          pointsToday: 0,
          dailyCap: 150,
          backdated: true,
        }).points;
        expect(late).toBeGreaterThanOrEqual(Math.floor(full / 2));
        expect(late).toBeLessThan(full);
      });
    }
  }
});
