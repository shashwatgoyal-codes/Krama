import { z } from "zod";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "./auth/password";
import { BLOCK_MINUTES } from "./time";
import { ACCENT_VALUES, DENSITIES } from "./appearance";
import { isHexTint } from "./tint-colour";
import { TINT_PRESETS } from "./notes";

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
  .max(254, "That email is too long.")
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
    .max(200, "That title is too long. Keep it under 200 letters."),
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

/** Spaces and dashes are forgiven — people copy codes untidily. */
const otpSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .length(6, "The code is six digits.")
      .regex(/^\d+$/, "The code is six digits."),
  );

export const requestResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ code: otpSchema });

export const scheduleAtSchema = z.object({
  id: z.string().cuid(),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  hour: z.coerce.number().int().min(0).max(23),
  minute: z.coerce.number().int().min(0).max(59),
  durationMinutes: z.coerce
    .number()
    .int()
    .refine(
      (m) => (BLOCK_MINUTES as readonly number[]).includes(m),
      "Pick one of the choices shown.",
    ),
});

/** Rejects anything the platform doesn't recognise as an IANA zone. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "What should we call you?")
    .max(80, "That name is a bit long."),
});

const restDaysSchema = z
  .array(z.coerce.number().int().min(0).max(6))
  .max(6, "Pick at least one day.")
  // A duplicate day in the form post shouldn't become a duplicate row.
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

/** The Profile tab: who you are and the time settings everything derives from. */
export const profileTabSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "What should we call you?")
    .max(80, "That name is a bit long."),
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, "We don't know that time zone."),
  // Capped at noon: a "day" that ends in the evening isn't a late night,
  // it's a different day, and allowing it would quietly corrupt every
  // date the scoring engine derives.
  dayEndsAtHour: z.coerce.number().int().min(0).max(12),
  weekStartsOn: z.coerce
    .number()
    .int()
    .refine((d) => d === 0 || d === 1),
  timeFormat: z.enum(["12", "24"]),
});

export const dayScheduleSchema = z.object({
  timezone: z
    .string()
    .trim()
    .refine(isValidTimeZone, "We don't know that time zone."),
  restDays: restDaysSchema,
  // Capped at noon: a "day" that ends in the evening isn't a late night,
  // it's a different day, and allowing it would quietly corrupt every
  // date the scoring engine derives.
  dayEndsAtHour: z.coerce
    .number()
    .int()
    .min(0, "Pick an hour between 12am and 12pm.")
    .max(12, "Pick an hour between 12am and 12pm."),
});

/** "HH:MM" in the user's own zone, or empty for no nudge. */
const reminderSchema = z
  .string()
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .refine(
    (v) => v === null || /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
    "Use a time like 08:30.",
  );

/** The Rhythm tab: when the app expects you, and when it leaves you alone. */
export const rhythmSchema = z.object({
  dailyFloor: z.coerce
    .number()
    .int()
    .min(1, "Pick at least 1 thing a day.")
    .max(20, "Pick 20 or fewer things a day."),
  dailyTargetPoints: z.coerce
    .number()
    .int()
    .min(1, "This has to be at least 1 point.")
    .max(500, "Set this to 500 or less."),
  restDays: restDaysSchema,
  morningReminder: reminderSchema,
  eveningReminder: reminderSchema,
  // Zero means "today only". Thirty is already generous enough that a
  // streak stops meaning much beyond it.
  backdateLimitDays: z.coerce.number().int().min(0).max(30),
  rolloverUnfinished: z.coerce.boolean(),
  catchUpRoutines: z.coerce.boolean(),
});

/** The Appearance tab. */
export const appearanceSchema = z.object({
  accent: z.enum(ACCENT_VALUES),
  interfaceFont: z.enum(["krama", "system"]),
  // Exactly five. A short list would leave a note colour undefined; a
  // long one would silently ignore the extras.
  //
  // Each slot is either a named preset or a hand-picked colour. The hex
  // is validated rather than trusted: it lands in a stylesheet, so
  // anything that is not six hex digits has no business reaching it.
  noteTints: z
    .array(z.string())
    .length(5)
    .refine(
      (t) =>
        t.every((v) => TINT_PRESETS.some((p) => p.value === v) || isHexTint(v)),
      "That isn't a colour we can use.",
    ),
  density: z.enum(DENSITIES),
  reduceMotion: z.coerce.boolean(),
  showPointsOnTasks: z.coerce.boolean(),
});

export const scoringSchema = z.object({
  dailyFloor: z.coerce
    .number()
    .int()
    .min(1, "Pick at least 1 thing a day.")
    .max(20, "Pick 20 or fewer things a day."),
  dailyTargetPoints: z.coerce
    .number()
    .int()
    .min(1, "This has to be at least 1 point.")
    .max(500, "Set this to 500 or less."),
  dailyCap: z.coerce
    .number()
    .int()
    .min(20, "Set this to 20 or more.")
    .max(1000, "Keep the cap under 1000."),
  scoringVisibility: z.enum(["hidden", "normal", "everywhere"]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Type your password."),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Type your password to make sure it's you."),
  confirm: z.literal("DELETE", {
    error: "Type DELETE to make sure.",
  }),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/** Shape every server action returns, so forms can render errors uniformly. */
export type ActionResult<T = undefined> =
  { ok: true; data?: T } | { ok: false; error: string; field?: string };

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

/**
 * A message to whoever runs Krama.
 *
 * The floor is four characters because "hi" is not a report and the
 * person deserves to be told so at the form rather than after a round
 * trip. The ceiling is generous: someone describing a bug properly should
 * never be cut off mid-sentence.
 */
export const feedbackSchema = z.object({
  kind: z.enum(["idea", "problem", "praise", "other"]),
  message: z
    .string()
    .trim()
    .min(4, "Please write a little more so we can act on it.")
    .max(2000, "That is longer than we can store. Please shorten it."),
  fromPath: z.string().optional(),
});

export const feedbackIdSchema = z.object({ id: z.string().cuid() });
