/** 30-day rolling inactivity. JWT lifetime stays short; this is the client guard. */
export const SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;

export function isSessionInactive(
  lastActiveMs: number,
  nowMs: number,
  timeoutMs: number = SESSION_INACTIVITY_MS,
): boolean {
  if (!Number.isFinite(lastActiveMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - lastActiveMs >= timeoutMs;
}
