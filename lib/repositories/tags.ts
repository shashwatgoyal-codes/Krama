import { db } from "@/lib/db";

/** Every function takes userId first and filters on it. No exceptions. */

export type TagRow = { id: string; name: string; usedAt: Date | null };

export async function listTags(userId: string): Promise<TagRow[]> {
  return db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, usedAt: true },
  });
}

export async function createTag(userId: string, name: string): Promise<TagRow> {
  return db.tag.create({
    data: { userId, name },
    select: { id: true, name: true, usedAt: true },
  });
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
    select: { id: true, name: true, usedAt: true },
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
