import { describe, it, expect } from "vitest";
import { describeDevice, lastSeenLabel } from "@/lib/devices";

/**
 * Naming somebody's devices back to them.
 *
 * The list exists so you can spot one that is not yours, which only
 * works if you trust what it says. So the important cases here are the
 * ones where it must say "unknown" rather than guess — a confidently
 * wrong name is worse than no name, because it makes a stranger's
 * session look like your laptop.
 */

const UA = {
  chromeMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  safariPhone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  chromeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  edgeWin: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0",
  firefoxLinux: "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
};

describe("describeDevice", () => {
  it("names a Mac browser", () => {
    expect(describeDevice(UA.chromeMac).label).toBe("Chrome on Mac");
    expect(describeDevice(UA.safariMac).label).toBe("Safari on Mac");
  });

  it("does not call Chrome Safari, though Chrome says it is", () => {
    // Every Chromium browser carries "Safari/537.36". Ordering the checks
    // wrongly would label every device on earth as Safari.
    expect(describeDevice(UA.chromeMac).browser).toBe("Chrome");
    expect(describeDevice(UA.chromeWin).browser).toBe("Chrome");
  });

  it("does not call Edge Chrome, though Edge says it is", () => {
    expect(describeDevice(UA.edgeWin).browser).toBe("Edge");
  });

  it("prefers Android over Linux, which Android also claims", () => {
    expect(describeDevice(UA.chromeAndroid).platform).toBe("Android");
  });

  it("names phones apart from computers", () => {
    expect(describeDevice(UA.safariPhone).label).toBe("Safari on iPhone");
  });

  it("names Firefox on Linux", () => {
    expect(describeDevice(UA.firefoxLinux).label).toBe("Firefox on Linux");
  });

  it("says unknown rather than guessing", () => {
    for (const ua of ["", "   ", null, undefined, "curl/8.4.0", "some-bot/1.0"]) {
      expect(describeDevice(ua).label.toLowerCase()).toContain("unknown");
    }
  });

  it("never throws, whatever it is handed", () => {
    for (const junk of [" ", "a".repeat(5000), "()<>[]"]) {
      expect(() => describeDevice(junk)).not.toThrow();
    }
  });
});

describe("lastSeenLabel", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("calls anything within five minutes active now", () => {
    expect(lastSeenLabel(ago(0), now)).toBe("active now");
    expect(lastSeenLabel(ago(4 * 60_000), now)).toBe("active now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(lastSeenLabel(ago(30 * 60_000), now)).toBe("30 minutes ago");
    expect(lastSeenLabel(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(lastSeenLabel(ago(6 * 86_400_000), now)).toBe("6 days ago");
  });

  it("gets singulars right", () => {
    expect(lastSeenLabel(ago(3_600_000), now)).toBe("1 hour ago");
    expect(lastSeenLabel(ago(86_400_000), now)).toBe("1 day ago");
  });

  it("never shows a precise timestamp", () => {
    // Rounded on purpose: this is for recognising your own devices, not
    // for logging exactly when somebody was at their desk.
    for (const ms of [0, 90_000, 7_200_000, 500_000_000]) {
      expect(lastSeenLabel(ago(ms), now)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});
