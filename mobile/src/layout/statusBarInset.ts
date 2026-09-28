/**
 * Room for the iOS status bar. Web preview reports no inset, so the home
 * shell never uses less than a standard iPhone status-bar height.
 */
export const STATUS_BAR_FALLBACK = 47;

export function statusBarInset(insetsTop: number): number {
  return Math.max(insetsTop, STATUS_BAR_FALLBACK);
}
