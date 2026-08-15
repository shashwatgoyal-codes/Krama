import { db } from "@/lib/db";
import type { Task, TaskStatus } from "@prisma/client";
import { dayKeyFor, dayKeyToDate } from "@/lib/day";

/**
 * Every function here takes `userId` as a required first argument, and
 * every query filters on it.
 *
 * This is the whole authorisation model. There is no "get task by id"
 * that trusts the id alone — an id from someone else's account returns
 * nothing rather than their data. Losing that habit in one function is
 * all it takes to leak another user's rows, so it is never optional.
 */

export type TaskSummary = Pick<
  Task,
  "id" | "title" | "status" | "points" | "areaId" | "dueOn" | "recurrence"
>;

const SUMMARY = {
  id: true,
  title: true,
  status: true,
  points: true,
  areaId: true,
  dueOn: true,
  recurrence: true,
} as const;

export async function listTasksForDay(
  userId: string,
  dayKey: string,
): Promise<TaskSummary[]> {
  return db.task.findMany({
    where: { userId, createdForDate: dayKeyToDate(dayKey) },
    select: SUMMARY,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

export async function listOpenTasks(
  userId: string,
  limit = 50,
): Promise<TaskSummary[]> {
  return db.task.findMany({
    where: { userId, status: "open" },
    select: SUMMARY,
    orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function getTask(
  userId: string,
  taskId: string,
): Promise<Task | null> {
  // findFirst, not findUnique — findUnique can't filter on userId, and a
  // lookup by id alone would return another account's row.
  return db.task.findFirst({ where: { id: taskId, userId } });
}

export type CreateTaskData = {
  title: string;
  notes?: string;
  areaId?: string;
  points?: number;
  dueOn?: Date;
  recurrence?: Task["recurrence"];
  recurrenceValue?: number;
  timezone: string;
  dayEndsAtHour: number;
};

export async function createTask(
  userId: string,
  data: CreateTaskData,
): Promise<TaskSummary> {
  const dayKey = dayKeyFor(new Date(), data.timezone, data.dayEndsAtHour);

  return db.task.create({
    data: {
      userId,
      title: data.title,
      notes: data.notes,
      areaId: data.areaId,
      points: data.points ?? 20,
      dueOn: data.dueOn,
      recurrence: data.recurrence ?? "none",
      recurrenceValue: data.recurrenceValue,
      createdForDate: dayKeyToDate(dayKey),
    },
    select: SUMMARY,
  });
}

/**
 * Returns null when the task isn't this user's, so callers can respond
 * "not found" rather than revealing that the row exists at all.
 */
export async function setTaskStatus(
  userId: string,
  taskId: string,
  status: TaskStatus,
): Promise<Task | null> {
  const result = await db.task.updateMany({
    where: { id: taskId, userId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });
  if (result.count === 0) return null;
  return getTask(userId, taskId);
}

export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const result = await db.task.deleteMany({ where: { id: taskId, userId } });
  return result.count > 0;
}

/** Points already earned on a given day — feeds the soft daily cap. */
export async function pointsOnDay(
  userId: string,
  dayKey: string,
): Promise<number> {
  const result = await db.pointEntry.aggregate({
    where: { userId, countedFor: dayKeyToDate(dayKey) },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}
