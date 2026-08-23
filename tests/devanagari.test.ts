import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Where क्रम is allowed to appear.
 *
 * The decision was that the name in Devanagari earns its place in one
 * spot — the panel beside the sign-in form — and nowhere else. Not the
 * header, not the empty states. A word you meet on every screen stops
 * being read by the second week, and the header only just fits on a
 * 375px phone as it is.
 *
 * That is a design decision with nothing structural holding it in
 * place, which makes it exactly the kind of thing that drifts: someone
 * adds it to an empty state because the screen looked bare, and a year
 * later it is everywhere and means nothing. There is no DOM test
 * harness in this project, so this guards the source instead.
 */

const DEVANAGARI = /[ऀ-ॿ]/;
const ALLOWED = ["components/auth/AuthShell.tsx"];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (/\.(ts|tsx|css)$/.test(entry)) found.push(full);
  }
  return found;
}

describe("क्रम appears in exactly one place", () => {
  const root = process.cwd();
  const files = [...sourceFiles(join(root, "app")), ...sourceFiles(join(root, "components"))]
    .map((f) => f.slice(root.length + 1));

  it("finds the app and component sources to check", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(files.length).toBeGreaterThan(20);
  });

  it("carries the Devanagari in the auth aside", () => {
    const shell = readFileSync(join(root, "components/auth/AuthShell.tsx"), "utf8");
    expect(DEVANAGARI.test(shell)).toBe(true);
    expect(shell).toContain("क्रम");
  });

  it("carries it nowhere else", () => {
    const stray = files.filter(
      (f) => !ALLOWED.includes(f) && DEVANAGARI.test(readFileSync(join(root, f), "utf8")),
    );
    expect(stray).toEqual([]);
  });

  it("keeps it out of the top bar specifically", () => {
    // Named on its own because this is the one that would be tempting:
    // the header is where a brand mark "belongs", and it is also the
    // element with the least room to spare.
    const bar = readFileSync(join(root, "components/TopBar.tsx"), "utf8");
    expect(DEVANAGARI.test(bar)).toBe(false);
  });

  it("pairs the glyph with a readable transliteration", () => {
    // The glyph alone tells you nothing if you cannot read it, and it
    // is the gloss that makes the name mean something.
    const shell = readFileSync(join(root, "components/auth/AuthShell.tsx"), "utf8");
    expect(shell).toMatch(/step, sequence, order/);
  });

  it("is announced to screen readers as Krama, not as an unread glyph", () => {
    const shell = readFileSync(join(root, "components/auth/AuthShell.tsx"), "utf8");
    expect(shell).toContain("sr-only");
    expect(shell).toContain('aria-hidden="true"');
  });

  it("has a Devanagari font stack to render with", () => {
    const css = readFileSync(join(root, "app/globals.css"), "utf8");
    expect(css).toContain("--font-deva");
    expect(css).toMatch(/Kohinoor Devanagari/);
    // Windows and Linux, not just this laptop.
    expect(css).toMatch(/Nirmala UI/);
    expect(css).toMatch(/Noto Sans Devanagari/);
  });
});
