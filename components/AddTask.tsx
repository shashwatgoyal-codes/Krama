"use client";

import { useRef, useState, useTransition } from "react";
import { createTask } from "@/app/app/actions";
import UntilField from "@/components/tasks/UntilField";
import { BLOCK_MINUTES } from "@/lib/time";
import WeekdayPicker from "@/components/tasks/WeekdayPicker";

const REPEATS = [
  { value: "none", label: "Once" },
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

export default function AddTask({
  autoFocus = false,
  today,
}: {
  autoFocus?: boolean;
  /** Today in the user's zone, so "end of this month" resolves right. */
  today?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<string>("none");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setError(null);
    // Monthly still needs a day of the month; weekly carries its own
    // list from the picker.
    if (repeat === "monthly") {
      formData.set("recurrenceValue", String(new Date().getDate()));
    }

    startTransition(async () => {
      const result = await createTask(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Cleared by hand rather than with a key reset, so focus stays put
      // and you can add three things without touching the mouse.
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
      setRepeat("none");
    });
  }

  return (
    <form action={submit}>
      <input type="hidden" name="recurrence" value={repeat} />

      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="title"
          required
          maxLength={200}
          autoFocus={autoFocus}
          disabled={pending}
          placeholder="What needs doing?"
          aria-label="New task"
          className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-2 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-[9px] border border-ink bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="label-xs mr-0.5">Repeats</span>
        {REPEATS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRepeat(r.value)}
            aria-pressed={repeat === r.value}
            className={
              "rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors " +
              (repeat === r.value
                ? "border-acc bg-acc-soft text-acc"
                : "border-ln2 text-mut hover:border-acc hover:text-acc")
            }
          >
            {r.label}
          </button>
        ))}

        {/* Deliberately left alone when the form clears: adding several
            things of similar size shouldn't mean re-picking the number
            every time. */}
        <span className="label-xs ml-2 mr-0.5">Worth</span>
        <input
          type="number"
          name="points"
          min={1}
          max={30}
          step={1}
          defaultValue={20}
          disabled={pending}
          aria-label="Points this task is worth"
          className="tabular w-[58px] rounded-md border border-ln2 bg-surf px-1.5 py-1 text-[11.5px] text-ink focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
        />
      </div>

      {repeat === "weekly" && (
        <div className="mt-2">
          <span className="label-xs">On</span>
          <div className="mt-1">
            <WeekdayPicker selected={[new Date().getDay()]} disabled={pending} />
          </div>
        </div>
      )}

      {repeat !== "none" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="label-xs">At</span>
          {/* Pre-filled rather than blank. A routine with no time never
              reaches the calendar, and "why isn't it showing" is a worse
              first experience than a time you have to correct. */}
          <input
            type="time"
            name="routineTime"
            defaultValue="09:00"
            disabled={pending}
            aria-label="What time the routine happens"
            className="rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] text-ink focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
          />
          <span className="text-[11px] text-mut">for</span>
          <select
            name="routineMinutes"
            defaultValue={60}
            disabled={pending}
            aria-label="How long the routine lasts"
            className="rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] text-ink focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
          >
            {BLOCK_MINUTES.map((m) => (
              <option key={m} value={m}>
                {m < 60
                  ? `${m}m`
                  : m % 60 === 0
                    ? `${m / 60}h`
                    : `${Math.floor(m / 60)}h ${m % 60}m`}
              </option>
            ))}
          </select>
        </div>
      )}

      {repeat !== "none" && today && (
        <div className="mt-2">
          <span className="label-xs mr-1">Until</span>
          <div className="mt-1">
            <UntilField value={null} today={today} disabled={pending} />
          </div>
        </div>
      )}

      {repeat !== "none" && (
        <p className="mt-1.5 text-[11.5px] text-fai">
          {repeat === "weekly"
            ? "Repeats every week on the days you picked."
            : repeat === "monthly"
              ? "Repeats monthly on today's date. On short months it lands on the last day."
              : "It will appear on its own — you won't need to add it again."}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-[11.5px] text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
