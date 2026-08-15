import { db } from "@/lib/db";

/** Every function takes userId first and filters on it. No exceptions. */

export type LinkFilter = "all" | "unread" | "linkedin" | "articles";

export type SavedLink = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  source: string;
  why: string | null;
  tags: string[];
  savedAt: Date;
  readAt: Date | null;
  taskId: string | null;
};

const SELECT = {
  id: true,
  url: true,
  title: true,
  description: true,
  imageUrl: true,
  source: true,
  why: true,
  tags: true,
  savedAt: true,
  readAt: true,
  taskId: true,
} as const;

function where(userId: string, filter: LinkFilter) {
  const base = { userId, archivedAt: null };
  return {
    all: base,
    unread: { ...base, readAt: null },
    linkedin: { ...base, source: { contains: "linkedin" } },
    // "Articles" is everything that isn't social — a rough cut, but a
    // useful one, and it costs nothing to be wrong about occasionally.
    articles: { ...base, NOT: { source: { contains: "linkedin" } } },
  }[filter];
}

export async function listLinks(
  userId: string,
  filter: LinkFilter = "all",
): Promise<SavedLink[]> {
  return db.link.findMany({
    where: where(userId, filter),
    orderBy: { savedAt: "desc" },
    select: SELECT,
    take: 200,
  });
}

export async function countLinks(
  userId: string,
): Promise<Record<LinkFilter, number>> {
  const [all, unread, linkedin, articles] = await Promise.all([
    db.link.count({ where: where(userId, "all") }),
    db.link.count({ where: where(userId, "unread") }),
    db.link.count({ where: where(userId, "linkedin") }),
    db.link.count({ where: where(userId, "articles") }),
  ]);
  return { all, unread, linkedin, articles };
}

/** findFirst, never findUnique — the id alone must not be enough. */
export async function getLink(
  userId: string,
  id: string,
): Promise<SavedLink | null> {
  return db.link.findFirst({ where: { id, userId }, select: SELECT });
}

export async function createLink(
  userId: string,
  data: {
    url: string;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    source: string;
  },
): Promise<SavedLink> {
  return db.link.create({ data: { userId, ...data }, select: SELECT });
}

/** Already saved? Return it rather than making a second copy. */
export async function findByUrl(
  userId: string,
  url: string,
): Promise<SavedLink | null> {
  return db.link.findFirst({
    where: { userId, url, archivedAt: null },
    select: SELECT,
  });
}

export async function updateLink(
  userId: string,
  id: string,
  data: {
    title?: string;
    why?: string | null;
    tags?: string[];
    readAt?: Date | null;
    archivedAt?: Date | null;
    taskId?: string | null;
  },
): Promise<boolean> {
  const { count } = await db.link.updateMany({ where: { id, userId }, data });
  return count > 0;
}

/** For the "Saved" strip on Today — the few most recent, unread first. */
export async function recentLinks(
  userId: string,
  limit = 2,
): Promise<SavedLink[]> {
  return db.link.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { savedAt: "desc" }],
    select: SELECT,
    take: limit,
  });
}
