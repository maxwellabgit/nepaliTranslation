import AsyncStorage from '@react-native-async-storage/async-storage';
import { markSkippableVideoAdDue } from './skippableVideoAdMark';

/** Visible credits-bar countdown. Separate from the older cumulative foreground total. */
export const AD_COUNTDOWN_MS = 15 * 60 * 1000;
const KEY = '@neptranslate/ads/countdownRemainingMs';

let remainingMs = AD_COUNTDOWN_MS;
let ticking = false;
let lastTickMs = 0;
let hydrated = false;
let markedDue = false;
const listeners = new Set<(remainingMs: number) => void>();

function emit() {
  listeners.forEach((listener) => listener(remainingMs));
}

function persist() {
  void AsyncStorage.setItem(KEY, String(remainingMs)).catch(() => undefined);
}

export function subscribeAdCountdown(
  listener: (remainingMs: number) => void,
): () => void {
  listener(remainingMs);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Load the paused remainder. Missing storage starts at 15:00. */
export async function hydrateAdCountdown(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw == null ? AD_COUNTDOWN_MS : Number(raw);
    if (Number.isFinite(n)) {
      remainingMs = Math.min(AD_COUNTDOWN_MS, Math.max(0, Math.floor(n)));
    }
  } catch {
    remainingMs = AD_COUNTDOWN_MS;
  }
  hydrated = true;
  if (remainingMs === 0) markedDue = true;
  emit();
}

/**
 * App is in the foreground. Elapsed time since the last tick counts down.
 * Closing the app should call `pauseAdCountdown` so this stops.
 */
export function resumeAdCountdown(nowMs: number): void {
  if (!hydrated) return;
  if (!ticking) {
    ticking = true;
    lastTickMs = nowMs;
    return;
  }
  const delta = Math.max(0, nowMs - lastTickMs);
  lastTickMs = nowMs;
  if (delta === 0 || remainingMs === 0) return;
  const next = Math.max(0, remainingMs - delta);
  const hitZero = remainingMs > 0 && next === 0;
  remainingMs = next;
  emit();
  persist();
  if (hitZero && !markedDue) {
    markedDue = true;
    // REVIEW: countdown reached 0:00 while the app was open.
    markSkippableVideoAdDue();
  }
}

/** App left the foreground. Freeze the remainder until the next open. */
export function pauseAdCountdown(nowMs: number): void {
  if (!hydrated) return;
  if (ticking) {
    resumeAdCountdown(nowMs);
    ticking = false;
  }
  persist();
}
