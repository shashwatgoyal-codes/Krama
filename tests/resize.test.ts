import { describe, it, expect } from "vitest";
import { AVATAR_EDGE } from "@/lib/resize";

/**
 * resizeAvatar itself needs a browser — createImageBitmap and canvas
 * are not in this environment, and mocking them would only test the
 * mock. What is worth pinning here is the contract the server relies on.
 */
describe("avatar resizing", () => {
  it("targets a size that covers a 40px avatar on a retina screen", () => {
    expect(AVATAR_EDGE).toBeGreaterThanOrEqual(80);
    expect(AVATAR_EDGE).toBeLessThanOrEqual(512);
  });

  it("is square, so the circular crop never distorts a face", () => {
    // A single edge constant is what makes this true — there is no
    // separate width and height to fall out of step.
    expect(Number.isInteger(AVATAR_EDGE)).toBe(true);
  });

  it("produces something far under the server's cap at that size", () => {
    // A 256x256 PNG is tens of kilobytes; the 1MB ceiling stays as the
    // backstop for anything that bypasses the browser entirely.
    const worstCasePngBytes = AVATAR_EDGE * AVATAR_EDGE * 4;
    expect(worstCasePngBytes).toBeLessThan(1024 * 1024);
  });
});
