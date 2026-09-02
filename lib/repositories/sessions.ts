import { db } from "@/lib/db";
import { describeDevice, lastSeenLabel } from "@/lib/devices";

export type DeviceRow = {
  id: string;
  label: string;
  signedInAt: Date;
  lastSeen: string;
  current: boolean;
};

/**
 * The devices somebody is signed in on.
 *
 * Takes the current session's id so the row you are reading this from
 * can be marked — without it, "sign out" on the wrong line signs you out
 * of the thing you are using, which is the one mistake this screen has
 * to make impossible.
 */
export async function listDevices(
  userId: string,
  currentSessionId: string | null,
  now = new Date(),
): Promise<DeviceRow[]> {
  const rows = await db.session.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });

  return rows.map((r) => ({
    id: r.id,
    label: describeDevice(r.userAgent).label,
    signedInAt: r.createdAt,
    lastSeen: lastSeenLabel(r.lastSeenAt, now),
    current: r.id === currentSessionId,
  }));
}

/**
 * End one session.
 *
 * userId is in the filter, so another account's session id matches
 * nothing rather than being deleted. Refuses the current one: ending it
 * from here would look like the app breaking rather than signing out.
 */
export async function endDevice(
  userId: string,
  sessionId: string,
  currentSessionId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (sessionId === currentSessionId) {
    return { ok: false, error: "That is this device. Use Sign out instead." };
  }
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId } });
  return count === 1 ? { ok: true } : { ok: false, error: "That device is already signed out." };
}

/** Everything except the one you are on. */
export async function endOtherDevices(
  userId: string,
  currentSessionId: string | null,
): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
  });
  return count;
}
