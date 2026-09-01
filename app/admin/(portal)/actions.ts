"use server";

import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/guard";
import { clear } from "@/lib/admin/stepup";
import { record } from "@/lib/admin/audit";

/** Ends the admin window. The ordinary sign-in is untouched. */
export async function lockPortal(): Promise<void> {
  const actor = await currentAdmin();
  await clear();
  if (actor) {
    await record({
      actor,
      action: "admin.locked",
      target: actor.email,
      reason: "Locked the portal",
    });
  }
  redirect("/app");
}
