import { db } from "@/lib/db";
import type { TagChip, Taggable } from "@/lib/tags";
import {
  kindsToSearch,
  scoreMatch,
  excerpt,
  textMatches,
  type SearchQuery,
} from "@/lib/search";

/** Every function takes userId first and filters on it. No exceptions. */

export type SearchHit = {
  kind: Taggable;
  id: string;
  title: string;
  excerpt: string;
  tags: TagChip[];
  /** Where clicking it goes. */
  href: string;
  /** Sort key; higher is a better match. */
  score: number;
  /** For the secondary sort — recency breaks ties. */
  at: Date;
};

const TAG_PICK = {
  select: { id: true, name: true, colour: true },
  orderBy: { name: "asc" },
} as const;

/**
 * Per-kind caps. Search reads a bounded slice of each type and ranks in
 * memory rather than asking Postgres to rank across four tables.
 *
 * That is the right trade at this size: a personal planner has hundreds
 * of rows, not millions, and one full-text index per table plus a union
 * query would be a great deal of machinery to rank a list you could
 * count. If this ever grows past what a single read can hold, the fix is
 * tsvector columns and a UNION — not a bigger cap.
 */
const PER_KIND = 200;

/** Words are ANDed by Postgres here only as a coarse filter; the precise
 *  rules (phrases, exclusions) are applied in lib/search.ts afterwards. */
function coarse(query: SearchQuery): string | null {
  const first = query.phrases[0] ?? query.terms[0];
  return first ?? null;
}

export async function search(
  userId: string,
  query: SearchQuery,
): Promise<SearchHit[]> {
  if (query.empty) return [];

  const kinds = kindsToSearch(query);
  const needle = coarse(query);
  const contains = needle
    ? { contains: needle, mode: "insensitive" as const }
    : undefined;

  // Tag filtering happens in the database, because a tag search that
  // read 200 of everything and then threw most of it away would report
  // "no results" for a tag whose items sat just past the cap.
  const tagWhere =
    query.tags.length > 0
      ? {
          AND: query.tags.map((name) => ({
            tags: { some: { name: { equals: name, mode: "insensitive" as const } } },
          })),
        }
      : {};

  const hits: SearchHit[] = [];

  /**
   * The database narrows with one term; this decides.
   *
   * Without it a search for "deep work" would return everything holding
   * "deep", because only the first needle reaches Postgres. Phrases and
   * exclusions are not expressible in that coarse filter at all, so the
   * precise rules have to be applied to what comes back.
   */
  const keep = (title: string, body: string, hit: SearchHit) => {
    if (!textMatches(`${title}\n${body}`, query)) return;
    hits.push(hit);
  };

  if (kinds.includes("task")) {
    const rows = await db.task.findMany({
      where: {
        userId,
        ...tagWhere,
        ...(contains
          ? { OR: [{ title: contains }, { notes: contains }] }
          : {}),
      },
      select: {
        id: true,
        title: true,
        notes: true,
        updatedAt: true,
        tags: TAG_PICK,
      },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
    });

    for (const r of rows) {
      keep(r.title, r.notes ?? "", {
        kind: "task",
        id: r.id,
        title: r.title,
        excerpt: excerpt(r.notes ?? "", query),
        tags: r.tags,
        href: `/app/tasks?id=${r.id}`,
        score: scoreMatch(r.title, r.notes ?? "", query),
        at: r.updatedAt,
      });
    }
  }

  if (kinds.includes("note")) {
    const rows = await db.note.findMany({
      where: {
        userId,
        archivedAt: null,
        ...tagWhere,
        ...(contains ? { body: contains } : {}),
      },
      select: { id: true, body: true, updatedAt: true, tags: TAG_PICK },
      orderBy: { updatedAt: "desc" },
      take: PER_KIND,
    });

    for (const r of rows) {
      // A note has no title, so its first line stands in for one — which
      // is how people write notes anyway.
      const firstLine = r.body.split("\n")[0]?.trim() || "Untitled note";
      keep(firstLine, r.body, {
        kind: "note",
        id: r.id,
        title: firstLine.slice(0, 80),
        excerpt: excerpt(r.body, query),
        tags: r.tags,
        href: "/app/notes",
        score: scoreMatch(firstLine, r.body, query),
        at: r.updatedAt,
      });
    }
  }

  if (kinds.includes("event")) {
    const rows = await db.event.findMany({
      where: { userId, ...tagWhere, ...(contains ? { title: contains } : {}) },
      select: { id: true, title: true, startsAt: true, tags: TAG_PICK },
      orderBy: { startsAt: "desc" },
      take: PER_KIND,
    });

    for (const r of rows) {
      keep(r.title, "", {
        kind: "event",
        id: r.id,
        title: r.title,
        excerpt: "",
        tags: r.tags,
        href: "/app/calendar",
        score: scoreMatch(r.title, "", query),
        at: r.startsAt,
      });
    }
  }

  if (kinds.includes("link")) {
    const rows = await db.link.findMany({
      where: {
        userId,
        archivedAt: null,
        ...tagWhere,
        ...(contains
          ? {
              OR: [
                { title: contains },
                { description: contains },
                { why: contains },
                { url: contains },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        url: true,
        description: true,
        why: true,
        savedAt: true,
        tags: TAG_PICK,
      },
      orderBy: { savedAt: "desc" },
      take: PER_KIND,
    });

    for (const r of rows) {
      // "why" first: the reason you saved it is more useful than the
      // page's own description, which is usually marketing.
      const body = r.why || r.description || "";
      // The url goes into the matched text as well as the query, or a
      // search for "linkedin" would be found by the database and then
      // thrown away by the filter for not appearing in the title.
      keep(r.title, `${body}\n${r.url}`, {
        kind: "link",
        id: r.id,
        title: r.title,
        excerpt: excerpt(body, query),
        tags: r.tags,
        href: `/app/explore?id=${r.id}`,
        score: scoreMatch(r.title, body, query),
        at: r.savedAt,
      });
    }
  }

  // Best match first, most recent as the tiebreak.
  return hits
    .sort((a, b) => b.score - a.score || +b.at - +a.at)
    .slice(0, 60);
}
