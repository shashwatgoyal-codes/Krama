import { db } from "@/lib/db";
import type { AdminActor } from "./guard";

/**
 * Recording what an administrator did.
 *
 * Writes go through the application's connection rather than the
 * restricted one, because the restricted role has no INSERT anywhere —
 * it exists to read metadata and nothing else. The table itself rejects
 * UPDATE and DELETE by trigger, so this is append-only regardless of
 * which connection reaches it.
 *
 * Refusals and expiries are recorded too. A log containing only the
 * actions that succeeded cannot answer the question people actually ask
 * of an audit trail, which is what was attempted.
 */

export type AuditEntry = {
  actor: AdminActor;
  action: string;
  target?: string | null;
  /** Required. The database rejects anything under three characters. */
  reason: string;
};

export async function record({
  actor,
  action,
  target = null,
  reason,
}: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorEmail: actor.email,
      actorLevel: actor.level,
      action,
      target,
      reason: reason.trim(),
    },
  });
}

/**
 * Record, then rethrow. For the refusal paths — the ones where it is
 * tempting to return early and leave nothing behind.
 */
export async function recordRefusal(
  entry: AuditEntry & { action: string },
): Promise<void> {
  await record({ ...entry, action: `${entry.action}.refused` });
}
