import { POINTS, MAX_POINTS, MIN_POINTS } from "@/lib/points";

/**
 * The scoring, written out.
 *
 * The third column is the design's, and it is the one that matters: not
 * what an action is, but *why it is priced there*. A score you can't
 * interrogate is one you either stop trusting or start gaming.
 *
 * Every number is read from the same constants the engine uses, so this
 * table cannot drift away from the behaviour it describes.
 */

const ROWS: { key: keyof typeof POINTS; label: string; why: string }[] = [
  {
    key: "deepBlock",
    label: "Deep work block",
    why: "The ceiling everything is priced against.",
  },
  { key: "standardTask", label: "Standard task", why: "The common case." },
  { key: "studySession", label: "Study session", why: "Effort, not outcome." },
  {
    key: "quickTask",
    label: "Quick task",
    why: "Cheap to do, cheaply priced.",
  },
  {
    key: "recurringRoutine",
    label: "Recurring routine",
    why: "Reliable, so it can't be farmed.",
  },
  { key: "upkeep", label: "Status / upkeep", why: "The floor." },
];

export default function PointsTable() {
  const spread = Math.round(MAX_POINTS / MIN_POINTS);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <Th>Action</Th>
              <Th className="w-[70px]">Points</Th>
              <Th>Why that number</Th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key}>
                <Td>
                  <b className="font-semibold text-ink">{row.label}</b>
                </Td>
                <Td>
                  <span className="tabular font-semibold text-ink">
                    {POINTS[row.key]}
                  </span>
                </Td>
                <Td>{row.why}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-mut">
        <b className="font-semibold text-ink">
          Spread is {spread}×, not 50×.
        </b>{" "}
        When one action pays far more than the rest, you optimise for the score
        instead of the work.
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={
        "border-b border-ln py-2 pr-3 text-left font-mono text-[9.5px] font-semibold uppercase tracking-[0.11em] text-fai " +
        className
      }
    >
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
