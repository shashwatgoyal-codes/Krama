"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { toggleTask } from "@/app/app/actions";
import { scheduleAt, clearSchedule, saveDetails } from "@/app/app/tasks/actions";
import { BLOCK_MINUTES } from "@/lib/time";
import TagField from "@/components/tags/TagField";
import type { TagChip } from "@/lib/tags";

/**
 * The detail panel from the design: what the task is, when it's due,
 * when it's scheduled, whether it repeats, and where it came from.
 *
 * Scheduling here is explicit — you choose the date, the time and the
 * length. The drag gesture on Today is the shortcut; this is the place
 * you go when the shortcut guessed wrong.
 */

export type TaskPanelView = {
  id: string;
  title: string;
  notes: string;
  done: boolean;
  points: number;
  areaId: string | null;
  /** "2026-08-15" or "" */
  dueOn: string;
  recurrence: string;
  recurrenceValue: number | null;
  block: {
    id: string;
    /** "2026-08-15" */
    dayKey: string;
    hour: number;
    minute: number;
    durationMinutes: number;
    /** "14:00 – 16:00" */
    label: string;
  } | null;
  fromNote: string | null;
  tags: TagChip[];
  /** Today in the user's zone, for sensible defaults. */
  todayKey: string;
};

const REPEATS = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Half-hour steps across a plausible day. */
const TIMES = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  return {
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    label: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
      minutes % 60,
    ).padStart(2, "0")}`,
  };
});

const FIELD =
  "w-full rounded-md border border-ln2 bg-surf px-2 py-1.5 text-[12.5px] text-ink " +
  "focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft";

export default function TaskDetail({
  task,
  areas,
  allTags,
}: {
  task: TaskPanelView;
  areas: { id: string; name: string }[];
  allTags: TagChip[];
}) {
  const [scheduling, setScheduling] = useState(false);
  const [recurrence, setRecurrence] = useState(task.recurrence);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(
    action: (data: FormData) => Promise<{ ok: boolean; error?: string }>,
    data: FormData,
    onOk?: () => void,
  ) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action(data);
      if (result?.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
        onOk?.();
      } else if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex items-baseline justify-between gap-2.5">
        <span className="font-display text-[13px] font-semibold tracking-[-0.015em]">
          {task.title}
        </span>
        {task.done && <span className="label-xs text-ok">done</span>}
      </div>

      {/* details */}
      <form
        action={(data) => run(saveDetails, data)}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="id" value={task.id} />

        <Field label="Notes">
          <textarea
            name="notes"
            rows={3}
            defaultValue={task.notes}
            placeholder="Anything worth remembering when you start."
            className={`${FIELD} resize-y placeholder:text-fai`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <select
              name="areaId"
              defaultValue={task.areaId ?? ""}
              className={FIELD}
            >
              <option value="">Unfiled</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Worth">
            <input
              type="number"
              name="points"
              min={1}
              max={30}
              step={1}
              defaultValue={task.points}
              aria-describedby="points-hint"
              className={`${FIELD} tabular`}
            />
            <p id="points-hint" className="mt-1 text-[11px] text-fai">
              {task.done
                ? "Already paid. Changing this only affects a re-completion."
                : "1–30. Big effort high, small errand low."}
            </p>
          </Field>

          <Field label="Due">
            <input
              type="date"
              name="dueOn"
              defaultValue={task.dueOn}
              className={FIELD}
            />
          </Field>

          <Field label="Scheduled">
            <span className="tabular text-[12.5px]">
              {task.block ? (
                task.block.label
              ) : (
                <span className="text-fai">Not yet</span>
              )}
            </span>
          </Field>
        </div>

        <Field label="Repeats">
          <div className="flex flex-wrap gap-1">
            {REPEATS.map((option) => (
              <label
                key={option.value}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors " +
                  (recurrence === option.value
                    ? "border-acc bg-acc text-on-acc"
                    : "border-ln2 text-mut hover:border-acc hover:text-acc")
                }
              >
                <input
                  type="radio"
                  name="recurrence"
                  value={option.value}
                  checked={recurrence === option.value}
                  onChange={() => setRecurrence(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>

          {recurrence === "weekly" && (
            <select
              name="recurrenceValue"
              defaultValue={task.recurrenceValue ?? 1}
              className={`mt-2 ${FIELD}`}
            >
              {WEEKDAY_NAMES.map((d, i) => (
                <option key={d} value={i}>
                  Every {d}
                </option>
              ))}
            </select>
          )}

          {recurrence === "monthly" && (
            <select
              name="recurrenceValue"
              defaultValue={task.recurrenceValue ?? 1}
              className={`mt-2 ${FIELD}`}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Tags">
          <TagField
            selected={task.tags}
            available={allTags}
            disabled={pending}
          />
        </Field>

        {task.fromNote && (
          <Field label="Came from">
            <span className="text-[12px] text-mut">
              Note ·{" "}
              {task.fromNote.length > 48
                ? `“${task.fromNote.slice(0, 48)}…”`
                : `“${task.fromNote}”`}
            </span>
          </Field>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Save details
          </Button>
          <span aria-live="polite" className="text-[11.5px] font-semibold text-ok">
            {saved && "Saved"}
          </span>
        </div>
      </form>

      {/* scheduling */}
      {scheduling ? (
        <form
          action={(data) => run(scheduleAt, data, () => setScheduling(false))}
          className="mt-4 rounded-lg border border-ln bg-surf2 p-3"
        >
          <input type="hidden" name="id" value={task.id} />
          {task.block && (
            <input type="hidden" name="blockId" value={task.block.id} />
          )}

          <p className="label-xs mb-2">
            {task.block ? "Move it to" : "Put it on the calendar"}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input
                type="date"
                name="dayKey"
                required
                defaultValue={task.block?.dayKey ?? task.todayKey}
                className={FIELD}
              />
            </Field>

            <Field label="Start">
              <select
                name="time"
                defaultValue={`${task.block?.hour ?? 9}:${task.block?.minute ?? 0}`}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":");
                  const form = e.target.form;
                  if (!form) return;
                  (form.elements.namedItem("hour") as HTMLInputElement).value = h;
                  (form.elements.namedItem("minute") as HTMLInputElement).value = m;
                }}
                className={FIELD}
              >
                {TIMES.map((t) => (
                  <option key={t.label} value={`${t.hour}:${t.minute}`}>
                    {t.label}
                  </option>
                ))}
              </select>
              {/* The select carries both parts; these are what get posted. */}
              <input
                type="hidden"
                name="hour"
                defaultValue={task.block?.hour ?? 9}
              />
              <input
                type="hidden"
                name="minute"
                defaultValue={task.block?.minute ?? 0}
              />
            </Field>
          </div>

          <div className="mt-2">
            <Field label="For how long">
              <select
                name="durationMinutes"
                defaultValue={task.block?.durationMinutes ?? 60}
                className={FIELD}
              >
                {BLOCK_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m < 60
                      ? `${m} minutes`
                      : m % 60 === 0
                        ? `${m / 60} hour${m === 60 ? "" : "s"}`
                        : `${Math.floor(m / 60)}h ${m % 60}m`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Saving…" : task.block ? "Move it" : "Schedule it"}
            </Button>
            <Button type="button" size="sm" onClick={() => setScheduling(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-ln pt-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => {
              const data = new FormData();
              data.set("id", task.id);
              run(toggleTask, data);
            }}
          >
            {task.done ? "Not done after all" : "Complete"}
          </Button>

          <Button type="button" size="sm" onClick={() => setScheduling(true)}>
            {task.block ? "Reschedule" : "Schedule"}
          </Button>

          {task.block && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                const data = new FormData();
                data.set("blockId", task.block!.id);
                run(clearSchedule, data);
              }}
            >
              Unschedule
            </Button>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fai">
        {label}
      </div>
      {children}
    </div>
  );
}
