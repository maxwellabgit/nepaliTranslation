/** Explicit credit milestones for the compact gauge. */
export const CREDIT_THRESHOLDS = [10, 30, 60, 120, 240] as const;

export type CreditProgress = {
  credits: number;
  nextThreshold: number | null;
  /** 0–100 toward the next threshold (100 if past the last). */
  percent: number;
  accessibilityLabel: string;
};

export type AdFreeBalance = {
  /** Usable balance: remaining ad-free time, not a credit wallet. */
  remainingLabel: string;
  /** Lifetime total, never presented as spendable credits. */
  totalEarnedLabel: string;
  accessibilityLabel: string;
};

export function adFreeBalance(input: {
  earnedUntilMs: number | null;
  nowMs: number;
  lifetimeCredits: number;
}): AdFreeBalance {
  const total = Math.max(0, Math.floor(input.lifetimeCredits));
  const totalEarnedLabel = `Total earned: ${total}`;
  const until = input.earnedUntilMs;
  if (until == null || !Number.isFinite(until) || until <= input.nowMs) {
    const remainingLabel = 'No ad-free time';
    return {
      remainingLabel,
      totalEarnedLabel,
      accessibilityLabel: `${remainingLabel}. ${totalEarnedLabel}.`,
    };
  }
  const minutes = Math.max(1, Math.ceil((until - input.nowMs) / 60_000));
  const remainingLabel = `${minutes} min ad-free left`;
  return {
    remainingLabel,
    totalEarnedLabel,
    accessibilityLabel: `${remainingLabel}. ${totalEarnedLabel}.`,
  };
}

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
