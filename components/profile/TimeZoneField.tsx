"use client";

import { useState } from "react";
import type { ZoneGroup } from "@/lib/timezones";
import { inputClass } from "./Row";

/**
 * The zone picker.
 *
 * Grouped by region with the offset on every row, because the offset is
 * what people recognise about their own zone — nobody knows whether they
 * are Asia/Kolkata or Asia/Calcutta, but everyone knows they are +5:30.
 *
 * The "use my computer's" button exists because the browser already
 * knows the answer and asking someone to find it in a list of 419 is
 * work we can simply not make them do.
 */
export default function TimeZoneField({
  groups,
  current,
}: {
  groups: ZoneGroup[];
  current: string;
}) {
  const [value, setValue] = useState(current);
  const [detected] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  });

  const known = groups.some((g) => g.zones.some((z) => z.value === detected));
  const offer = detected && detected !== value && known;

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        id="timezone"
        name="timezone"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`w-[240px] ${inputClass}`}
      >
        {groups.map((group) => (
          <optgroup key={group.region} label={group.region}>
            {group.zones.map((zone) => (
              <option key={`${group.region}-${zone.value}`} value={zone.value}>
                {zone.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {offer && (
        <button
          type="button"
          onClick={() => setValue(detected)}
          className="cursor-pointer text-[10.5px] font-semibold text-mut hover:text-acc hover:underline"
        >
          Use this computer&rsquo;s zone ({detected.split("/").pop()?.replace(/_/g, " ")})
        </button>
      )}
    </div>
  );
}
