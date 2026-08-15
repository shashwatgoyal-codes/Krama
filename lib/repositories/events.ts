import { db } from "@/lib/db";
import { dayWindow } from "@/lib/time";
import type { Recurrence } from "@prisma/client";

/** Every function takes userId first and filters on it. No exceptions. */

export type PlanBlock = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  taskId: string | null;
  taskDone: boolean;
  points: number | null;
  areaName: string | null;
  recurring: boolean;
  recurrence: Recurrence | null;
  recurrenceValue: number | null;
};

const BLOCK_SELECT = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  taskId: true,
  area: { select: { name: true } },
  task: {
    select: {
      status: true,
      points: true,
      recurrence: true,
      recurrenceValue: true,
    },
  },
} as const;

type Row = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  taskId: string | null;
  area: { name: string } | null;
  task: {
    status: string;
    points: number;
    recurrence: Recurrence;
    recurrenceValue: number | null;
  } | null;
};

function toBlock(row: Row): PlanBlock {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    taskId: row.taskId,
    taskDone: row.task?.status === "done",
    points: row.task?.points ?? null,
    areaName: row.area?.name ?? null,
    recurring: Boolean(row.task && row.task.recurrence !== "none"),
    recurrence: row.task?.recurrence ?? null,
    recurrenceValue: row.task?.recurrenceValue ?? null,
  };
}

/** The plan for one app-day, respecting the 4am boundary. */
export async function listDayBlocks(
  userId: string,
  dayKey: string,
  timeZone: string,
  dayEndsAtHour: number,
): Promise<PlanBlock[]> {
  const { start, end } = dayWindow(dayKey, timeZone, dayEndsAtHour);

  const rows = await db.event.findMany({
    where: { userId, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: BLOCK_SELECT,
  });

  return rows.map(toBlock);
}

/** Everything between two instants — what the week grid renders. */
export async function listBlocksBetween(
  userId: string,
  start: Date,
  end: Date,
): Promise<PlanBlock[]> {
  const rows = await db.event.findMany({
    where: { userId, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    select: BLOCK_SELECT,
  });
  return rows.map(toBlock);
}

export async function createBlock(
  userId: string,
  input: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    taskId?: string;
    areaId?: string;
  },
): Promise<{ id: string }> {
  return db.event.create({
    data: { userId, ...input },
    select: { id: true },
  });
}

/** findFirst, never findUnique — the id alone must not be enough. */
export async function getBlock(userId: string, id: string) {
  return db.event.findFirst({
    where: { id, userId },
    select: { ...BLOCK_SELECT, areaId: true },
  });
}

export async function moveBlock(
  userId: string,
  id: string,
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  const { count } = await db.event.updateMany({
    where: { id, userId },
    data: { startsAt, endsAt },
  });
  return count > 0;
}

/**
 * Removes the block, not the task. Unscheduling something should put it
 * back on the waiting list, not quietly delete the work.
 */
export async function deleteBlock(userId: string, id: string): Promise<boolean> {
  const { count } = await db.event.deleteMany({ where: { id, userId } });
  return count > 0;
}

/** Task ids already on the plan, so they aren't offered twice. */
export async function scheduledTaskIds(
  userId: string,
  dayKey: string,
  timeZone: string,
  dayEndsAtHour: number,
): Promise<Set<string>> {
  const { start, end } = dayWindow(dayKey, timeZone, dayEndsAtHour);
  const rows = await db.event.findMany({
    where: { userId, taskId: { not: null }, startsAt: { gte: start, lt: end } },
    select: { taskId: true },
  });
  return new Set(rows.map((r) => r.taskId).filter((id): id is string => !!id));
}
