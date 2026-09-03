import { describe, it, expect } from "vitest";
import {
  RETENTION,
  cutoff,
  finishedCutoff,
  KEEP_OPTIONS,
} from "@/lib/retention";
import { retentionSchema } from "@/lib/validation";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const DAY = 86_400_000;

describe("cutoff", () => {
  it("is the instant that many days ago", () => {
    expect(cutoff(30, NOW).toISOString()).toBe("2026-08-04T12:00:00.000Z");
    expect(cutoff(0, NOW).getTime()).toBe(NOW.getTime());
  });
});

/**
 * Zero means forever.
 *
 * The reading that loses data is never the one a default should take, and
 * "keep for 0 days" is one careless coercion away from deleting the lot.
 */
describe("finishedCutoff", () => {
  it("returns null for forever, so nothing is selected for removal", () => {
    expect(finishedCutoff(0, NOW)).toBeNull();
  });

  it("treats every meaningless value as forever rather than as now", () => {
    expect(finishedCutoff(-1, NOW)).toBeNull();
    expect(finishedCutoff(Number.NaN, NOW)).toBeNull();
    expect(finishedCutoff(Number.POSITIVE_INFINITY, NOW)).toBeNull();
  });

  it("returns a real cutoff when a limit is chosen", () => {
    const at = finishedCutoff(90, NOW);
    expect(at).not.toBeNull();
    expect(NOW.getTime() - at!.getTime()).toBe(90 * DAY);
  });
});

describe("what may be set", () => {
  it("accepts every option the screen offers", () => {
    for (const o of KEEP_OPTIONS) {
      expect(
        retentionSchema.safeParse({ keepFinishedDays: o.value }).success,
      ).toBe(true);
    }
  });

  it("refuses a number nobody was offered", () => {
    for (const n of [1, 7, 30, 10000, -5]) {
      expect(retentionSchema.safeParse({ keepFinishedDays: n }).success).toBe(
        false,
      );
    }
  });

  it("offers keeping things forever, and offers it first", () => {
    expect(KEEP_OPTIONS[0].value).toBe(0);
  });
});

describe("the windows themselves", () => {
  it("keeps a skipped routine day long enough to notice a pattern", () => {
    expect(RETENTION.droppedRoutineDays).toBeGreaterThanOrEqual(28);
  });

  it("outlives the rate-limit window it exists to serve", () => {
    expect(RETENTION.authAttemptDays).toBeGreaterThanOrEqual(7);
  });
});
