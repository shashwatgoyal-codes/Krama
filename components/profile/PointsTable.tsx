import { POINTS, streakMultiplier, pointsForLevel } from "@/lib/points";
import { BACKDATE_MULTIPLIER } from "@/lib/day";

/**
 * The scoring, written out.
 *
 * This table exists because a score you can't inspect is a score you
 * can't trust, and one you can't trust either stops mattering or starts
 * mattering too much. Every number here is read from the same constants
 * the engine uses, so the page cannot drift from the behaviour.
 */

const TIERS: { key: keyof typeof POINTS; label: string; when: string }[] = [
  { key: "deepBlock", label: "Deep block", when: "An hour or more of real concentration" },
  { key: "standardTask", label: "A proper task", when: "The normal unit of work" },
  { key: "studySession", label: "Study or reading", when: "Learning something on purpose" },
  { key: "recurringRoutine", label: "A routine", when: "Something that returns on its own" },
  { key: "quickTask", label: "Quick task", when: "Ten minutes, but it needed doing" },
  { key: "upkeep", label: "Upkeep", when: "Small maintenance that still counts" },
];

export default function PointsTable({
  dailyFloor,
  dailyCap,
}: {
  dailyFloor: number;
  dailyCap: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <Th>Action</Th>
              <Th>Points</Th>
              <Th>What it means</Th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => (
              <tr key={tier.key}>
                <Td>
                  <span className="font-semibold text-ink">{tier.label}</span>
                </Td>
                <Td>
                  <span className="tabular font-semibold text-ink">
                    {POINTS[tier.key]}
                  </span>
                </Td>
                <Td>{tier.when}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-ln bg-surf2 p-3">
        <p className="label-xs mb-2">What changes the number</p>
        <ul className="flex flex-col gap-1.5 text-[11.5px] leading-relaxed text-mut">
          <Rule>
            <b>Streak</b> adds 2% per day, stopping at{" "}
            <Num>{streakMultiplier(30).toFixed(2)}×</Num> after 30 days — long
            enough to feel, small enough that it can never dwarf the work.
          </Rule>
          <Rule>
            <b>Past {dailyCap} points in a day</b> awards pay half, then a
            quarter. Nothing is ever blocked; the ceiling just stops mattering.
          </Rule>
          <Rule>
            <b>Backdating</b> pays{" "}
            <Num>{Math.round(BACKDATE_MULTIPLIER * 100)}%</Num>, so a month of
            work can&rsquo;t be entered on the 31st and counted in full.
          </Rule>
          <Rule>
            <b>Clearing the floor</b> — {dailyFloor}{" "}
            {dailyFloor === 1 ? "thing" : "things"} — is what holds a streak
            together. Rest days never break it.
          </Rule>
          <Rule>
            <b>Levels</b> need <Num>{pointsForLevel(2)}</Num> points for level 2
            and <Num>{pointsForLevel(10)}</Num> for level 10 — the curve slows
            down, it doesn&rsquo;t stop.
          </Rule>
        </ul>
      </div>

      <p className="text-[11.5px] leading-relaxed text-fai">
        Effort is scored, outcomes are not. Everything above is something you
        decide to do; none of it depends on anyone else saying yes.
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-ln py-2 pr-3 text-left font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-fai">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border-b border-ln py-2 pr-3 align-top text-mut">
      {children}
    </td>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span aria-hidden className="mt-[7px] size-1 flex-none rounded-full bg-ln2" />
      <span>{children}</span>
    </li>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="tabular font-semibold text-ink">{children}</span>;
}
