import { db } from "@/lib/db";
import { isOn, isOnGlobally, clampRollout, type Flag } from "@/lib/flags";

/**
 * Reading and changing flags.
 *
 * Rows are created by migration, never here — which switches exist is a
 * fact about the codebase, and only their values are an operational
 * decision. So there is a setter and no creator.
 */

export async function allFlags() {
  return db.featureFlag.findMany({
    orderBy: { key: "asc" },
    select: { key: true, description: true, enabled: true, rollout: true, updatedAt: true, updatedBy: true },
  });
}

async function get(key: string): Promise<Flag | null> {
  const row = await db.featureFlag.findUnique({
    where: { key },
    select: { key: true, enabled: true, rollout: true },
  });
  return row ?? null;
}

/** Is this on for this person? */
export async function flagOn(key: string, userId: string): Promise<boolean> {
  return isOn(await get(key), userId);
}

/** Is this on for everyone? For gates with nobody signed in yet. */
export async function flagOnGlobally(key: string): Promise<boolean> {
  return isOnGlobally(await get(key));
}

export async function setFlag(
  key: string,
  changes: { enabled?: boolean; rollout?: number },
  by: string,
): Promise<boolean> {
  const { count } = await db.featureFlag.updateMany({
    where: { key },
    data: {
      ...(changes.enabled === undefined ? {} : { enabled: changes.enabled }),
      ...(changes.rollout === undefined ? {} : { rollout: clampRollout(changes.rollout) }),
      updatedBy: by,
    },
  });
  // updateMany, so an unknown key changes nothing rather than creating
  // a flag nothing in the code ever reads.
  return count === 1;
}
