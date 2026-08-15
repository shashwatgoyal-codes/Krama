import { describe, it, expect } from "vitest";
import { timeZoneOptions, formatZone } from "@/lib/timezones";

/**
 * Regression cover for a silent data bug: the profile's saved zone was
 * Asia/Kolkata, ICU's canonical list only carries Asia/Calcutta, and a
 * <select> with no matching option quietly selects its first entry. The
 * page showed Africa/Abidjan and would have saved it over the real value.
 */

describe("timeZoneOptions", () => {
  it("always contains the value it was given", () => {
    for (const zone of [
      "Asia/Kolkata", // alias — not in the canonical list
      "Asia/Calcutta", // canonical
      "UTC",
      "America/New_York",
    ]) {
      expect(timeZoneOptions(zone)).toContain(zone);
    }
  });

  it("never lets the schema default fall off the list", () => {
    // This is the exact pairing that broke: the Prisma default is
    // Asia/Kolkata, which ICU does not consider canonical. Presence in
    // the list is the whole fix — a <select> only honours a defaultValue
    // that matches one of its options, and falls back to the first
    // otherwise.
    expect(Intl.supportedValuesOf("timeZone")).not.toContain("Asia/Kolkata");
    expect(timeZoneOptions("Asia/Kolkata")).toContain("Asia/Kolkata");
  });

  it("adds nothing when the zone is already canonical", () => {
    const withCanonical = timeZoneOptions("Asia/Calcutta");
    const withAlias = timeZoneOptions("Asia/Kolkata");
    expect(withAlias.length).toBe(withCanonical.length + 1);
  });

  it("stays sorted after inserting an alias", () => {
    const options = timeZoneOptions("Asia/Kolkata");
    expect(options).toEqual([...options].sort());
  });

  it("offers a realistic number of zones", () => {
    expect(timeZoneOptions("UTC").length).toBeGreaterThan(100);
  });

  it("has no duplicates", () => {
    const options = timeZoneOptions("Asia/Kolkata");
    expect(new Set(options).size).toBe(options.length);
  });
});

describe("formatZone", () => {
  it("makes the region readable without changing the value", () => {
    expect(formatZone("America/New_York")).toBe("America / New York");
    expect(formatZone("Asia/Kolkata")).toBe("Asia / Kolkata");
  });

  it("leaves a single-part zone alone", () => {
    expect(formatZone("UTC")).toBe("UTC");
  });
});
