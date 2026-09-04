import { db } from "@/lib/db";
import { normaliseCapture } from "@/lib/capture";

/**
 * The inbox. Every function takes userId as a required argument — that
 * argument is the authorisation boundary, there is nothing behind it.
 */

export async function capture(userId: string, text: string) {
  return db.captureItem.create({
    data: { userId, text: normaliseCapture(text) },
    select: { id: true, text: true, createdAt: true },
  });
}

export async function listUntriaged(userId: string) {
  return db.captureItem.findMany({
    where: { userId, triagedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, createdAt: true },
  });
}

export async function countUntriaged(userId: string): Promise<number> {
  return db.captureItem.count({ where: { userId, triagedAt: null } });
}

/** Recently triaged, so the inbox shows what things became. */
export async function listTriaged(userId: string, take = 20) {
  return db.captureItem.findMany({
    where: { userId, triagedAt: { not: null } },
    orderBy: { triagedAt: "desc" },
    take,
    select: { id: true, text: true, triagedAt: true, resultType: true, resultId: true },
  });
}

export async function markTriaged(
  userId: string,
  id: string,
  resultType: string,
  resultId: string,
): Promise<boolean> {
  // updateMany, not update: it takes userId in the filter, so somebody
  // else's id simply matches nothing rather than throwing on a row they
  // were never allowed to touch.
  const { count } = await db.captureItem.updateMany({
    where: { id, userId, triagedAt: null },
    data: { triagedAt: new Date(), resultType, resultId },
  });
  return count === 1;
}

export async function discard(userId: string, id: string): Promise<boolean> {
  const { count } = await db.captureItem.deleteMany({ where: { id, userId } });
  return count === 1;
}
