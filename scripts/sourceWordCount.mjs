/** Unicode-aware word count. Whitespace-separated. Must match planning snapshots. */

export function countSourceWords(text) {
  if (typeof text !== 'string') return 0;
  const parts = text.trim().split(/\s+/u).filter((word) => word.length > 0);
  return parts.length;
}

/** C4 rule v1. Empty text is rejected by the planner; 0 words still maps to 2. */
export function scheduledCreditsForWords(wordCount) {
  if (wordCount == null || wordCount < 0) return 0;
  if (wordCount <= 20) return 2;
  return 4;
}
