import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { pageTitle } from "@/lib/env";
import { getSettings } from "@/lib/repositories/profile";
import { POINTS, MAX_POINTS, MIN_POINTS } from "@/lib/points";
import { BACKDATE_MULTIPLIER } from "@/lib/day";
import { RETENTION } from "@/lib/retention";

export const metadata: Metadata = {
  title: pageTitle("How Krama works"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The explainer.
 *
 * Written against the real constants and the reader's own settings
 * rather than as prose someone remembers to update. Every number on this
 * page is the number the app actually uses, so the guide cannot quietly
 * become wrong — which is the usual fate of a help page.
 *
 * It explains the rules that cannot be guessed by clicking around: why
 * the point spread is narrow, why there is no streak to break, what a
 * routine does on a day you miss it. The parts that are obvious from
 * using the app are left out.
 */
export default async function Guide() {
  const user = await requireUser();
  const s = await getSettings(user.id);
  const hidden = s.scoringVisibility === "hidden";

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-8">
      <p className="label-xs text-mut">Guide</p>
      <h1 className="mt-1 font-display text-[24px] font-semibold tracking-[-0.025em]">
        How Krama works
      </h1>
      <p className="mt-2 max-w-[58ch] text-[13px] leading-relaxed text-mut">
        Krama is Sanskrit for step, sequence, order. The app is built around one
        idea: a thought should be able to become a commitment, a commitment
        should be able to take up time, and finishing it should leave a record.
        Everything below follows from that.
      </p>

      <Chain />

      <Section title="Capture first, decide later">
        <P>
          Press <Key>⌘K</Key> — or <Key>Ctrl K</Key> — anywhere and type. You do
          not have to say what it is. It lands in{" "}
          <Ref href="/app/inbox">Inbox</Ref>, and you sort it when you have the
          attention to. Paste a link and it goes to{" "}
          <Ref href="/app/explore">Explore</Ref> instead, because a URL is
          almost never a task yet.
        </P>
        <P>
          This exists so that having an idea costs nothing. Anything that makes
          you file a thought before you can put it down is a reason not to put
          it down.
        </P>
      </Section>

      <Section title="A note can become a task. A task can take up time.">
        <P>
          Notes and saved links both have a &ldquo;make this a task&rdquo;
          action, and the task remembers where it came from. Drag a task onto
          the <Ref href="/app/calendar">Calendar</Ref> and it becomes a block;
          finishing the block finishes the task. One action, not three.
        </P>
        <P>
          Nothing forces you along this path. It is there so the friction of
          moving between thinking and doing is a drag rather than retyping.
        </P>
      </Section>

      <Section title="Routines appear on their own">
        <P>
          A task set to repeat becomes a rule rather than a row. On each day it
          runs, Krama writes that day&rsquo;s copy the first time you open the
          app — never in advance, so changing the routine never has to rewrite a
          queue of future days.
        </P>
        <P>
          Finishing one day finishes that day only, and earns that day&rsquo;s
          points. A day you skip is marked as missed rather than carried
          forward: opening the app on Monday to four days of last week&rsquo;s
          standups is the fastest way to stop opening the app.
        </P>
      </Section>

      {!hidden && (
        <Section title="Points are for effort, never outcomes">
          <P>
            Everything that scores is something you control. Nothing here pays
            out for a result, because results depend on other people and a
            scoreboard you cannot move is a scoreboard you learn to ignore.
          </P>

          <div className="mt-3 overflow-hidden rounded-lg border border-ln">
            <table className="w-full text-[12px]">
              <tbody>
                {[
                  ["A deep block", POINTS.deepBlock],
                  ["An ordinary task", POINTS.standardTask],
                  ["A study session", POINTS.studySession],
                  ["A routine", POINTS.recurringRoutine],
                  ["A quick task", POINTS.quickTask],
                  ["Upkeep", POINTS.upkeep],
                ].map(([label, points]) => (
                  <tr
                    key={String(label)}
                    className="border-b border-ln last:border-b-0"
                  >
                    <td className="px-3 py-1.5 text-ink2">{label}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-mut">
                      {points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <P>
            The spread is deliberately narrow — {MAX_POINTS} at the top,{" "}
            {MIN_POINTS} at the bottom, {Math.round(MAX_POINTS / MIN_POINTS)}×
            rather than fifty. When one action pays far more than the rest,
            people start optimising for the score instead of doing the work.
          </P>
        </Section>
      )}

      {!hidden && (
        <Section title="Pace, a floor, and a ceiling that bends">
          <Dl
            rows={[
              [
                "Pace",
                "A rolling score over the last seven days that fades rather than resets. There is no streak to break, and no screen anywhere in Krama that tells you that you broke one.",
              ],
              [
                "Your daily floor",
                `${s.dailyFloor} ${s.dailyFloor === 1 ? "thing" : "things"} a day keeps the day counted. It is set low on purpose: a floor you cannot clear on a bad day is a floor that punishes bad days.`,
              ],
              [
                "The soft cap",
                `Past ${s.dailyCap} points in a day, awards pay half, then a quarter. Nothing is ever blocked — a big day still counts, it just cannot dominate the record.`,
              ],
              [
                "Logging late",
                `Something you tick off for an earlier day pays ${Math.round(BACKDATE_MULTIPLIER * 100)}%, up to ${s.backdateLimitDays} ${s.backdateLimitDays === 1 ? "day" : "days"} back. Enough that catching up is worth doing, little enough that it is not a strategy.`,
              ],
            ]}
          />
          <P>
            If none of this helps you, turn it off:{" "}
            <Ref href="/app/profile?s=scoring">Settings → Scoring</Ref> has a
            setting that hides points and levels everywhere except that page,
            leaving a plain tracker.
          </P>
        </Section>
      )}

      <Section title="What is kept, and what is cleared">
        <P>
          Krama clears out rows that only record an absence — a routine day you
          skipped, once it is more than {RETENTION.droppedRoutineDays} days old,
          along with expired sign-ins and used one-time codes.
        </P>
        <P>
          Your points are never touched by any of that. They are kept in a
          separate append-only ledger that the app itself cannot edit or delete,
          so a removed task takes the plan and leaves the history. Finished
          tasks are kept forever unless you choose otherwise in{" "}
          <Ref href="/app/profile?s=data">Settings → Data</Ref>.
        </P>
      </Section>

      <Section title="Who can see your things">
        <P>
          Notes, tasks, saved links and events are yours. The admin screens
          cannot read them — not because those screens decline to ask, but
          because the database connection behind them has no permission to
          select those columns at all.
        </P>
        <P>
          Two deliberate exceptions. Anything you send from{" "}
          <Ref href="/app/profile?s=feedback">Settings → Feedback</Ref> is meant
          to be read, since it was addressed to an administrator. And if you
          ever ask for help with something specific, you are shown exactly what
          you would be sharing and for how long, and you can withdraw it at any
          point.
        </P>
      </Section>

      <p className="mt-10 border-t border-ln pt-5 text-[12px] leading-relaxed text-mut">
        Something here wrong, or missing?{" "}
        <Ref href="/app/profile?s=feedback">Tell us</Ref> — it goes straight to
        whoever runs Krama.
      </p>
    </div>
  );
}

/** capture → commit → schedule → record, drawn rather than described. */
function Chain() {
  const steps = [
    { label: "Capture", note: "a note, a link, a thought" },
    { label: "Commit", note: "it becomes a task" },
    { label: "Schedule", note: "it takes up real time" },
    { label: "Record", note: "finishing it counts" },
  ];
  return (
    <ol className="mt-7 grid gap-2 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className="rounded-lg border border-ln bg-surf px-3 py-2.5"
        >
          <p className="font-mono text-[10px] text-fai">{i + 1}</p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-ink">
            {s.label}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-mut">
            {s.note}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-[15px] font-semibold tracking-[-0.015em] text-ink">
        {title}
      </h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-mut first:mt-0">
      {children}
    </p>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 flex flex-col gap-2.5">
      {rows.map(([term, body]) => (
        <div key={term}>
          <dt className="text-[12px] font-semibold text-ink">{term}</dt>
          <dd className="mt-0.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
            {body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-ln2 bg-surf2 px-1.5 py-0.5 font-mono text-[11px] text-ink2">
      {children}
    </kbd>
  );
}

function Ref({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-medium text-acc underline decoration-ln2 underline-offset-2 hover:decoration-acc"
    >
      {children}
    </Link>
  );
}
