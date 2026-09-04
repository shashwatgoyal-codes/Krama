import { describe, it, expect } from "vitest";
import {
  looksLikeUrl,
  suggest,
  normaliseCapture,
  isCapturable,
  SUGGESTION_LABEL,
} from "@/lib/capture";

/**
 * What a captured line is guessed to be.
 *
 * The guess only picks which button is highlighted — every option stays
 * available — so being wrong is cheap. Being wrong *often* is not: a
 * suggestion you override every time is worse than none, because you
 * read it before ignoring it.
 */

describe("looksLikeUrl", () => {
  const urls = [
    "https://example.com",
    "http://example.com/path?q=1",
    "https://sub.example.co.uk/a/b",
    "example.com",
    "www.example.com",
    "example.com/some/path",
  ];
  for (const u of urls) it(`accepts ${u}`, () => expect(looksLikeUrl(u)).toBe(true));

  const notUrls = [
    "",
    "   ",
    "buy milk",
    "read example.com later",     // a sentence that mentions one
    "call mum",
    "example",                    // no dot
    "2.30 meeting",               // a time, not a domain
    "notes about the redesign",
  ];
  for (const t of notUrls) {
    it(`rejects ${JSON.stringify(t)}`, () => expect(looksLikeUrl(t)).toBe(false));
  }

  it("ignores surrounding whitespace", () => {
    expect(looksLikeUrl("  https://example.com  ")).toBe(true);
  });
});

describe("suggest", () => {
  it("sends a bare URL to Explore", () => {
    expect(suggest("https://example.com/article")).toBe("link");
  });

  it("treats a short single line as something to do", () => {
    expect(suggest("email the landlord")).toBe("task");
  });

  it("treats anything with a line break as a thought", () => {
    expect(suggest("two things\nto think about")).toBe("note");
  });

  it("treats a long line as a thought", () => {
    expect(suggest("a".repeat(120))).toBe("note");
  });

  it("keeps the boundary stable", () => {
    expect(suggest("a".repeat(80))).toBe("task");
    expect(suggest("a".repeat(81))).toBe("note");
  });

  it("labels every suggestion it can make", () => {
    for (const s of ["link", "task", "note"] as const) {
      expect(SUGGESTION_LABEL[s].length).toBeGreaterThan(0);
    }
  });
});

describe("normaliseCapture", () => {
  it("trims", () => expect(normaliseCapture("  hi  ")).toBe("hi"));

  it("normalises Windows line endings, so the same text is the same text", () => {
    expect(normaliseCapture("a\r\nb")).toBe("a\nb");
  });

  it("caps length rather than rejecting", () => {
    // Losing the tail of a very long paste is better than losing all of
    // it at the moment somebody was trying not to lose a thought.
    expect(normaliseCapture("x".repeat(5000))).toHaveLength(1000);
  });

  it("survives nothing at all", () => {
    expect(normaliseCapture("")).toBe("");
    expect(normaliseCapture("   \n  ")).toBe("");
  });
});

describe("isCapturable", () => {
  for (const empty of ["", " ", "\n", "\r\n", "   \t  "]) {
    it(`refuses ${JSON.stringify(empty)}`, () => expect(isCapturable(empty)).toBe(false));
  }
  it("accepts anything with a character in it", () => {
    expect(isCapturable("a")).toBe(true);
  });
});
