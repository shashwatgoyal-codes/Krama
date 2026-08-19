import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { search } from "@/lib/repositories/search";
import { listTags } from "@/lib/repositories/tags";
import { parseQuery } from "@/lib/search";
import TagChips from "@/components/tags/TagChips";
import SearchBox from "@/components/search/SearchBox";

export const metadata: Metadata = {
  title: pageTitle("Search"),
  robots: { index: false, follow: false },
};

const KIND_LABEL: Record<string, string> = {
  task: "Task",
  note: "Note",
  event: "Event",
  link: "Link",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const raw = params.q ?? "";

  const query = parseQuery(raw);
  const [hits, tags] = await Promise.all([
    search(user.id, query),
    listTags(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6">
      <h1 className="font-display text-[17px] font-semibold tracking-[-0.015em]">
        Search
      </h1>
      <p className="mt-1 text-[12px] text-mut">
        Everything you have written, in one place.
      </p>

      <div className="mt-4">
        <SearchBox initial={raw} tags={tags} />
      </div>

      {query.empty ? (
        <div className="mt-8 rounded-xl border border-dashed border-ln2 px-5 py-8 text-center">
          <p className="text-[12.5px] text-mut">
            Type to search tasks, notes, events and saved links.
          </p>
          <p className="mx-auto mt-3 max-w-[44ch] text-[11.5px] leading-relaxed text-fai">
            <code className="font-mono text-ink">tag:learning</code> narrows to
            a tag, <code className="font-mono text-ink">is:note</code> to one
            kind, <code className="font-mono text-ink">&quot;exact words&quot;</code>{" "}
            to a phrase, and <code className="font-mono text-ink">-draft</code>{" "}
            leaves things out.
          </p>
        </div>
      ) : hits.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-ln2 px-5 py-8 text-center">
          <p className="text-[12.5px] text-mut">
            Nothing matches{" "}
            <span className="font-semibold text-ink">{raw.trim()}</span>.
          </p>
        </div>
      ) : (
        <>
          <p className="label-xs tabular mt-5">
            {hits.length} {hits.length === 1 ? "result" : "results"}
          </p>

          <ul className="mt-2 divide-y divide-ln border-y border-ln">
            {hits.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <Link
                  href={hit.href}
                  className="block px-1 py-3 transition-colors hover:bg-surf2"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="label-xs flex-none">
                      {KIND_LABEL[hit.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                      {hit.title}
                    </span>
                  </div>

                  {hit.excerpt && (
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mut">
                      {hit.excerpt}
                    </p>
                  )}

                  {hit.tags.length > 0 && (
                    <div className="mt-1.5">
                      <TagChips tags={hit.tags} max={4} size="xs" />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
