import AsyncStorage from '@react-native-async-storage/async-storage';

/** 30-day rolling inactivity. JWT lifetime stays short; this is the client guard. */
const LAST_ACTIVE_KEY = 'neptranslate.session_last_active_ms';
export const SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;

export async function readLastActiveMs(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function touchSessionActivity(nowMs: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ACTIVE_KEY, String(nowMs));
  } catch {
    /* guest translation must not depend on this write */
  }
}

/** Missing history does not expire the session. A stale stamp does. */
export async function sessionInactiveNow(nowMs: number = Date.now()): Promise<boolean> {
  const last = await readLastActiveMs();
  if (last == null) return false;
  return isSessionInactive(last, nowMs);
}

export function isSessionInactive(
  lastActiveMs: number,
  nowMs: number,
  timeoutMs: number = SESSION_INACTIVITY_MS,
): boolean {
  if (!Number.isFinite(lastActiveMs) || !Number.isFinite(nowMs)) return true;
  return nowMs - lastActiveMs >= timeoutMs;
}
