import { db } from "@/lib/db";
import { AREA_COLOURS } from "@/lib/areas";

export { AREA_COLOURS };

/** Every function takes userId first and filters on it. No exceptions. */

export type Area = {
  id: string;
  name: string;
  colour: string;
  order: number;
};

export type AreaWithCounts = Area & {
  openTasks: number;
  totalTasks: number;
};

const SELECT = { id: true, name: true, colour: true, order: true } as const;

export async function listAreas(userId: string): Promise<Area[]> {
  return db.area.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: SELECT,
  });
}

/** With task counts, so the settings panel can warn before a delete. */
export async function listAreasWithCounts(
  userId: string,
): Promise<AreaWithCounts[]> {
  const areas = await db.area.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      ...SELECT,
      _count: { select: { tasks: true } },
      tasks: { where: { status: "open" }, select: { id: true } },
    },
  });

  return areas.map((a) => ({
    id: a.id,
    name: a.name,
    colour: a.colour,
    order: a.order,
    openTasks: a.tasks.length,
    totalTasks: a._count.tasks,
  }));
}

export async function createArea(
  userId: string,
  name: string,
  colour: string,
): Promise<Area> {
  // New areas go to the end rather than the top: the order someone set
  // is a decision, and a new arrival shouldn't jump it.
  const last = await db.area.findFirst({
    where: { userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return db.area.create({
    data: { userId, name, colour, order: (last?.order ?? -1) + 1 },
    select: SELECT,
  });
}

export async function renameArea(
  userId: string,
  id: string,
  data: { name?: string; colour?: string },
): Promise<boolean> {
  const { count } = await db.area.updateMany({ where: { id, userId }, data });
  return count > 0;
}

/**
 * Deleting an area leaves its tasks alone — the schema sets their areaId
 * to null. Losing a task because you tidied up your categories would be
 * indefensible, so the tasks simply become unfiled.
 */
export async function deleteArea(userId: string, id: string): Promise<boolean> {
  const { count } = await db.area.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Persists a drag-reorder as one write per area, in one round trip. */
export async function reorderAreas(
  userId: string,
  orderedIds: string[],
): Promise<void> {
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.area.updateMany({ where: { id, userId }, data: { order: index } }),
    ),
  );
}

/** Used when assigning a task, to prove the area is this user's. */
export async function areaBelongsTo(
  userId: string,
  areaId: string,
): Promise<boolean> {
  const found = await db.area.findFirst({
    where: { id: areaId, userId },
    select: { id: true },
  });
  return Boolean(found);
}
