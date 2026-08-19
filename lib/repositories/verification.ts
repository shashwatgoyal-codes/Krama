import { db } from "@/lib/db";
import {
  generateCode,
  hashCode,
  codesMatch,
  codeExpiry,
  isWellFormed,
  MAX_CODE_ATTEMPTS,
  type CodePurpose,
} from "@/lib/otp/code";

/** How soon another code can be requested for the same purpose. */
export const RESEND_COOLDOWN_MS = 60_000;

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: "cooldown"; retryAfterMs: number };

/**
 * Issues a code and returns it in the clear — the only time it exists
 * outside an image. The caller renders it and forgets it; nothing writes
 * it to the database, a log, or an error message.
 *
 * Any earlier code for the same purpose is consumed first. Two live
 * codes would mean an older one still works after the user has asked for
 * a replacement, which is exactly the window someone would want.
 */
export async function issueCode(
  userId: string,
  purpose: CodePurpose,
): Promise<IssueResult> {
  const latest = await db.verificationCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (latest) {
    const since = Date.now() - latest.createdAt.getTime();
    if (since < RESEND_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown", retryAfterMs: RESEND_COOLDOWN_MS - since };
    }
  }

  const code = generateCode();

  await db.$transaction([
    db.verificationCode.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.verificationCode.create({
      data: {
        userId,
        purpose,
        codeHash: hashCode(code, userId, purpose),
        expiresAt: codeExpiry(),
      },
    }),
  ]);

  return { ok: true, code };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "malformed" | "none" | "expired" | "wrong" | "locked" };

/**
 * Checks a code and, on success, burns it.
 *
 * The attempt counter is stored rather than held in memory so that the
 * ceiling survives a restart — an in-process counter hands an attacker a
 * fresh allowance every deploy.
 */
export async function consumeCode(
  userId: string,
  purpose: CodePurpose,
  code: string,
): Promise<ConsumeResult> {
  if (!isWellFormed(code)) return { ok: false, reason: "malformed" };

  const record = await db.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "none" };

  if (record.expiresAt.getTime() <= Date.now()) {
    await db.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await db.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "locked" };
  }

  if (!codesMatch(record.codeHash, hashCode(code, userId, purpose))) {
    const updated = await db.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    // Burn it on the last miss rather than leaving a spent code lying
    // around for the next request to find.
    if (updated.attempts >= MAX_CODE_ATTEMPTS) {
      await db.verificationCode.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "wrong" };
  }

  await db.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}

/** Housekeeping — expired and spent codes have no reason to be kept. */
export async function purgeStaleCodes(): Promise<number> {
  const { count } = await db.verificationCode.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { consumedAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
      ],
    },
  });
  return count;
}
