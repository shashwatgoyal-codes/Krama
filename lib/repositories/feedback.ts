import { db } from "@/lib/db";
import type { FeedbackKind, FeedbackMine } from "@/lib/feedback";

/**
 * What people tell whoever runs Krama, and what comes back.
 *
 * Everything else a person writes is private from the admin screens by a
 * database grant rather than by the UI hiding it. Feedback is the
 * deliberate exception: it was addressed to an administrator, and a
 * message nobody may read is not feedback. The grant in docs/ADMIN.md
 * covers this table alone.
 */

export type FeedbackInput = {
  userId: string;
  kind: FeedbackKind;
  message: string;
  fromPath?: string | null;
};

export async function sendFeedback(input: FeedbackInput): Promise<string> {
  const row = await db.feedback.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      message: input.message.trim(),
      // Only ever a path from our own routes, never a full URL — there is
      // nothing useful in the host and something leaky in the query string.
      fromPath: normalisePath(input.fromPath),
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * A path we are willing to store.
 *
 * Anything that isn't a plain in-app path is dropped rather than cleaned
 * up: a value that arrived in an unexpected shape is a value we don't
 * understand, and guessing at it is how a query string full of somebody's
 * search terms ends up in an admin table.
 */
export function normalisePath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const path = value.split(/[?#]/)[0];
  if (path.length > 120) return null;
  return /^[a-zA-Z0-9/_-]+$/.test(path) ? path : null;
}

/** Someone's own messages, newest first, with any reply. */
export async function listMyFeedback(userId: string): Promise<FeedbackMine[]> {
  return db.feedback.findMany({
    where: { userId },
    select: {
      id: true,
      kind: true,
      message: true,
      status: true,
      reply: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

/** Withdraw one of your own, while nobody has acted on it yet. */
export async function withdrawFeedback(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await db.feedback.deleteMany({
    // Once it has been read, taking it back would rewrite what an admin
    // already saw. The reply stays too, for the same reason.
    where: { id, userId, status: "new" },
  });
  return result.count === 1;
}

export type {
  FeedbackKind,
  FeedbackStatus,
  FeedbackMine,
} from "@/lib/feedback";
