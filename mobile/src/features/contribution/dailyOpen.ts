import AsyncStorage from '@react-native-async-storage/async-storage';
import { nyDateKey } from './reviewDayPlan';

const KEY = 'neptranslate.dailyOpen.v1';
const TEN_MINUTES_MS = 10 * 60 * 1000;

export type DailyOpenRecord = {
  nyDate: string;
  untilMs: number;
  /** True once the ad-free placeholder after the coin popup has been dismissed. */
  adDismissed: boolean;
};

export async function readDailyOpen(): Promise<DailyOpenRecord | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DailyOpenRecord;
    if (!parsed.nyDate || !Number.isFinite(parsed.untilMs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * First open of a New York day, including the first open ever, grants one coin.
 * One coin is 10 minutes, so an empty timer reads 10:00.
 */
export async function grantDailyOpenCoin(now = new Date()): Promise<DailyOpenRecord> {
  const nyDate = nyDateKey(now.getTime());
  const existing = await readDailyOpen();
  if (existing && existing.nyDate === nyDate) return existing;
  const record: DailyOpenRecord = {
    nyDate,
    untilMs: now.getTime() + TEN_MINUTES_MS,
    adDismissed: false,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(record));
  return record;
}

export async function dismissDailyAd(now = new Date()): Promise<void> {
  const existing = await readDailyOpen();
  const nyDate = nyDateKey(now.getTime());
  if (!existing || existing.nyDate !== nyDate) return;
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...existing, adDismissed: true }));
}
