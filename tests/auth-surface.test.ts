import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Two decisions about the auth screens that nothing structural holds in
 * place, so they are asserted here instead.
 *
 * There is no DOM test harness in this project — every test is a pure
 * function — so these read the source. That is a blunt instrument, and
 * it is still better than finding out from a screenshot months later.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

const AUTH_SCREENS = [
  "app/(auth)/login/page.tsx",
  "app/(auth)/signup/page.tsx",
  "components/auth/ResetFlow.tsx",
];

describe("every password box can be revealed", () => {
  for (const file of AUTH_SCREENS) {
    it(`${file} uses PasswordField`, () => {
      const src = read(file);
      expect(src).toContain("PasswordField");
    });

    it(`${file} has no bare password input left`, () => {
      // A raw type="password" here is one someone cannot read back, and
      // retyping a passphrase blind is where people give up and reach
      // for the reset link instead.
      expect(read(file)).not.toContain('type="password"');
    });
  }

  it("the toggle cannot submit the form it sits in", () => {
    // The button lives in one shared component now, used by both the
    // auth Field and the bare inputs on the profile screen.
    const src = read("components/ui/RevealToggle.tsx");
    expect(src).toContain('type="button"');
  });

  it("the toggle says which state it is in, for a screen reader", () => {
    const src = read("components/ui/RevealToggle.tsx");
    expect(src).toContain("aria-pressed");
    expect(src).toContain("Show password");
    expect(src).toContain("Hide password");
  });

  it("both password entry points go through the one toggle", () => {
    // Two implementations of this control would mean two places to get
    // type="button" and the aria wiring wrong.
    for (const f of [
      "components/auth/PasswordField.tsx",
      "components/ui/PasswordInput.tsx",
    ]) {
      expect(read(f)).toContain("RevealToggle");
    }
  });

  it("the profile screens no longer have bare password boxes", () => {
    for (const f of [
      "components/profile/ChangePasswordRow.tsx",
      "components/profile/DangerZone.tsx",
    ]) {
      expect(read(f)).toContain("PasswordInput");
      expect(read(f)).not.toContain('type="password"');
    }
  });

  it("starts hidden and remembers nothing between visits", () => {
    // Revealing a password is a decision about this moment and who is
    // behind you — not a preference worth persisting.
    const src = read("components/ui/PasswordInput.tsx");
    expect(src).toContain("useState(false)");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("sessionStorage");
  });
});

describe("the root path decides rather than landing", () => {
  const src = read("app/page.tsx");

  it("redirects instead of rendering a page", () => {
    expect(src).toContain("redirect(");
    expect(src).not.toContain("<main");
  });

  it("sends a signed-in visitor to the app and everyone else to sign in", () => {
    expect(src).toMatch(/redirect\(user \? "\/app" : "\/login"\)/);
  });

  it("checks the session against the database, not just the cookie", () => {
    // A cookie whose session has been revoked must land on /login, not
    // bounce into /app and straight back out.
    expect(src).toContain("getSessionUser");
  });

  it("stops advertising a public page to crawlers", () => {
    // Nothing is publicly readable now. Allowing "/" would point a
    // crawler at a door that closes in its face.
    const robots = read("app/robots.ts");
    expect(robots).toContain('disallow: "/"');
    // Not toContain("allow:") — "disallow:" contains it, and asserting
    // the wrong thing here would pass forever.
    expect(robots).not.toMatch(/(?<!dis)allow:/);
  });
});
