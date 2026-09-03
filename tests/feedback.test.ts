import { describe, it, expect } from "vitest";
import { normalisePath } from "@/lib/repositories/feedback";
import { KIND_LABEL, STATUS_LABEL, FEEDBACK_KINDS } from "@/lib/feedback";
import { feedbackSchema } from "@/lib/validation";

/**
 * The path a report came from is context, not tracking.
 *
 * It is stored so "this is broken" arrives with the screen attached. That
 * makes it worth being strict about: a value that is not plainly one of
 * our own routes is dropped rather than tidied, because the tidying is
 * where somebody's search terms end up in an admin table.
 */
describe("normalisePath", () => {
  it("keeps an ordinary in-app path", () => {
    expect(normalisePath("/app/notes")).toBe("/app/notes");
    expect(normalisePath("/app")).toBe("/app");
  });

  it("drops the query string rather than storing it", () => {
    expect(normalisePath("/app/search?q=my+medical+results")).toBe(
      "/app/search",
    );
    expect(normalisePath("/app/notes#note-1")).toBe("/app/notes");
  });

  it("refuses anything that is not a path", () => {
    expect(normalisePath("https://example.com/app")).toBeNull();
    expect(normalisePath("app/notes")).toBeNull();
    expect(normalisePath("")).toBeNull();
    expect(normalisePath(null)).toBeNull();
    expect(normalisePath(undefined)).toBeNull();
  });

  it("refuses a protocol-relative URL, which starts with a slash but is not ours", () => {
    expect(normalisePath("//evil.example.com/app")).toBeNull();
  });

  it("refuses characters that do not belong in our routes", () => {
    expect(normalisePath("/app/<script>")).toBeNull();
    expect(normalisePath("/app/notes ")).toBeNull();
    expect(normalisePath("/app/../etc")).toBeNull();
  });

  it("refuses one long enough to be a payload rather than a route", () => {
    expect(normalisePath("/app/" + "a".repeat(200))).toBeNull();
  });
});

describe("what may be sent", () => {
  it("takes a real message", () => {
    const r = feedbackSchema.safeParse({
      kind: "problem",
      message: "The calendar shows my routine twice.",
    });
    expect(r.success).toBe(true);
  });

  it("turns away something too short to act on", () => {
    const r = feedbackSchema.safeParse({ kind: "idea", message: "hi" });
    expect(r.success).toBe(false);
  });

  it("trims before measuring, so spaces are not a message", () => {
    const r = feedbackSchema.safeParse({ kind: "idea", message: "        " });
    expect(r.success).toBe(false);
  });

  it("turns away one longer than we store", () => {
    const r = feedbackSchema.safeParse({
      kind: "idea",
      message: "a".repeat(2001),
    });
    expect(r.success).toBe(false);
  });

  it("refuses a kind we do not have", () => {
    const r = feedbackSchema.safeParse({
      kind: "complaint",
      message: "This is long enough.",
    });
    expect(r.success).toBe(false);
  });
});

describe("labels", () => {
  it("names every kind, so none renders as a raw enum", () => {
    for (const k of FEEDBACK_KINDS) {
      expect(KIND_LABEL[k]).toBeTruthy();
      expect(KIND_LABEL[k]).not.toBe(k);
    }
  });

  it("names every status", () => {
    for (const s of ["new", "read", "done"] as const) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
