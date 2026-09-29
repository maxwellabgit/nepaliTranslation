/**
 * Home gauge math. Fifty credits of remaining ad-free time is the visual
 * full mark only. Earning is not capped there, and the mark is not printed.
 */
import { GAUGE_CREDIT_MARK } from '../features/contribution/reviewCredits';

export {
  GAUGE_CREDIT_MARK as CREDIT_CAP,
  formatAdFreeClock,
  gaugePresentation,
  stackAdFreeMinutes,
} from '../features/contribution/reviewCredits';

export type AdFreeBalance = {
  remainingLabel: string;
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
    return {
      remainingLabel: '',
      totalEarnedLabel,
      accessibilityLabel: `${totalEarnedLabel}.`,
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

export type CreditProgress = {
  credits: number;
  fillPercent: number;
  overMark: boolean;
  /** Kept so older callers can see the visual mark. Never rendered. */
  visualMark: number;
};

/** Remaining-time credits. Does not clamp the returned credit count to 50. */
export function creditProgress(creditUnits: number): CreditProgress {
  const credits = Math.max(0, creditUnits);
  const fillPercent = Math.min(
    100,
    (Math.min(credits, GAUGE_CREDIT_MARK) / GAUGE_CREDIT_MARK) * 100,
  );
  return {
    credits,
    fillPercent,
    overMark: credits > GAUGE_CREDIT_MARK,
    visualMark: GAUGE_CREDIT_MARK,
  };
}
