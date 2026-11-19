import { z } from "zod";

export const ACTION_KINDS = ["good", "bad"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const SUGGESTED_CATEGORIES = [
  "Fitness",
  "Nutrition",
  "Finance",
  "Study",
  "Reading",
  "Sleep",
  "Habits",
  "Other",
] as const;

export const MAX_POINTS = 1000;

const trimmed = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

/** Input for creating or editing a good/bad action. */
export const actionInputSchema = z
  .object({
    name: trimmed("Name", 40),
    kind: z.enum(ACTION_KINDS, { error: "Choose good or bad" }),
    points: z.coerce
      .number({ error: "Points must be a number" })
      .int("Points must be a whole number")
      .min(1, "Points must be at least 1")
      .max(MAX_POINTS, `Points must be ${MAX_POINTS} or fewer`),
    icon: trimmed("Icon", 16),
    category: trimmed("Category", 30),
    /** Optional: times per week (1–7). Empty = no target. */
    weeklyTarget: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.coerce
        .number({ error: "Weekly goal must be a number" })
        .int("Weekly goal must be a whole number")
        .min(1, "Weekly goal must be 1–7")
        .max(7, "Weekly goal must be 1–7")
        .nullable(),
    ).optional(),
  })
  .strict();
/** What callers may pass (weeklyTarget optional); the service parses it. */
export type ActionInput = z.input<typeof actionInputSchema>;

export const idSchema = z.string().trim().min(1).max(64);
export const idempotencyKeySchema = z.uuid();

export const logInputSchema = z.object({ actionId: idSchema, idempotencyKey: idempotencyKeySchema }).strict();
export const undoInputSchema = z.object({ entryId: idSchema, idempotencyKey: idempotencyKeySchema }).strict();

export const MAX_NOTE = 140;
/** Empty note clears it. */
export const noteInputSchema = z
  .object({
    entryId: idSchema,
    note: z
      .string()
      .trim()
      .max(MAX_NOTE, `Notes must be ${MAX_NOTE} characters or fewer`)
      .transform((s) => (s.length ? s : null)),
  })
  .strict();
