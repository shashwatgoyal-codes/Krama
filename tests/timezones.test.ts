import { describe, it, expect } from "vitest";
import {
  timeZoneOptions,
  formatZone,
  zoneGroups,
  offsetLabel,
} from "@/lib/timezones";

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

describe("zoneGroups", () => {
  const AT = new Date("2026-08-16T00:00:00Z");

  it("opens with the zone already in use", () => {
    // The field should open on the answer, not on Africa.
    const groups = zoneGroups("Asia/Kolkata", AT);
    expect(groups[0].region).toBe("Current");
    expect(groups[0].zones[0].value).toBe("Asia/Kolkata");
  });

  it("labels every row with its offset, which is what people recognise", () => {
    const groups = zoneGroups("Asia/Kolkata", AT);
    expect(groups[0].zones[0].label).toBe("Kolkata · GMT+5:30");
  });

  it("groups by region instead of one flat list", () => {
    const regions = zoneGroups("UTC", AT).map((g) => g.region);
    for (const r of ["Asia", "Europe", "America", "Africa"]) {
      expect(regions, r).toContain(r);
    }
    // Far fewer groups than the 419 rows they contain.
    expect(regions.length).toBeLessThan(20);
  });

  it("still contains every zone, just arranged", () => {
    const groups = zoneGroups("Asia/Kolkata", AT);
    // Minus the duplicated "Current" entry at the top.
    const total = groups.slice(1).reduce((n, g) => n + g.zones.length, 0);
    expect(total).toBe(timeZoneOptions("Asia/Kolkata").length);
  });

  it("spells the city normally rather than as a path", () => {
    const groups = zoneGroups("UTC", AT);
    const america = groups.find((g) => g.region === "America")!;
    const ny = america.zones.find((z) => z.value === "America/New_York")!;
    expect(ny.label).toContain("New York");
    expect(ny.label).not.toContain("_");
  });

  it("keeps an alias reachable, so a stored value is never orphaned", () => {
    const groups = zoneGroups("Asia/Kolkata", AT);
    const all = groups.flatMap((g) => g.zones.map((z) => z.value));
    expect(all).toContain("Asia/Kolkata");
  });
});

describe("offsetLabel", () => {
  const AT = new Date("2026-08-16T00:00:00Z");

  it("trims the leading zero the way people write it", () => {
    expect(offsetLabel("Asia/Kolkata", AT)).toBe("GMT+5:30");
  });

  it("writes plain GMT rather than GMT+0:00", () => {
    expect(offsetLabel("UTC", AT)).toBe("GMT");
  });

  it("follows daylight saving", () => {
    expect(offsetLabel("America/New_York", new Date("2026-01-15T12:00:00Z")))
      .toBe("GMT-5");
    expect(offsetLabel("America/New_York", new Date("2026-07-15T12:00:00Z")))
      .toBe("GMT-4");
  });
});
