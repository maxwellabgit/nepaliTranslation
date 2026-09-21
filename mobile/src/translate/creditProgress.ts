/** Explicit credit milestones for the compact gauge. */
export const CREDIT_THRESHOLDS = [10, 30, 60, 120, 240] as const;

export type CreditProgress = {
  credits: number;
  nextThreshold: number | null;
  /** 0–100 toward the next threshold (100 if past the last). */
  percent: number;
  accessibilityLabel: string;
};

export function creditProgress(credits: number): CreditProgress {
  const safe = Math.max(0, Math.floor(credits));
  const next = CREDIT_THRESHOLDS.find((t) => t > safe) ?? null;
  if (next == null) {
    return {
      credits: safe,
      nextThreshold: null,
      percent: 100,
      accessibilityLabel: `${safe} credits. All reward thresholds reached.`,
    };
  }
  const prev = [...CREDIT_THRESHOLDS].reverse().find((t) => t <= safe) ?? 0;
  const span = next - prev;
  const percent = span <= 0 ? 100 : Math.min(100, Math.round(((safe - prev) / span) * 100));
  return {
    credits: safe,
    nextThreshold: next,
    percent: Math.max(4, percent),
    accessibilityLabel: `${safe} credits. ${next - safe} until the next reward at ${next}.`,
  };
}
