import { describe, it, expect } from "vitest";

/**
 * Fixtures use example.invalid — a domain RFC 2606 reserves so that it
 * can never resolve — rather than a realistic Neon host.
 *
 * A convincing fake connection string sets off secret scanners, and an
 * alert that is always a false alarm trains everyone to ignore the one
 * that is not. Nothing here should be mistakable for a real credential,
 * by a person or by a scanner.
 */
import { toDirectUrl, toPooledUrl, isPooled, withVerifiedSsl } from "@/lib/neon";

const POOLED =
  "postgresql://example_user:example_password@ep-example-123-pooler.example.invalid/krama?sslmode=require";
const DIRECT =
  "postgresql://example_user:example_password@ep-example-123.example.invalid/krama?sslmode=require";

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
      "postgresql://example_user:pa.ss.word@ep-example-123.example.invalid/db";
    const pooled = toPooledUrl(withDots);
    expect(pooled).toContain("pa.ss.word");
    expect(pooled).toContain("ep-example-123-pooler.example.invalid");
  });

  it("survives an empty value rather than throwing", () => {
    // The build runs before anyone has configured a database.
    expect(toDirectUrl("")).toBe("");
    expect(toPooledUrl("")).toBe("");
  });
});

describe("withVerifiedSsl", () => {
  it("raises sslmode=require to verify-full", () => {
    // pg treats `require` as verify-full today and will stop doing so in
    // v9, silently dropping certificate verification on the same URL.
    const out = withVerifiedSsl(
      "postgresql://u:p@ep-example-123-pooler.example.invalid/db?sslmode=require",
    );
    expect(out).toContain("sslmode=verify-full");
    expect(out).not.toContain("sslmode=require");
  });

  it("raises the other weak modes too", () => {
    for (const mode of ["prefer", "verify-ca", "allow"]) {
      expect(
        withVerifiedSsl(`postgresql://u:p@h/db?sslmode=${mode}`),
      ).toContain("sslmode=verify-full");
    }
  });

  it("leaves an explicit disable alone", () => {
    // Someone running without TLS on purpose, presumably locally.
    // Silently encrypting it would be its own surprise.
    expect(withVerifiedSsl("postgresql://u:p@localhost/db?sslmode=disable"))
      .toContain("sslmode=disable");
  });

  it("adds the mode when the URL has none", () => {
    expect(withVerifiedSsl("postgresql://u:p@h/db")).toContain(
      "sslmode=verify-full",
    );
  });

  it("keeps every other parameter", () => {
    const out = withVerifiedSsl(
      "postgresql://u:p@h/db?sslmode=require&channel_binding=require",
    );
    expect(out).toContain("channel_binding=require");
  });

  it("returns nonsense unchanged rather than throwing", () => {
    expect(withVerifiedSsl("not a url")).toBe("not a url");
    expect(withVerifiedSsl("")).toBe("");
  });
});
