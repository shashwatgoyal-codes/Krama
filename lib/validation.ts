import { z } from "zod";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./auth/password";

/**
 * Every server action validates its input through one of these before
 * touching the database. Zod strips unknown keys, so a crafted form post
 * can't smuggle in fields the action didn't ask for.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter your email address.")
  .max(254, "That email address is too long.")
  .email("That doesn't look like an email address.");

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(MAX_PASSWORD_LENGTH, `Keep it under ${MAX_PASSWORD_LENGTH} characters.`);

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "What should we call you?")
    .max(80, "That name is a bit long."),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  // Not the full password rules — an old account may predate them, and
  // rejecting a valid password on the sign-in form would be maddening.
  password: z.string().min(1, "Enter your password."),
});

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the task a name.")
    .max(200, "Keep the title under 200 characters."),
  notes: z.string().trim().max(2000).optional(),
  areaId: z.string().cuid().optional(),
  points: z.number().int().min(1).max(30).optional(),
  dueOn: z.coerce.date().optional(),
  recurrence: z
    .enum(["none", "daily", "weekdays", "weekly", "monthly"])
    .default("none"),
  recurrenceValue: z.number().int().min(0).max(31).optional(),
});

export const taskIdSchema = z.object({ id: z.string().cuid() });

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Shape every server action returns, so forms can render errors uniformly. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; field?: string };

/** Turns a Zod failure into the first message a person should see. */
export function firstIssue(error: z.ZodError): {
  error: string;
  field?: string;
} {
  const issue = error.issues[0];
  return {
    error: issue?.message ?? "That didn't look right.",
    field: issue?.path[0]?.toString(),
  };
}
