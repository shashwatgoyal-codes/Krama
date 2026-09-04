import { describe, it, expect } from "vitest";
import {
  RETENTION,
  cutoff,
  finishedCutoff,
  KEEP_OPTIONS,
} from "@/lib/retention";
import { retentionSchema } from "@/lib/validation";
import { normalisePath } from "@/lib/repositories/feedback";

/**
 * The settings that delete things.
 *
 * A retention window is a number that removes rows, so the way it fails
 * is silent and total: one bad coercion and "keep forever" becomes "keep
 * nothing". Every value that could reach it is tried here, including the
 * ones a hand-edited form could post.
 */

const NOW = new Date("2026-09-04T12:00:00.000Z");
const DAY = 86_400_000;
const DAYS = Array.from({ length: 400 }, (_, i) => i + 1);

describe("cutoff", () => {
  it.each(DAYS)("%i days back is exactly that many days back", (d) => {
    expect(NOW.getTime() - cutoff(d, NOW).getTime()).toBe(d * DAY);
  });

  it.each(DAYS)("%i days back is in the past", (d) => {
    expect(cutoff(d, NOW).getTime()).toBeLessThan(NOW.getTime());
  });
});

describe("finishedCutoff", () => {
  it.each(DAYS)("a limit of %i days selects a real instant", (d) => {
    const at = finishedCutoff(d, NOW);
    expect(at).not.toBeNull();
    expect(NOW.getTime() - at!.getTime()).toBe(d * DAY);
  });

  /**
   * Zero is forever. Every value that is not a positive number of days
   * must read the same way, because the alternative reading deletes
   * everything the moment something odd reaches the column.
   */
  const NOT_A_LIMIT = [
    0,
    -0,
    -1,
    -365,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -0.5,
    0.0,
  ];
  it.each(NOT_A_LIMIT)("%p means forever, never now", (v) => {
    expect(finishedCutoff(v as number, NOW)).toBeNull();
  });
});

describe("what the setting will accept", () => {
  it.each(KEEP_OPTIONS.map((o) => o.value))(
    "%i is offered and accepted",
    (v) => {
      expect(retentionSchema.safeParse({ keepFinishedDays: v }).success).toBe(
        true,
      );
    },
  );

  const OFFERED = new Set(KEEP_OPTIONS.map((o) => o.value as number));
  const CANDIDATES = Array.from({ length: 400 }, (_, i) => i).filter(
    (n) => !OFFERED.has(n),
  );
  it.each(CANDIDATES)("%i was never offered, so it is refused", (v) => {
    expect(retentionSchema.safeParse({ keepFinishedDays: v }).success).toBe(
      false,
    );
  });

  it.each(["", " ", "forever", "-1", "1e3", "null", "[]", "{}"])(
    "%j is refused",
    (v) => {
      expect(retentionSchema.safeParse({ keepFinishedDays: v }).success).toBe(
        false,
      );
    },
  );
});

describe("the windows are wide enough to be useful", () => {
  it("keeps a skipped routine day long enough to see a pattern", () => {
    expect(RETENTION.droppedRoutineDays).toBeGreaterThanOrEqual(28);
  });
  it("keeps rate-limit rows past any window that could still matter", () => {
    expect(RETENTION.authAttemptDays).toBeGreaterThanOrEqual(7);
  });
  it("does not remove a session before it has even expired", () => {
    expect(RETENTION.expiredSessionDays).toBeGreaterThan(0);
  });
});

/**
 * The screen a report came from is context, not tracking — so it is
 * stored only when it is plainly one of our own routes.
 */
describe("the path stored with a report", () => {
  const KEEP = [
    "/app",
    "/app/notes",
    "/app/tasks",
    "/app/calendar",
    "/app/explore",
    "/app/rewards",
    "/app/inbox",
    "/app/profile",
    "/app/guide",
    "/app/devices",
    "/app/search",
    "/admin",
    "/admin/users",
    "/admin/feedback",
    "/login",
    "/signup",
    "/forgot",
    "/app/tasks/abc-123",
    "/a",
    "/A_b-c",
  ];
  it.each(KEEP)("%j is kept", (p) => expect(normalisePath(p)).toBe(p));

  const STRIPPED: [string, string][] = [
    ["/app/search?q=secret", "/app/search"],
    ["/app/notes#note-1", "/app/notes"],
    ["/app?a=1&b=2", "/app"],
    ["/app/tasks?id=x#y", "/app/tasks"],
  ];
  it.each(STRIPPED)("%j keeps only %j", (given, want) => {
    expect(normalisePath(given)).toBe(want);
  });

  const DROP = [
    "",
    " ",
    "app/notes",
    "https://example.com/app",
    "http://x/app",
    "//evil.example.com",
    "///app",
    "/app/<script>",
    "/app/notes ",
    " /app",
    "/app/../etc/passwd",
    "/app/%2e%2e",
    "/app|rm",
    "/app;ls",
    "/app\\notes",
    "/app\nnotes",
    "/app\tnotes",
    "javascript:alert(1)",
    "/app/" + "a".repeat(200),
    "/" + "b".repeat(500),
    // A dot is excluded on purpose: it is the first character of every
    // traversal attempt, and no route of ours needs one.
    "/A_b-c.d",
    "/app/file.json",
    "/app/.env",
  ];
  it.each(DROP)("%j is dropped", (p) => expect(normalisePath(p)).toBeNull());

  it.each([null, undefined])("%p is dropped", (p) => {
    expect(normalisePath(p)).toBeNull();
  });
});
