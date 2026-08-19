import { occursOn } from "./recurrence";
import type { Recurrence } from "@prisma/client";

/**
 * Drawing routines onto the calendar without writing rows for them.
 *
 * Scheduling a recurring task used to produce exactly one block — this
 * Monday's — and next Monday showed an empty morning even though the
 * routine was still running. The calendar was blind to the standing
 * commitments, which is most of what a calendar is for.
 *
 * Pre-generating rows would have fixed the symptom and bought a worse
 * problem: editing the routine would mean rewriting every future row,
 * deleting would mean cleanup, and a year of monthly blocks is twelve
 * rows that exist only to be redrawn. So these are projected on read.
 * Nothing is stored until the day arrives or you touch one.
 *
 * Pure functions only — no repository imports. This is used by the
 * calendar's client components.
 */

export type RoutineTemplate = {
  id: string;
  title: string;
  points: number;
  areaId: string | null;
  recurrence: Recurrence;
  recurrenceValue: number | null;
  recurrenceDays: number[];
  /** "2026-12-31" or null for open-ended. */
  recurrenceUntil: string | null;
  /** Minutes from midnight, or null if the routine has no set time. */
  routineStartMinute: number | null;
  routineMinutes: number | null;
};

/** A block the calendar draws but the database does not hold. */
export type ProjectedBlock = {
  /** Stable within a render, but never a real row id. */
  key: string;
  templateId: string;
  title: string;
  dayKey: string;
  startMinute: number;
  minutes: number;
  points: number;
  areaId: string | null;
  /** Always true — the flag exists so the UI can say so. */
  projected: true;
  /**
   * The routine has no time of its own, so it belongs in the all-day
   * band rather than at an hour on the grid.
   *
   * Inventing a time would put it somewhere it does not belong and read
   * as fact; leaving it off the calendar entirely was worse, because a
   * standing commitment you cannot see is one you forget.
   */
  allDay: boolean;
};

/** How long a routine block runs when no length was chosen. */
export const DEFAULT_ROUTINE_MINUTES = 60;

/**
 * Where a routine falls across a run of days.
 *
 * `occupied` carries the day keys that already have a real block for
 * this template, so a scheduled occurrence is never drawn twice — once
 * as itself and once as a ghost of itself.
 */
export function projectRoutines(
  templates: RoutineTemplate[],
  days: string[],
  occupied: Set<string> = new Set(),
): ProjectedBlock[] {
  const out: ProjectedBlock[] = [];

  for (const template of templates) {
    if (template.recurrence === "none") continue;

    // No time means all-day, not invisible.
    const allDay = template.routineStartMinute === null;

    for (const dayKey of days) {
      if (occupied.has(`${template.id}:${dayKey}`)) continue;

      const fires = occursOn(
        dayKey,
        template.recurrence,
        template.recurrenceValue,
        template.recurrenceUntil,
        template.recurrenceDays,
      );
      if (!fires) continue;

      out.push({
        key: `projected:${template.id}:${dayKey}`,
        templateId: template.id,
        title: template.title,
        dayKey,
        startMinute: template.routineStartMinute ?? 0,
        minutes: template.routineMinutes ?? DEFAULT_ROUTINE_MINUTES,
        points: template.points,
        areaId: template.areaId,
        projected: true,
        allDay,
      });
    }
  }

  return out.sort(
    (a, b) =>
      a.dayKey.localeCompare(b.dayKey) || a.startMinute - b.startMinute,
  );
}

/** "08:00" from minutes past midnight. */
export function minuteLabel(minute: number): string {
  const safe = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "08:00 – 09:30", the way a block reads on the grid. */
export function spanLabel(startMinute: number, minutes: number): string {
  return `${minuteLabel(startMinute)} – ${minuteLabel(startMinute + minutes)}`;
}

/** Minutes past midnight from "08:00". Null when it isn't a time. */
export function parseMinute(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
