import { db } from "@/lib/db";
import type { Task, TaskStatus, Recurrence } from "@prisma/client";
import { dayKeyFor, dayKeyToDate } from "@/lib/day";
import type { TagChip } from "@/lib/tags";

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
  | "id"
  | "title"
  | "status"
  | "points"
  | "areaId"
  | "dueOn"
  | "recurrence"
  | "recurrenceValue"
  | "recurrenceDays"
>;

const SUMMARY = {
  id: true,
  title: true,
  status: true,
  points: true,
  areaId: true,
  dueOn: true,
  recurrence: true,
  // Needed to describe a routine as "weekly, Sunday" rather than just
  // "weekly" wherever a summary is shown.
  recurrenceValue: true,
  recurrenceDays: true,
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
  recurrenceDays?: number[];
  routineStartMinute?: number | null;
  routineMinutes?: number | null;
  /** The last day the routine runs, or null for open-ended. */
  recurrenceUntil?: Date | null;
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
      recurrenceDays: data.recurrenceDays ?? [],
      routineStartMinute: data.routineStartMinute ?? null,
      routineMinutes: data.routineMinutes ?? null,
      recurrenceUntil: data.recurrenceUntil ?? null,
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

export type TaskFilter = "all" | "today" | "upcoming" | "recurring" | "done";

export type TaskDetail = TaskSummary & {
  recurrenceValue: number | null;
  recurrenceParentId: string | null;
  createdForDate: Date;
};

const DETAIL = {
  ...SUMMARY,
  recurrenceValue: true,
  recurrenceParentId: true,
  createdForDate: true,
} as const;

/** Backs the Tasks page. Every branch still filters on userId. */
export async function listTasks(
  userId: string,
  filter: TaskFilter,
  todayKey: string,
): Promise<TaskDetail[]> {
  const today = dayKeyToDate(todayKey);

  const where = {
    all: { userId, status: { not: "dropped" as const } },
    today: { userId, createdForDate: today },
    upcoming: { userId, status: "open" as const, createdForDate: { gt: today } },
    // Templates only — instances are ordinary tasks.
    recurring: { userId, recurrence: { not: "none" as const }, recurrenceParentId: null },
    done: { userId, status: "done" as const },
  }[filter];

  return db.task.findMany({
    where,
    select: DETAIL,
    orderBy:
      filter === "done"
        ? [{ completedAt: "desc" as const }]
        : [{ status: "asc" as const }, { createdForDate: "desc" as const }],
    take: 200,
  });
}

/** Counts for the filter chips, so the page doesn't lie about what's there. */
export async function countTasks(
  userId: string,
  todayKey: string,
): Promise<Record<TaskFilter, number>> {
  const today = dayKeyToDate(todayKey);
  const [all, todayCount, upcoming, recurring, done] = await Promise.all([
    db.task.count({ where: { userId, status: { not: "dropped" } } }),
    db.task.count({ where: { userId, createdForDate: today } }),
    db.task.count({ where: { userId, status: "open", createdForDate: { gt: today } } }),
    db.task.count({ where: { userId, recurrence: { not: "none" }, recurrenceParentId: null } }),
    db.task.count({ where: { userId, status: "done" } }),
  ]);
  return { all, today: todayCount, upcoming, recurring, done };
}

export type TaskPanel = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  points: number;
  dueOn: Date | null;
  areaId: string | null;
  areaName: string | null;
  areaColour: string | null;
  recurrence: string;
  recurrenceValue: number | null;
  recurrenceDays: number[];
  recurrenceUntil: Date | null;
  routineStartMinute: number | null;
  routineMinutes: number | null;
  /** The block this task sits in, if it has been given a time. */
  block: { id: string; startsAt: Date; endsAt: Date } | null;
  /** The note it was captured from, if any. */
  fromNote: string | null;
  tags: TagChip[];
};

/**
 * Everything the detail panel shows, in one read.
 *
 * findFirst with userId rather than findUnique on the id — the id alone
 * must never be enough to open somebody else's task.
 */
export async function getTaskPanel(
  userId: string,
  taskId: string,
): Promise<TaskPanel | null> {
  const task = await db.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      title: true,
      notes: true,
      status: true,
      points: true,
      dueOn: true,
      areaId: true,
      recurrence: true,
      recurrenceValue: true,
      recurrenceDays: true,
      recurrenceUntil: true,
      routineStartMinute: true,
      routineMinutes: true,
      area: { select: { name: true, colour: true } },
      tags: {
        select: { id: true, name: true, colour: true },
        orderBy: { name: "asc" },
      },
      events: {
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { id: true, startsAt: true, endsAt: true },
      },
    },
  });
  if (!task) return null;

  const note = await db.note.findFirst({
    where: { userId, taskId },
    select: { body: true },
  });

  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    status: task.status,
    points: task.points,
    dueOn: task.dueOn,
    areaId: task.areaId,
    areaName: task.area?.name ?? null,
    areaColour: task.area?.colour ?? null,
    recurrence: task.recurrence,
    recurrenceValue: task.recurrenceValue,
    recurrenceDays: task.recurrenceDays,
    recurrenceUntil: task.recurrenceUntil,
    routineStartMinute: task.routineStartMinute,
    routineMinutes: task.routineMinutes,
    block: task.events[0] ?? null,
    fromNote: note?.body ?? null,
    tags: task.tags,
  };
}

/** Partial edits from the detail panel. Never touches userId or points. */
export async function updateTaskFields(
  userId: string,
  taskId: string,
  data: {
    title?: string;
    notes?: string | null;
    areaId?: string | null;
    points?: number;
    dueOn?: Date | null;
    recurrence?: Recurrence;
    recurrenceValue?: number | null;
    recurrenceDays?: number[];
    recurrenceUntil?: Date | null;
    routineStartMinute?: number | null;
    routineMinutes?: number | null;
  },
): Promise<boolean> {
  const { count } = await db.task.updateMany({
    where: { id: taskId, userId },
    data,
  });
  return count > 0;
}

/**
 * Scheduling a repeating task sets the routine's own time.
 *
 * This is what makes a recurring event behave the way a calendar has
 * taught everyone to expect: put it at 14:00 on Tuesday and it is at
 * 14:00 on every Tuesday, not only that one.
 *
 * Two concepts used to do this job — a block, which is one occurrence,
 * and a routine time, which drives the rest — and you had to know about
 * both for a repeat to show up. Now the first sets the second, so the
 * obvious action produces the obvious result.
 *
 * Instances are deliberately excluded. Moving one Tuesday's session
 * should move that Tuesday, not silently reschedule the whole series;
 * that is what editing the routine itself is for.
 */
export async function syncRoutineTimeFromBlock(
  userId: string,
  taskId: string,
  startMinute: number,
  minutes: number,
): Promise<boolean> {
  const { count } = await db.task.updateMany({
    where: {
      id: taskId,
      userId,
      recurrence: { not: "none" },
      recurrenceParentId: null,
    },
    data: { routineStartMinute: startMinute, routineMinutes: minutes },
  });
  return count > 0;
}
