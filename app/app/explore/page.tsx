import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import { requireUser } from "@/lib/auth/guard";
import TagChips from "@/components/tags/TagChips";
import { listLinks, countLinks, type LinkFilter } from "@/lib/repositories/links";
import SaveLinkBar from "@/components/explore/SaveLinkBar";
import LinkDetail, { type LinkDetailView } from "@/components/explore/LinkDetail";

export const metadata: Metadata = {
  title: pageTitle("Explore"),
  robots: { index: false, follow: false },
};

const FILTERS: { key: LinkFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "articles", label: "Articles" },
  { key: "unread", label: "Unread" },
];

/** "2d", "1w", "3mo" — enough to know whether it's gone stale. */
function age(savedAt: Date): string {
  const days = Math.floor((Date.now() - savedAt.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** "linkedin.com/posts/…" — the shape of it, not the whole thing. */
function shorten(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/$/, "");
    if (!path) return host;
    return path.length > 28 ? `${host}${path.slice(0, 28)}…` : `${host}${path}`;
  } catch {
    return url;
  }
}

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; id?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const filter = (FILTERS.find((f) => f.key === params.filter)?.key ??
    "all") as LinkFilter;

  const [links, counts] = await Promise.all([
    listLinks(user.id, filter),
    countLinks(user.id),
  ]);

  const selectedId =
    params.id && links.some((l) => l.id === params.id)
      ? params.id
      : (links[0]?.id ?? null);

  const selected = links.find((l) => l.id === selectedId) ?? null;

  const detail: LinkDetailView | null = selected && {
    id: selected.id,
    url: selected.url,
    title: selected.title,
    description: selected.description,
    imageUrl: selected.imageUrl,
    source: selected.source,
    why: selected.why ?? "",
    tags: selected.tags,
    read: Boolean(selected.readAt),
    isTask: Boolean(selected.taskId),
    shortUrl: shorten(selected.url),
  };

  const href = (id: string) =>
    filter === "all"
      ? `/app/explore?id=${id}`
      : `/app/explore?filter=${filter}&id=${id}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ln bg-surf px-4 py-2.5">
        <SaveLinkBar />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.45fr_1fr]">
        <section className="min-w-0 border-r border-ln bg-surf px-[18px] py-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/app/explore" : `/app/explore?filter=${f.key}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    "rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors " +
                    (active
                      ? "border-acc bg-acc text-on-acc"
                      : "border-ln2 text-mut hover:border-acc hover:text-acc")
                  }
                >
                  {f.label}
                  <span className="tabular ml-1.5 opacity-60">{counts[f.key]}</span>
                </Link>
              );
            })}
            <span className="label-xs tabular ml-auto">{counts.all} saved</span>
          </div>

          {links.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ln2 px-5 py-8 text-center">
              <p className="font-display text-[15px] font-semibold">
                Nothing saved yet
              </p>
              <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-mut">
                Paste a link above — a post, an article, anything you want to
                come back to. Krama reads the page for a title and a picture,
                and you add the part that matters: why you kept it.
              </p>
            </div>
          ) : (
            links.map((l) => {
              const active = l.id === selectedId;
              return (
                <Link
                  key={l.id}
                  href={href(l.id)}
                  aria-current={active ? "true" : undefined}
                  className={
                    "flex gap-[11px] border-b border-ln py-[11px] transition-colors " +
                    (active ? "-mx-[18px] bg-acc-soft px-[18px]" : "hover:bg-surf2")
                  }
                >
                  {l.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.imageUrl}
                      alt=""
                      className="h-10 w-[52px] flex-none rounded-[5px] border border-ln object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-[52px] flex-none place-items-center rounded-[5px] border border-ln bg-surf2">
                      <span className="font-mono text-[9px] text-fai">
                        {l.source.slice(0, 3).toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        "truncate text-[13px] font-semibold leading-[1.35] " +
                        (l.readAt ? "text-mut" : "text-ink")
                      }
                    >
                      {l.title}
                    </div>
                    {l.description && (
                      <div className="mt-0.5 truncate text-[11.5px] text-mut">
                        {l.description}
                      </div>
                    )}
                    <div className="mt-[5px] flex flex-wrap items-center gap-[7px]">
                      <TagChips tags={l.tags} max={2} size="xs" />
                      {!l.readAt && (
                        <span className="rounded border border-acc bg-acc-soft px-1.5 py-px text-[10px] font-semibold text-acc">
                          unread
                        </span>
                      )}
                      <span className="label-xs">
                        {l.source} · {age(l.savedAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </section>

        <aside className="min-w-0 bg-surf2 p-4">
          {detail ? (
            <LinkDetail key={detail.id} link={detail} />
          ) : (
            <p className="rounded-lg border border-dashed border-ln2 px-3 py-5 text-center text-[11.5px] leading-relaxed text-mut">
              Save something to see it here — the title, why you kept it, and
              a way to turn it into an actual task.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
