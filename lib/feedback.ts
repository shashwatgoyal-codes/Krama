/**
 * The client-safe half of feedback: labels, limits, and the shape of a
 * message as the screen sees it.
 *
 * Kept apart from the repository deliberately. A "use client" component
 * that reaches into lib/repositories drags Prisma, pg, and their node
 * built-ins into the browser bundle, and the build fails on `dns` with a
 * stack that names none of that. Nothing here imports the database.
 */

export type FeedbackKind = "idea" | "problem" | "praise" | "other";
export type FeedbackStatus = "new" | "read" | "done";

export type FeedbackMine = {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: FeedbackStatus;
  reply: string | null;
  createdAt: Date;
};

export const FEEDBACK_KINDS: FeedbackKind[] = [
  "idea",
  "problem",
  "praise",
  "other",
];

export const KIND_LABEL: Record<FeedbackKind, string> = {
  idea: "An idea",
  problem: "Something is broken",
  praise: "Something I like",
  other: "Something else",
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Waiting",
  read: "Seen",
  done: "Answered",
};

/** The longest message we will store, and the shortest worth sending. */
export const MAX_MESSAGE = 2000;
export const MIN_MESSAGE = 4;
