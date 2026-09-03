import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The toast, guarded at the source.
 *
 * There is no DOM harness in this project, so these read the component
 * rather than render it. Blunt, and still worth having: the placement
 * was asked for specifically, and the accessibility wiring is the kind
 * of thing that gets refactored away by someone tidying class names.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");
const toast = () => read("components/ui/Toast.tsx");

describe("where it appears", () => {
  it("is fixed to the top of the viewport, not the bottom", () => {
    const src = toast();
    expect(src).toMatch(/fixed[^"]*top-/);
    expect(src).not.toMatch(/fixed[^"]*bottom-/);
  });

  it("is centred horizontally", () => {
    expect(toast()).toContain("items-center");
  });

  it("sits above everything else", () => {
    expect(toast()).toMatch(/z-\[?\d{2,}/);
  });

  it("does not block clicks on what is underneath", () => {
    // The container spans the width of the screen. Without this it would
    // swallow clicks along the top of every page in the app.
    const src = toast();
    expect(src).toContain("pointer-events-none");
    expect(src).toContain("pointer-events-auto");
  });
});

describe("what it announces", () => {
  it("uses alert for errors and status for confirmations", () => {
    // An error interrupts; a confirmation waits its turn rather than
    // talking over whatever a screen reader is already saying.
    const src = toast();
    expect(src).toContain('role={error ? "alert" : "status"}');
    expect(src).toContain('aria-live="polite"');
  });

  it("can be dismissed by hand", () => {
    expect(toast()).toContain('aria-label="Dismiss"');
  });

  it("gives errors longer on screen than confirmations", () => {
    // Four seconds is enough to register "Saved" and not enough to read
    // a sentence about what went wrong and decide what to do.
    const src = toast();
    const match = src.match(/success:\s*(\d+),\s*error:\s*(\d+)/);
    expect(match).not.toBeNull();
    const [, success, error] = match!;
    expect(Number(error)).toBeGreaterThan(Number(success));
  });

  it("respects a reduced-motion preference", () => {
    expect(toast()).toContain("motion-reduce:");
  });
});

describe("how it is reached", () => {
  it("is mounted once, at the root, so every page has it", () => {
    const layout = read("app/layout.tsx");
    expect(layout).toContain("ToastProvider");
  });

  it("throws rather than silently doing nothing outside the provider", () => {
    // A toast that quietly fails is discovered only when somebody needed
    // the confirmation and did not get one.
    expect(toast()).toContain("must be used inside");
  });

  it("is used where the thing you acted on disappears", () => {
    // These are the screens with nowhere to put an inline message: the
    // row, card or page is gone by the time the action returns.
    for (const f of [
      "app/app/inbox/TriageRow.tsx",
      "app/app/devices/DeviceRow.tsx",
      "app/app/access/Decide.tsx",
      "components/admin/ReasonedAction.tsx",
      "components/admin/DangerDelete.tsx",
    ]) {
      expect(read(f)).toContain("useToast");
    }
  });
});
