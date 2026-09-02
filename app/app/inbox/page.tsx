import type { Metadata } from "next";
import Link from "next/link";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { listUntriaged, listTriaged } from "@/lib/repositories/capture";
import { suggest, SUGGESTION_LABEL } from "@/lib/capture";
import { pageTitle } from "@/lib/env";
import TriageRow from "./TriageRow";
import { triage, discardCapture } from "./actions";

export const metadata: Metadata = {
  title: pageTitle("Inbox"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEST: Record<string, string> = {
  task: "/app/tasks",
  note: "/app/notes",
  link: "/app/explore",
};

export default async function InboxPage() {
  const user = await requireUserOrThrow();
  const [waiting, done] = await Promise.all([
    listUntriaged(user.id),
    listTriaged(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8">
      <h1 className="font-display text-[17px] font-semibold">Inbox</h1>
      <p className="mt-2 max-w-[56ch] text-[12.5px] leading-relaxed text-mut">
        Everything you captured with{" "}
        <kbd className="rounded border border-ln2 bg-surf2 px-1 font-mono text-[11px]">
          ⌘K
        </kbd>{" "}
        and haven&rsquo;t decided about yet. Deciding here costs nothing —
        that is the point of not deciding at the time.
      </p>

      {waiting.length === 0 ? (
        <p className="mt-5 rounded-xl border border-ln bg-surf p-5 text-center text-[12.5px] text-mut">
          Nothing waiting. Press{" "}
          <kbd className="rounded border border-ln2 bg-surf2 px-1 font-mono text-[11px]">
            ⌘K
          </kbd>{" "}
          from anywhere to add something.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {waiting.map((item) => (
            <TriageRow
              key={item.id}
              id={item.id}
              text={item.text}
              suggested={suggest(item.text)}
              capturedAt={item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              triage={triage}
              discard={discardCapture}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="label-xs text-mut">Recently filed</h2>
          <div className="mt-2 rounded-xl border border-ln bg-surf">
            {done.map((d) => (
              <div key={d.id} className="border-b border-ln p-3 last:border-0">
                <p className="text-[12.5px] text-mut line-clamp-2">{d.text}</p>
                <p className="mt-1 text-[11px] text-fai">
                  {d.resultType && DEST[d.resultType] ? (
                    <>
                      Became a {d.resultType} ·{" "}
                      <Link href={DEST[d.resultType]} className="font-semibold text-acc">
                        {SUGGESTION_LABEL[d.resultType as keyof typeof SUGGESTION_LABEL]}
                      </Link>
                    </>
                  ) : (
                    "Filed"
                  )}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
