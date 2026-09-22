import AsyncStorage from '@react-native-async-storage/async-storage';

const FOREGROUND_MS_KEY = '@neptranslate/ads/foregroundActiveMs';
const INTERSTITIAL_DAY_KEY = '@neptranslate/ads/interstitialNyDay';
const INTERSTITIAL_COUNT_KEY = '@neptranslate/ads/interstitialNyCount';

/**
 * America/New_York calendar day as YYYY-MM-DD (DST-aware via Intl).
 */
export function americaNewYorkCalendarDay(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(nowMs));
}

export async function loadForegroundActiveMs(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FOREGROUND_MS_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function saveForegroundActiveMs(ms: number): Promise<void> {
  try {
    await AsyncStorage.setItem(FOREGROUND_MS_KEY, String(Math.max(0, Math.floor(ms))));
  } catch {
    /* soft-fail */
  }
}

export type InterstitialDayState = {
  dayKey: string;
  count: number;
};

export async function loadInterstitialDayState(
  nowMs: number,
): Promise<InterstitialDayState> {
  const today = americaNewYorkCalendarDay(nowMs);
  try {
    const [dayKey, countRaw] = await Promise.all([
      AsyncStorage.getItem(INTERSTITIAL_DAY_KEY),
      AsyncStorage.getItem(INTERSTITIAL_COUNT_KEY),
    ]);
    if (dayKey !== today) {
      return { dayKey: today, count: 0 };
    }
    const count = Number(countRaw ?? 0);
    return {
      dayKey: today,
      count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    };
  } catch {
    return { dayKey: today, count: 0 };
  }
}

export async function recordInterstitialPresentation(
  nowMs: number,
): Promise<InterstitialDayState> {
  const today = americaNewYorkCalendarDay(nowMs);
  const prev = await loadInterstitialDayState(nowMs);
  const count = prev.dayKey === today ? prev.count + 1 : 1;
  try {
    await AsyncStorage.multiSet([
      [INTERSTITIAL_DAY_KEY, today],
      [INTERSTITIAL_COUNT_KEY, String(count)],
    ]);
  } catch {
    /* soft-fail */
  }
  return { dayKey: today, count };
}

/** Test helper. */
export async function clearForegroundAdTimerState(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      FOREGROUND_MS_KEY,
      INTERSTITIAL_DAY_KEY,
      INTERSTITIAL_COUNT_KEY,
    ]);
  } catch {
    /* soft-fail */
  }
}

/**
 * Accumulates AppState === 'active' time. Call tick(now) periodically while
 * active, or on background transitions with the elapsed slice.
 */
export function createForegroundAccumulator(initialMs = 0): {
  getMs: () => number;
  setMs: (ms: number) => void;
  /** Start (or resume) an active segment at nowMs. */
  onActive: (nowMs: number) => void;
  /** End an active segment at nowMs; returns new total. */
  onInactive: (nowMs: number) => number;
  /** Flush open segment without changing active/inactive. */
  flush: (nowMs: number) => number;
} {
  let totalMs = Math.max(0, initialMs);
  let segmentStart: number | null = null;

  return {
    getMs: () => totalMs,
    setMs: (ms) => {
      totalMs = Math.max(0, ms);
    },
    onActive: (nowMs) => {
      if (segmentStart == null) segmentStart = nowMs;
    },
    onInactive: (nowMs) => {
      if (segmentStart != null) {
        totalMs += Math.max(0, nowMs - segmentStart);
        segmentStart = null;
      }
      return totalMs;
    },
    flush: (nowMs) => {
      if (segmentStart != null) {
        totalMs += Math.max(0, nowMs - segmentStart);
        segmentStart = nowMs;
      }
      return totalMs;
    },
  };
}
