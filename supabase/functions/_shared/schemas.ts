import { z } from "npm:zod@3.24.2";

export const accountSummarySchema = z.object({
  consent_version: z.string().nullable(),
  consented_at: z.string().nullable(),
  age_confirmed_at: z.string().nullable(),
  receipt_count: z.number().int().nonnegative(),
  lifetime_credits: z.number().int().nonnegative(),
  earned_ad_free_until: z.string().nullable(),
});

export type AccountSummary = z.infer<typeof accountSummarySchema>;

export function buildAccountSummary(input: {
  consent_version?: string | null;
  consented_at?: string | null;
  age_confirmed_at?: string | null;
  receipt_count: number;
  lifetime_credits: number;
  earned_ad_free_until?: string | null;
}): AccountSummary {
  return accountSummarySchema.parse({
    consent_version: input.consent_version ?? null,
    consented_at: input.consented_at ?? null,
    age_confirmed_at: input.age_confirmed_at ?? null,
    receipt_count: input.receipt_count,
    lifetime_credits: input.lifetime_credits,
    earned_ad_free_until: input.earned_ad_free_until ?? null,
  });
}

export const contributionSubmitSchema = z.object({
  assignment_id: z.string().uuid(),
  action: z.enum(["looks_correct", "edit", "skip", "report_task"]),
  response_text: z.string().max(2000).optional(),
  idempotency_key: z.string().min(8).max(120),
});

export const translationReportSchema = z.object({
  source_text: z.string().min(1).max(4000),
  model_output: z.string().max(4000).default(""),
  correction_text: z.string().max(4000).nullable().optional(),
  direction: z.enum(["en-ne", "ne-en"]),
  formality: z.enum(["formal", "informal"]),
  script: z.enum(["deva", "roman"]),
  surface: z.enum(["live_translate", "history", "legacy-v1"]),
  idempotency_key: z.string().min(8).max(120),
  consent_version: z.string().min(4).max(80),
  metadata: z.record(z.unknown()).optional(),
});

export const translationReportBatchSchema = z.object({
  items: z.array(translationReportSchema).min(1).max(20),
});
