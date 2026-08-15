import { describe, it, expect } from "vitest";
import { toDirectUrl, toPooledUrl, isPooled } from "@/lib/neon";

const POOLED =
  "postgresql://krama_owner:npg_secret@ep-still-frost-a1b2c3-pooler.ap-south-1.aws.neon.tech/krama?sslmode=require";
const DIRECT =
  "postgresql://krama_owner:npg_secret@ep-still-frost-a1b2c3.ap-south-1.aws.neon.tech/krama?sslmode=require";

describe("deriving one Neon URL from the other", () => {
  it("turns a pooled URL into a direct one", () => {
    expect(toDirectUrl(POOLED)).toBe(DIRECT);
  });

  it("turns a direct URL into a pooled one", () => {
    expect(toPooledUrl(DIRECT)).toBe(POOLED);
  });

  it("leaves an already-correct URL alone", () => {
    expect(toDirectUrl(DIRECT)).toBe(DIRECT);
    expect(toPooledUrl(POOLED)).toBe(POOLED);
  });

  it("round-trips in both directions", () => {
    expect(toPooledUrl(toDirectUrl(POOLED))).toBe(POOLED);
    expect(toDirectUrl(toPooledUrl(DIRECT))).toBe(DIRECT);
  });

  it("recognises which one it has", () => {
    expect(isPooled(POOLED)).toBe(true);
    expect(isPooled(DIRECT)).toBe(false);
  });

  it("doesn't mangle a password containing dots", () => {
    const withDots =
      "postgresql://user:pa.ss.word@ep-abc-123.ap-south-1.aws.neon.tech/db";
    const pooled = toPooledUrl(withDots);
    expect(pooled).toContain("pa.ss.word");
    expect(pooled).toContain("ep-abc-123-pooler.ap-south-1");
  });

  it("survives an empty value rather than throwing", () => {
    // The build runs before anyone has configured a database.
    expect(toDirectUrl("")).toBe("");
    expect(toPooledUrl("")).toBe("");
  });
});
