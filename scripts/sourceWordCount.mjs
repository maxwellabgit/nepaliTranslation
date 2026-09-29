/** Unicode-aware word count. Whitespace-separated. Must match planning snapshots. */

export function countSourceWords(text) {
  if (typeof text !== 'string') return 0;
  const parts = text.trim().split(/\s+/u).filter((word) => word.length > 0);
  return parts.length;
}

/**
 * Review reward rule. Snapshotted original source words:
 * 1–4 → 1 credit, 5–6 → 2 credits, 7 or more → 3 credits.
 * Empty text is rejected before planning; 0 words schedules nothing.
 * 1 credit = 10 ad-free minutes. Must match
 * private.scheduled_credits_for_words and mobile reviewCredits.ts.
 */
export function scheduledCreditsForWords(wordCount) {
  if (wordCount == null || wordCount <= 0) return 0;
  if (wordCount <= 4) return 1;
  if (wordCount <= 6) return 2;
  return 3;
}
