import AddTask from "./AddTask";
import Plan, { type PlanBlockView } from "./plan/Plan";
import WaitingItem from "./plan/WaitingItem";
import type { TaskItem } from "./TaskRow";
import type { TodayStats } from "@/lib/repositories/profile";
import { NOTE_TINT, type NoteColour } from "@/lib/notes";
import Link from "next/link";

export type NotePreview = { id: string; body: string; colour: NoteColour };

/**
 * The plan on the left with real times; everything uncommitted on the
 * right. Drag right to left to schedule.
 */
export default function Today({
  name,
  day,
  blocks,
  committed,
  waiting,
  notes,
  stats,
  showScoring,
}: {
  name: string;
  day: string;
  blocks: PlanBlockView[];
  committed: string;
  waiting: (TaskItem & { chip?: string })[];
  notes: NotePreview[];
  stats: TodayStats;
  showScoring: boolean;
}) {
  const firstName = name.split(" ")[0];
  const nothingAtAll = blocks.length === 0 && waiting.length === 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.45fr_1fr]">
      {/* ---------------- the plan ---------------- */}
      <section className="min-w-0 border-r border-ln bg-surf px-[18px] py-4">
        <div className="mb-3 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-[15px] font-semibold tracking-[-0.015em]">
            The plan
          </span>
          <span className="label-xs tabular">
            {blocks.length > 0 ? `${committed} committed` : day}
          </span>
        </div>

        {nothingAtAll ? (
          /* First run. Someone arriving here has none of the context the
             app assumes, so say what it's for before asking for input. */
          <div className="rounded-xl border border-dashed border-ln2 px-6 py-8 text-center">
            <div className="font-display text-[15px] font-semibold">
              Good to see you, {firstName}.
            </div>
            <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-mut">
              Krama keeps score of what you actually do — not what other people
              decide. Add the first thing you want to get done today, however
              small. Three of them clears the day.
            </p>
            <div className="mx-auto mt-5 max-w-[340px]">
              <AddTask autoFocus />
            </div>
          </div>
        ) : (
          <>
            {blocks.length === 0 && (
              <p className="rounded-[9px] border border-dashed border-ln2 px-4 py-5 text-center text-[12.5px] leading-relaxed text-mut">
                Nothing has a time yet. Drag something across from the right,
                or press <span className="font-semibold text-ink">Plan</span> on
                it — deciding when is most of the work.
              </p>
            )}

            <Plan blocks={blocks} />

            {showScoring && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ln pt-3.5">
                <span className="label-xs">Pace</span>
                <div className="h-[3px] w-[110px] overflow-hidden rounded-sm bg-ln">
                  <div
                    className="h-full rounded-sm bg-acc transition-[width] duration-500"
                    style={{ width: `${stats.pace}%` }}
                  />
                </div>
                <span className="tabular text-[13px] font-semibold">
                  {stats.pace}
                </span>

                <span className="label-xs ml-auto tabular">
                  {stats.floorCleared
                    ? "floor cleared"
                    : `${stats.actionsToday} of ${stats.dailyFloor} today`}
                </span>
                {stats.streakDays > 0 && (
                  // Understated on purpose. A streak that's still open
                  // today is a fact worth showing, not a countdown to
                  // shame you with — there is no "you broke your streak"
                  // state anywhere in this app, and this isn't one.
                  <span
                    className={
                      "label-xs tabular " +
                      (stats.streakAtRisk ? "text-warn" : "")
                    }
                    title={
                      stats.streakAtRisk
                        ? `${stats.dailyFloor} ${
                            stats.dailyFloor === 1 ? "thing keeps" : "things keep"
                          } it going — today still counts.`
                        : "Days you've cleared the floor. Rest days don't break it."
                    }
                  >
                    {stats.streakDays}-day streak
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ---------------- unscheduled ---------------- */}
      <aside className="min-w-0 bg-surf2 p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-[13px] font-semibold tracking-[-0.02em]">
            Unscheduled
          </span>
          <span className="label-xs tabular">{waiting.length}</span>
        </div>

        {waiting.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ln2 px-3 py-4 text-center text-[11.5px] leading-relaxed text-mut">
            Nothing waiting. Everything you&rsquo;ve got has a time.
          </p>
        ) : (
          waiting.map((t) => (
            <WaitingItem key={t.id} task={t} showPoints={showScoring} />
          ))
        )}

        <div className="mt-3">
          <AddTask />
        </div>

        {notes.length > 0 && (
          <>
            <div className="mb-2.5 mt-5 flex items-baseline justify-between gap-2.5">
              <span className="font-display text-[13px] font-semibold tracking-[-0.02em]">
                Notes
              </span>
              <Link href="/app/notes" className="label-xs hover:text-acc">
                Board
              </Link>
            </div>
            {notes.map((note) => (
              <Link
                key={note.id}
                href="/app/notes"
                className={`mb-1.5 block rounded-[3px] border px-3 py-2.5 text-[12.5px] leading-[1.42] ${NOTE_TINT[note.colour]}`}
              >
                {note.body.length > 120
                  ? `${note.body.slice(0, 120)}…`
                  : note.body}
              </Link>
            ))}
          </>
        )}
      </aside>
    </div>
  );
}
