/**
 * The time-zone dropdown.
 *
 * There is a trap here worth spelling out. Intl.supportedValuesOf returns
 * ICU's *canonical* zone names, and several everyday names are aliases
 * that don't appear in it — "Asia/Kolkata" is one, the canonical form
 * being "Asia/Calcutta". A <select> whose defaultValue matches no option
 * silently selects the first one instead, so a profile set to
 * Asia/Kolkata rendered as Africa/Abidjan and would have overwritten the
 * real setting on the next save. Nothing errors; the date maths just
 * quietly moves to a different continent.
 *
 * So the stored value is always guaranteed a slot in the list.
 */

const FALLBACK = ["UTC", "Asia/Kolkata"];

function canonicalList(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  return supported ? supported("timeZone") : FALLBACK;
}

/** Canonical zones, plus `current` if the list doesn't already carry it. */
export function timeZoneOptions(current: string): string[] {
  const zones = canonicalList();
  if (zones.includes(current)) return zones;
  return [...zones, current].sort();
}

/** "Asia/Kolkata" → "Asia / Kolkata" */
export function formatZone(zone: string): string {
  return zone.replace(/_/g, " ").replace("/", " / ");
}

/** "Asia/Kolkata · GMT+5:30", as the design labels it. */
export function describeZone(zone: string, at = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    // longOffset gives "GMT+05:30"; the design shows "GMT+5:30".
    return `${zone} · ${offset.replace(/GMT([+-])0?(\d)/, "GMT$1$2")}`;
  } catch {
    return zone;
  }
}
