/**
 * Small helpers for Conversation pass-the-phone UX.
 */

/** Pass needs either live interim speech or a completed turn from this side. */
export function canPassPhone(
  interim: string,
  latestFrom: 'en' | 'ne' | null,
  side: 'en' | 'ne',
): boolean {
  if (interim.trim()) return true;
  return latestFrom === side;
}

export function emptyShowFallback(from: 'en' | 'ne'): string {
  return from === 'en' ? 'No saved phrase yet' : 'No phrase match';
}
