/**
 * Turning a user-agent string into something a person recognises.
 *
 * Deliberately small and deliberately vague. The job is to help you
 * answer "is one of these not me?", and for that "Chrome on Mac" is
 * enough. A confidently wrong device name is worse than none at all,
 * because the whole list is only useful if you trust it — so anything
 * unrecognised says so rather than guessing.
 *
 * No IP geolocation, and none planned. It needs a third-party lookup,
 * means storing addresses this app currently does not hold, and is often
 * wrong by a few hundred kilometres. Streaming services show a city
 * because they are fighting password sharing; that is not this problem.
 */

export type Device = { browser: string; platform: string; label: string };

const BROWSERS: [RegExp, string][] = [
  [/\bEdg\//i, "Edge"],
  [/\bOPR\/|\bOpera\b/i, "Opera"],
  [/\bFirefox\//i, "Firefox"],
  [/\bChrome\/|\bCriOS\//i, "Chrome"],
  [/\bSafari\//i, "Safari"],
];

const PLATFORMS: [RegExp, string][] = [
  [/\biPhone\b/i, "iPhone"],
  [/\biPad\b/i, "iPad"],
  [/\bAndroid\b/i, "Android"],
  [/\bMac OS X\b|\bMacintosh\b/i, "Mac"],
  [/\bWindows\b/i, "Windows"],
  [/\bCrOS\b/i, "ChromeOS"],
  [/\bLinux\b/i, "Linux"],
];

function match(list: [RegExp, string][], ua: string): string | null {
  for (const [re, name] of list) if (re.test(ua)) return name;
  return null;
}

export function describeDevice(userAgent: string | null | undefined): Device {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { browser: "Unknown", platform: "device", label: "Unknown device" };

  // Order matters: Chrome and Edge both claim Safari, Edge claims Chrome.
  const browser = match(BROWSERS, ua) ?? "Unknown browser";
  const platform = match(PLATFORMS, ua) ?? "unknown device";

  const label =
    browser === "Unknown browser" && platform === "unknown device"
      ? "Unknown device"
      : browser === "Unknown browser"
        ? `Something on ${platform}`
        : platform === "unknown device"
          ? browser
          : `${browser} on ${platform}`;

  return { browser, platform, label };
}

/** "active now", "3 hours ago", "6 days ago" — rounded, never precise. */
export function lastSeenLabel(at: Date, now = new Date()): string {
  const mins = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (mins < 5) return "active now";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return `${Math.floor(days / 30)} months ago`;
}
