import { db } from "@/lib/db";
import {
  normaliseTagName,
  tagKey,
  type TagChip,
  type Taggable,
} from "@/lib/tags";

/** Every function takes userId first and filters on it. No exceptions. */

export type TagRow = {
  id: string;
  name: string;
  colour: string;
  usedAt: Date | null;
};

export async function listTags(userId: string): Promise<TagRow[]> {
  return db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, colour: true, usedAt: true },
  });
}

export async function createTag(
  userId: string,
  name: string,
  colour = "mut",
): Promise<TagRow> {
  return db.tag.create({
    data: { userId, name, colour },
    select: { id: true, name: true, colour: true, usedAt: true },
  });
}

export async function recolourTag(
  userId: string,
  id: string,
  colour: string,
): Promise<boolean> {
  const { count } = await db.tag.updateMany({ where: { id, userId }, data: { colour } });
  return count > 0;
}

export async function deleteTag(userId: string, id: string): Promise<boolean> {
  const { count } = await db.tag.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Tags nothing has touched in a while — the "tidy up" prompt. */
export async function staleTags(
  userId: string,
  days = 90,
): Promise<TagRow[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000);
  return db.tag.findMany({
    where: {
      userId,
      OR: [{ usedAt: null, createdAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, colour: true, usedAt: true },
  });
}

/**
 * Areas with what the design shows beside them: how much is filed under
 * each, and how much time it took this week.
 */
export type AreaStat = {
  id: string;
  name: string;
  colour: string;
  items: number;
  minutesThisWeek: number;
};

export async function areaStats(
  userId: string,
  weekStart: Date,
): Promise<AreaStat[]> {
  const areas = await db.area.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      colour: true,
      _count: { select: { tasks: true, events: true } },
      events: {
        where: { startsAt: { gte: weekStart } },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  return areas.map((a) => ({
    id: a.id,
    name: a.name,
    colour: a.colour,
    items: a._count.tasks + a._count.events,
    minutesThisWeek: a.events.reduce(
      (sum, e) =>
        sum + Math.max(0, Math.round((+e.endsAt - +e.startsAt) / 60_000)),
      0,
    ),
  }));
}

// ------------------------------------------------ attaching tags to things

/**
 * Finds or creates each name, and returns the rows.
 *
 * Matching is case-insensitive so "Interviews" typed on a task finds the
 * "interviews" that already exists rather than founding a rival. The
 * existing spelling wins: renaming is a deliberate act in Settings, not
 * a side effect of typing it differently somewhere else.
 */
export async function resolveTags(
  userId: string,
  names: string[],
): Promise<TagChip[]> {
  const wanted = new Map<string, string>();
  for (const raw of names) {
    const name = normaliseTagName(raw);
    if (!name) continue;
    if (!wanted.has(tagKey(name))) wanted.set(tagKey(name), name);
  }
  if (wanted.size === 0) return [];

  const found = new Map<string, TagChip>();
  const existing = await db.tag.findMany({
    where: { userId, name: { in: [...wanted.values()], mode: "insensitive" } },
    select: { id: true, name: true, colour: true },
  });
  for (const t of existing) found.set(tagKey(t.name), t);

  const missing = [...wanted.entries()].filter(([key]) => !found.has(key));
  if (missing.length > 0) {
    // skipDuplicates because two requests can race to invent the same
    // tag; losing that race should be a no-op, not an error thrown at
    // whoever happened to be second.
    await db.tag.createMany({
      data: missing.map(([, name]) => ({ userId, name })),
      skipDuplicates: true,
    });

    const created = await db.tag.findMany({
      where: {
        userId,
        name: { in: missing.map(([, name]) => name), mode: "insensitive" },
      },
      select: { id: true, name: true, colour: true },
    });
    for (const t of created) found.set(tagKey(t.name), t);
  }

  // Returned in the order asked for, so the chips appear where typed.
  return [...wanted.keys()]
    .map((key) => found.get(key))
    .filter((t): t is TagChip => Boolean(t));
}

function delegateFor(type: Taggable) {
  if (type === "task") return db.task;
  if (type === "note") return db.note;
  if (type === "event") return db.event;
  return db.link;
}

/**
 * Replaces the tags on one piece of content, returning null if it isn't
 * this user's to tag.
 *
 * `set` rather than `connect`, because the picker posts the whole list:
 * anything missing from it was deliberately taken off, and connect would
 * silently make removal impossible.
 *
 * Ownership is proven on both sides — the tags are resolved within this
 * user, and the row is matched on userId before it is touched — so a
 * crafted post can neither borrow someone else's tag nor label someone
 * else's task.
 */
export async function setTagsOn(
  userId: string,
  type: Taggable,
  itemId: string,
  names: string[],
): Promise<TagChip[] | null> {
  const owner = await (
    delegateFor(type) as unknown as {
      findFirst(a: unknown): Promise<{ id: string } | null>;
    }
  ).findFirst({ where: { id: itemId, userId }, select: { id: true } });
  if (!owner) return null;

  const tags = await resolveTags(userId, names);

  await (
    delegateFor(type) as unknown as {
      update(a: unknown): Promise<unknown>;
    }
  ).update({
    where: { id: itemId },
    data: { tags: { set: tags.map((t) => ({ id: t.id })) } },
  });

  // What makes the stale-tag review in Settings mean anything: a tag
  // nobody has applied in months is the one worth questioning.
  if (tags.length > 0) {
    await db.tag.updateMany({
      where: { userId, id: { in: tags.map((t) => t.id) } },
      data: { usedAt: new Date() },
    });
  }

  return tags;
}

/** How many things carry each tag, keyed by tag id. */
export async function tagUsage(userId: string): Promise<Record<string, number>> {
  const tags = await db.tag.findMany({
    where: { userId },
    select: {
      id: true,
      _count: { select: { tasks: true, notes: true, events: true, links: true } },
    },
  });

  const out: Record<string, number> = {};
  for (const t of tags) {
    out[t.id] =
      t._count.tasks + t._count.notes + t._count.events + t._count.links;
  }
  return out;
}
