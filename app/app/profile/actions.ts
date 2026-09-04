"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import {
  checkPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  createSession,
  destroyAllSessions,
  destroySession,
} from "@/lib/auth/session";
import {
  updateProfileSettings,
  updateName,
  updatePasswordHash,
  getPasswordHash,
  deleteAccount,
  getSettings,
  recountPoints,
  eraseContent,
} from "@/lib/repositories/profile";
import { z } from "zod";
import {
  nameSchema,
  profileTabSchema,
  rhythmSchema,
  appearanceSchema,
  dayScheduleSchema,
  scoringSchema,
  changePasswordSchema,
  deleteAccountSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * Every action here gates first and uses the session's own user id. None
 * of them accept a user id from the form — that is the whole reason a
 * settings page is a tempting target.
 */

export async function saveName(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await updateName(user.id, parsed.data.name);
  revalidatePath("/app/profile");
  return { ok: true };
}

/** The Profile tab. Name lives on the user, the rest on the profile. */
export async function saveProfileTab(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = profileTabSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    dayEndsAtHour: formData.get("dayEndsAtHour"),
    weekStartsOn: formData.get("weekStartsOn"),
    timeFormat: formData.get("timeFormat"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { name, ...profile } = parsed.data;
  await updateName(user.id, name);
  await updateProfileSettings(user.id, profile);

  // The zone and the day boundary decide which day everything falls on,
  // so every view that groups by day is now stale.
  revalidatePath("/app/profile");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/calendar");
  return { ok: true };
}

export async function saveDaySchedule(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = dayScheduleSchema.safeParse({
    timezone: formData.get("timezone"),
    dayEndsAtHour: formData.get("dayEndsAtHour"),
    // Unchecked boxes send nothing, so an empty list is a real answer:
    // "no rest days", not "field missing".
    restDays: formData.getAll("restDays"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await updateProfileSettings(user.id, parsed.data);

  // Changing the time zone changes which day everything falls on, so the
  // task and today views are now stale too.
  revalidatePath("/app/profile");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  return { ok: true };
}

export async function saveScoring(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = scoringSchema.safeParse({
    dailyFloor: formData.get("dailyFloor"),
    dailyTargetPoints: formData.get("dailyTargetPoints"),
    dailyCap: formData.get("dailyCap"),
    scoringVisibility: formData.get("scoringVisibility"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await updateProfileSettings(user.id, parsed.data);
  revalidatePath("/app/profile");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  return { ok: true };
}

/** The Rhythm tab. */
export async function saveRhythm(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = rhythmSchema.safeParse({
    dailyFloor: formData.get("dailyFloor"),
    dailyTargetPoints: formData.get("dailyTargetPoints"),
    // Unchecked boxes send nothing, so an empty list is a real answer:
    // "no rest days", not "field missing".
    restDays: formData.getAll("restDays"),
    morningReminder: formData.get("morningReminder") ?? undefined,
    eveningReminder: formData.get("eveningReminder") ?? undefined,
    backdateLimitDays: formData.get("backdateLimitDays"),
    rolloverUnfinished: formData.get("rolloverUnfinished") === "on",
    catchUpRoutines: formData.get("catchUpRoutines") === "on",
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await updateProfileSettings(user.id, parsed.data);
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

/** The Appearance tab. */
export async function saveAppearance(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = appearanceSchema.safeParse({
    accent: formData.get("accent"),
    interfaceFont: formData.get("interfaceFont"),
    noteTints: formData.getAll("noteTints"),
    density: formData.get("density"),
    reduceMotion: formData.get("reduceMotion") === "on",
    showPointsOnTasks: formData.get("showPointsOnTasks") === "on",
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { showPointsOnTasks, ...rest } = parsed.data;
  // "Show points on tasks" is the same decision as the Scoring tab's
  // visibility, phrased for this page. Giving it its own column would
  // mean two settings that can disagree about the same thing.
  const current = await getSettings(user.id);
  const scoringVisibility =
    current.scoringVisibility === "hidden"
      ? "hidden"
      : showPointsOnTasks
        ? "everywhere"
        : "normal";

  await updateProfileSettings(user.id, { ...rest, scoringVisibility });
  revalidatePath("/app/profile");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  return { ok: true };
}

/** The Data tab: reconcile the cached score against the ledger. */
export async function recountScore(): Promise<ActionResult<string>> {
  const user = await requireUserOrThrow();
  const total = await recountPoints(user.id);
  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true, data: `Recounted from your history: ${total} points.` };
}

/** The Data tab: erase everything made, keep the account. */
export async function eraseAllContent(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ confirm: z.literal("delete", { error: "Type delete to confirm." }) })
    .safeParse({ confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await eraseContent(user.id);
  revalidatePath("/app/profile");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/notes");
  revalidatePath("/app/calendar");
  revalidatePath("/app/explore");
  return { ok: true };
}

export async function changePassword(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const stored = await getPasswordHash(user.id);
  if (!stored) return { ok: false, error: "Something went wrong. Please sign in again." };

  const correct = await verifyPassword(stored, parsed.data.currentPassword);
  if (!correct) {
    return {
      ok: false,
      field: "currentPassword",
      error: "That password is wrong.",
    };
  }

  const strong = checkPassword(parsed.data.newPassword);
  if (!strong.ok) {
    return { ok: false, field: "newPassword", error: strong.reason };
  }

  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return {
      ok: false,
      field: "newPassword",
      error: "That's the same password you have now. Pick a different one.",
    };
  }

  await updatePasswordHash(user.id, await hashPassword(parsed.data.newPassword));
  await updateProfileSettings(user.id, { passwordChangedAt: new Date() });

  // A password change should end every session, otherwise changing it
  // after a device is stolen achieves nothing. This one is then reissued
  // so the person doing the changing isn't logged out of their own
  // browser as a reward for good security hygiene.
  await destroyAllSessions(user.id);
  const agent = (await headers()).get("user-agent") ?? undefined;
  await createSession(user.id, agent);

  revalidatePath("/app/profile");
  return { ok: true };
}

export async function signOutEverywhere(): Promise<void> {
  const user = await requireUserOrThrow();
  await destroyAllSessions(user.id);
  await destroySession();
  redirect("/login");
}

export async function deleteAccountAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = deleteAccountSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  // Two independent proofs of intent: the password rules out someone
  // else at your keyboard, the typed word rules out a misclick.
  const stored = await getPasswordHash(user.id);
  if (!stored || !(await verifyPassword(stored, parsed.data.password))) {
    return { ok: false, field: "password", error: "That password isn't right." };
  }

  await deleteAccount(user.id);
  // The rows are gone; clear the cookie so the browser stops presenting
  // a token that no longer resolves to anything.
  await destroySession();
  redirect("/?deleted=1");
}
