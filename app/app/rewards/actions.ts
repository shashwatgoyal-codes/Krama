"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import {
  createReward,
  archiveReward,
  redeemReward,
} from "@/lib/repositories/rewards";
import {
  REWARD_NAME_MAX,
  REWARD_COST_MAX,
  REWARD_COST_MIN,
} from "@/lib/rewards";
import { firstIssue, type ActionResult } from "@/lib/validation";

const newRewardSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the reward a name.")
    .max(REWARD_NAME_MAX, "Keep the name short enough to read at a glance."),
  cost: z.coerce
    .number()
    .int("Points come in whole numbers.")
    .min(REWARD_COST_MIN, "It has to cost something.")
    .max(REWARD_COST_MAX, "That is more than a year of good days."),
  notes: z.string().trim().max(200).optional(),
});

export async function addReward(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = newRewardSchema.safeParse({
    name: formData.get("name"),
    cost: formData.get("cost"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await createReward(user.id, parsed.data);
  revalidatePath("/app/rewards");
  return { ok: true };
}

export async function removeReward(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid() })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown reward." };

  const archived = await archiveReward(user.id, parsed.data.id);
  if (!archived) return { ok: false, error: "That reward is already gone." };

  revalidatePath("/app/rewards");
  return { ok: true };
}

export async function claimReward(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid() })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown reward." };

  const result = await redeemReward(user.id, parsed.data.id);
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.reason === "missing"
          ? "That reward no longer exists."
          : "Not enough points for that yet.",
    };
  }

  revalidatePath("/app/rewards");
  revalidatePath("/app");
  return { ok: true };
}
