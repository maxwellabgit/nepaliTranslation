import AsyncStorage from '@react-native-async-storage/async-storage';

/** 30-day rolling inactivity, scoped to one account. JWT lifetime stays short. */
const KEY_PREFIX = 'neptranslate.session_last_active_ms.';
export const SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export async function readLastActiveMs(userId: string): Promise<number | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function touchSessionActivity(
  userId: string,
  nowMs: number = Date.now(),
): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), String(nowMs));
  } catch {
    /* guest translation must not depend on this write */
  }
}

/** Missing history for this account does not expire it. A stale stamp does. */
export async function sessionInactiveNow(
  userId: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!userId) return true;
  const last = await readLastActiveMs(userId);
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
