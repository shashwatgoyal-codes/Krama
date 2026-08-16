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


/**
 * The dropdown, grouped and labelled.
 *
 * A flat list of 419 raw IANA names is a data dump, not a picker: you
 * cannot scan it, "Asia/Kolkata" and "Asia/Katmandu" look alike at a
 * glance, and a wrong value can sit in it unnoticed — which is exactly
 * what happened here.
 *
 * So: grouped by region, the city spelled normally, and the current
 * offset on every row, because the offset is the thing people actually
 * recognise about their own zone.
 *
 * Offsets are computed once per process per day. They only change at
 * DST boundaries, and recomputing 419 of them on every render is a
 * measurable waste.
 */

export type ZoneOption = { value: string; label: string };
export type ZoneGroup = { region: string; zones: ZoneOption[] };

let cache: { day: string; groups: ZoneGroup[] } | null = null;

/** "GMT+5:30", or "GMT" for UTC itself. */
export function offsetLabel(zone: string, at = new Date()): string {
  try {
    const name = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      timeZoneName: "longOffset",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value;
    if (!name) return "";
    // longOffset gives "GMT+05:30". People write "+5:30", and a whole
    // hour as "-5" rather than "-5:00"; UTC is just "GMT".
    if (name === "GMT+00:00") return "GMT";
    return name
      .replace(/GMT([+-])0?(\d)/, "GMT$1$2")
      .replace(/:00$/, "");
  } catch {
    return "";
  }
}

/** "Kolkata", "New York", "Argentina / Rio Gallegos". */
function cityOf(zone: string): string {
  const [, ...rest] = zone.split("/");
  if (rest.length === 0) return zone;
  return rest.join(" / ").replace(/_/g, " ");
}

function regionOf(zone: string): string {
  const region = zone.split("/")[0];
  return region === "Etc" ? "Other" : region.replace(/_/g, " ");
}

export function zoneGroups(current: string, at = new Date()): ZoneGroup[] {
  const day = at.toISOString().slice(0, 10);
  if (cache && cache.day === day) return withCurrent(cache.groups, current, at);

  const byRegion = new Map<string, ZoneOption[]>();
  for (const zone of timeZoneOptions(current)) {
    const region = regionOf(zone);
    const offset = offsetLabel(zone, at);
    const list = byRegion.get(region) ?? [];
    list.push({
      value: zone,
      label: offset ? `${cityOf(zone)} · ${offset}` : cityOf(zone),
    });
    byRegion.set(region, list);
  }

  const groups = [...byRegion.entries()]
    .map(([region, zones]) => ({
      region,
      zones: zones.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.region.localeCompare(b.region));

  cache = { day, groups };
  return withCurrent(groups, current, at);
}

/**
 * The zone already in use goes to the top, so the field opens on the
 * answer rather than on Africa.
 */
function withCurrent(
  groups: ZoneGroup[],
  current: string,
  at: Date,
): ZoneGroup[] {
  if (!current) return groups;
  const offset = offsetLabel(current, at);
  return [
    {
      region: "Current",
      zones: [
        {
          value: current,
          label: offset ? `${cityOf(current)} · ${offset}` : cityOf(current),
        },
      ],
    },
    ...groups,
  ];
}
