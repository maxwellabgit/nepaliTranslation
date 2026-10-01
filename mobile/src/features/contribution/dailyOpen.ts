import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAILY_OPEN_CREDITS, FIRST_OPEN_CREDITS } from './openWelcome';
import { minutesForCredits, stackAdFreeMinutes } from './reviewCredits';
import { nyDateKey } from './reviewDayPlan';

const KEY = 'neptranslate.dailyOpen.v1';

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: DailyOpenRecord | null = null;
let revision = 0;

function publish(record: DailyOpenRecord | null) {
  cached = record;
  listeners.forEach((listener) => listener());
}

/** Latest grant. The gauge reads this when a write lands, without waiting for the poll. */
export function peekDailyOpen(): DailyOpenRecord | null {
  return cached;
}

export function subscribeDailyOpen(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type DailyOpenRecord = {
  nyDate: string;
  untilMs: number;
  /** True once the ad-free placeholder after the welcome has been dismissed. */
  adDismissed: boolean;
  /** True after the first-open grant. Older records count as already welcomed. */
  welcomed?: boolean;
};

export function laterActiveUntil(
  a: number | null | undefined,
  b: number | null | undefined,
  nowMs: number,
): number | null {
  const left = a != null && a > nowMs ? a : null;
  const right = b != null && b > nowMs ? b : null;
  if (left == null) return right;
  if (right == null) return left;
  return Math.max(left, right);
}

export async function readDailyOpen(): Promise<DailyOpenRecord | null> {
  const seen = revision;
  const raw = await AsyncStorage.getItem(KEY);
  if (seen !== revision) return cached;
  if (!raw) {
    publish(null);
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DailyOpenRecord;
    if (!parsed.nyDate || !Number.isFinite(parsed.untilMs)) {
      publish(null);
      return null;
    }
    publish(parsed);
    return parsed;
  } catch {
    publish(null);
    return null;
  }
}

/**
 * First open ever grants FIRST_OPEN_CREDITS. The first open of each later
 * New York day grants DAILY_OPEN_CREDITS. Minutes stack on the visible
 * clock and stop at 12 hours. A second call the same day is a no-op.
 */
export async function grantDailyOpenCoin(
  now = new Date(),
  visibleUntilMs: number | null = null,
): Promise<DailyOpenRecord> {
  const nyDate = nyDateKey(now.getTime());
  const existing = await readDailyOpen();
  if (existing && existing.nyDate === nyDate) return existing;
  const credits = existing ? DAILY_OPEN_CREDITS : FIRST_OPEN_CREDITS;
  const prior = laterActiveUntil(existing?.untilMs, visibleUntilMs, now.getTime());
  const beforeMinutes = prior == null ? 0 : (prior - now.getTime()) / 60_000;
  const stacked = stackAdFreeMinutes(beforeMinutes, minutesForCredits(credits));
  const record: DailyOpenRecord = {
    nyDate,
    untilMs: now.getTime() + stacked.remainingMinutes * 60_000,
    adDismissed: false,
    welcomed: true,
  };
  revision += 1;
  publish(record);
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
  return record;
}

/** Keep the visible clock after a later award so the gauge does not snap back. */
export async function extendDailyUntil(untilMs: number): Promise<void> {
  const existing = await readDailyOpen();
  if (!existing || !(untilMs > existing.untilMs)) return;
  const next = { ...existing, untilMs };
  revision += 1;
  publish(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function dismissDailyAd(now = new Date()): Promise<void> {
  const existing = await readDailyOpen();
  const nyDate = nyDateKey(now.getTime());
  if (!existing || existing.nyDate !== nyDate) return;
  const next = { ...existing, adDismissed: true };
  revision += 1;
  publish(next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
