"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import {
  createArea,
  renameArea,
  deleteArea,
  reorderAreas,
  listAreas,
} from "@/lib/repositories/areas";
import { AREA_COLOURS } from "@/lib/areas";
import { firstIssue, type ActionResult } from "@/lib/validation";

/**
 * Areas are the one piece of structure the rest of the app leans on:
 * the grouping on Tasks, the chips in the detail panel, and the
 * "Office · deep block" line on Today all read from here.
 */

function touched() {
  revalidatePath("/app/profile");
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

const colourSchema = z.enum(AREA_COLOURS);

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the area a name.")
  .max(40, "Keep the name under 40 characters.");

/** Postgres enforces this too; catching it here gives a human message. */
const DUPLICATE = "You already have an area with that name.";

export async function addArea(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = z
    .object({ name: nameSchema, colour: colourSchema })
    .safeParse({
      name: formData.get("name"),
      colour: formData.get("colour") ?? "acc",
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const existing = await listAreas(user.id);
  if (existing.length >= 12) {
    return {
      ok: false,
      error: "Twelve areas is plenty — more and the grouping stops helping.",
    };
  }
  if (
    existing.some(
      (a) => a.name.toLowerCase() === parsed.data.name.toLowerCase(),
    )
  ) {
    return { ok: false, error: DUPLICATE, field: "name" };
  }

  await createArea(user.id, parsed.data.name, parsed.data.colour);
  touched();
  return { ok: true };
}

export async function editArea(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = z
    .object({
      id: z.string().cuid(),
      name: nameSchema,
      colour: colourSchema,
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      colour: formData.get("colour") ?? "acc",
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const existing = await listAreas(user.id);
  if (
    existing.some(
      (a) =>
        a.id !== parsed.data.id &&
        a.name.toLowerCase() === parsed.data.name.toLowerCase(),
    )
  ) {
    return { ok: false, error: DUPLICATE, field: "name" };
  }

  const updated = await renameArea(user.id, parsed.data.id, {
    name: parsed.data.name,
    colour: parsed.data.colour,
  });
  if (!updated) return { ok: false, error: "That area no longer exists." };

  touched();
  return { ok: true };
}

export async function removeArea(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = z
    .object({ id: z.string().cuid() })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown area." };

  // The tasks survive — the schema nulls their areaId rather than
  // cascading. Deleting a category must never delete the work in it.
  const removed = await deleteArea(user.id, parsed.data.id);
  if (!removed) return { ok: false, error: "That area no longer exists." };

  touched();
  return { ok: true };
}

export async function moveArea(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = z
    .object({
      id: z.string().cuid(),
      direction: z.enum(["up", "down"]),
    })
    .safeParse({
      id: formData.get("id"),
      direction: formData.get("direction"),
    });
  if (!parsed.success) return { ok: false, error: "Couldn't move that." };

  const areas = await listAreas(user.id);
  const index = areas.findIndex((a) => a.id === parsed.data.id);
  if (index === -1) return { ok: false, error: "That area no longer exists." };

  const target = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= areas.length) return { ok: true }; // already at the end

  const reordered = [...areas];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  await reorderAreas(
    user.id,
    reordered.map((a) => a.id),
  );
  touched();
  return { ok: true };
}
