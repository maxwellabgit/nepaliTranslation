/**
 * Review reward rule. Must match scripts/sourceWordCount.mjs and
 * private.scheduled_credits_for_words.
 *
 * Snapshotted original source words:
 * - 4 or fewer: 1 credit
 * - 5 or 6: 2 credits
 * - 7 or more: 3 credits
 *
 * One credit is 10 ad-free minutes. Empty text schedules nothing and is
 * rejected before a window is planned. The Home gauge treats 50 credits of
 * remaining ad-free time as a visual full mark. That mark is not an earning
 * cap and is not printed. When the inner bar is full, that fill turns red.
 * The pill and the clock stay the same size and color. The timer itself
 * hard-stops at 12 hours.
 */

export const MINUTES_PER_CREDIT = 10;
export const GAUGE_CREDIT_MARK = 50;
export const TIMER_HARD_CAP_MINUTES = 12 * 60;

export function countSourceWords(text: string): number {
  if (typeof text !== 'string') return 0;
  const parts = text.trim().split(/\s+/u).filter((word) => word.length > 0);
  return parts.length;
}

export function scheduledCreditsForWords(wordCount: number): 0 | 1 | 2 | 3 {
  if (wordCount == null || wordCount <= 0) return 0;
  if (wordCount <= 4) return 1;
  if (wordCount <= 6) return 2;
  return 3;
}

export function minutesForCredits(credits: number): number {
  return Math.max(0, credits) * MINUTES_PER_CREDIT;
}

/** Stack new minutes on time still left. Never past 12 hours. */
export function stackAdFreeMinutes(
  remainingMinutes: number,
  addedMinutes: number,
): { remainingMinutes: number; appliedMinutes: number; capped: boolean } {
  const remaining = Math.max(0, remainingMinutes);
  const added = Math.max(0, addedMinutes);
  const room = Math.max(0, TIMER_HARD_CAP_MINUTES - remaining);
  const applied = Math.min(room, added);
  return {
    remainingMinutes: remaining + applied,
    appliedMinutes: applied,
    capped: applied + 1e-9 < added,
  };
}

/** Under one hour the clock is m:ss, starting at 0:00. At one hour it becomes h:mm:ss. */
export function formatAdFreeClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours < 1) return `${minutes}:${String(seconds).padStart(2, '0')}`;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export type GaugePresentation = {
  /** Remaining ad-free time expressed as credits (10 minutes each). */
  creditUnits: number;
  fillPercent: number;
  /** True when remaining time is worth more than the visual 50-credit mark. */
  overMark: boolean;
  /** True when the inner bar has reached the visual full mark. */
  fillFull: boolean;
  clock: string;
  scale: number;
};

export function gaugePresentation(remainingMs: number): GaugePresentation {
  const ms = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const creditUnits = ms / 60_000 / MINUTES_PER_CREDIT;
  const fillPercent = Math.min(
    100,
    (Math.min(creditUnits, GAUGE_CREDIT_MARK) / GAUGE_CREDIT_MARK) * 100,
  );
  const overMark = creditUnits > GAUGE_CREDIT_MARK;
  return {
    creditUnits,
    fillPercent,
    overMark,
    fillFull: fillPercent >= 100,
    clock: formatAdFreeClock(ms / 1000),
    scale: 1,
  };
}

export function remainingMsUntil(untilMs: number | null, nowMs: number): number {
  if (untilMs == null || !Number.isFinite(untilMs) || untilMs <= nowMs) return 0;
  return untilMs - nowMs;
}
