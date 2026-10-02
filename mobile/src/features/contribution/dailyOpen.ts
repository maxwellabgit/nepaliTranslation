import AsyncStorage from '@react-native-async-storage/async-storage';
import { readInstallationId } from '../../storage/installationId';
import { DAILY_OPEN_CREDITS, FIRST_OPEN_CREDITS } from './openWelcome';
import { minutesForCredits, stackAdFreeMinutes } from './reviewCredits';
import { nyDateKey } from './reviewDayPlan';

const KEY_V2 = 'neptranslate.dailyOpen.v2';
const KEY_V1 = 'neptranslate.dailyOpen.v1';

type Listener = () => void;

const listeners = new Set<Listener>();
let cached: DailyOpenRecord | null = null;
let chain: Promise<void> = Promise.resolve();

function publish(record: DailyOpenRecord | null) {
  cached = record;
  listeners.forEach((listener) => listener());
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Latest grant. The gauge reads this when a durable write has landed. */
export function peekDailyOpen(): DailyOpenRecord | null {
  return cached;
}

export function subscribeDailyOpen(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type PendingFlight = {
  kind: 'welcome' | 'daily';
  credits: number;
  /** Durable presentation data so a capped award resumes without inventing time. */
  fromUntilMs?: number | null;
  minutesApplied?: number;
  capped?: boolean;
};

export type DailyOpenRecord = {
  schemaVersion: 2;
  installationId: string;
  nyDate: string;
  untilMs: number;
  /** True once the ad-free placeholder after the welcome has been dismissed. */
  adDismissed: boolean;
  /** True after the first-open grant. An older v1 record counts as already welcomed. */
  welcomed: boolean;
  /** Set until the flying award finishes. Resume does not grant again. */
  pendingFlight: PendingFlight | null;
  /** installation+welcome, or installation plus the New York date. */
  receipt: string;
  verifiedAdSessions?: string[];
};

type LegacyDailyOpen = {
  nyDate?: string;
  untilMs?: number;
  adDismissed?: boolean;
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

function asRecord(raw: unknown, installationId: string): DailyOpenRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<DailyOpenRecord>;
  const untilMs = parsed.untilMs;
  if (!parsed.nyDate || untilMs == null || !Number.isFinite(untilMs)) return null;
  const welcomed = parsed.welcomed !== false;
  return {
    schemaVersion: 2,
    installationId: parsed.installationId || installationId,
    nyDate: parsed.nyDate,
    untilMs,
    adDismissed: Boolean(parsed.adDismissed),
    welcomed,
    pendingFlight: parsed.pendingFlight?.credits ? parsed.pendingFlight : null,
    verifiedAdSessions: parsed.verifiedAdSessions ?? [],
    receipt:
      parsed.receipt ||
      (welcomed ? `${installationId}:${parsed.nyDate}` : `${installationId}:welcome`),
  };
}

async function writeRecord(record: DailyOpenRecord): Promise<DailyOpenRecord> {
  await AsyncStorage.setItem(KEY_V2, JSON.stringify(record));
  publish(record);
  return record;
}

/** Read or migrate. Does not add credits. Callers must already be on the write queue. */
async function loadRecord(): Promise<DailyOpenRecord | null> {
  const installationId = await readInstallationId();
  const current = await AsyncStorage.getItem(KEY_V2);
  if (current) {
    try {
      const parsed = asRecord(JSON.parse(current) as unknown, installationId);
      publish(parsed);
      return parsed;
    } catch {
      publish(null);
      return null;
    }
  }
  const legacyRaw = await AsyncStorage.getItem(KEY_V1);
  if (!legacyRaw) {
    publish(null);
    return null;
  }
  try {
    const legacy = JSON.parse(legacyRaw) as LegacyDailyOpen;
    const untilMs = legacy.untilMs;
    if (!legacy.nyDate || untilMs == null || !Number.isFinite(untilMs)) {
      publish(null);
      return null;
    }
    const record: DailyOpenRecord = {
      schemaVersion: 2,
      installationId,
      nyDate: legacy.nyDate,
      untilMs,
      adDismissed: Boolean(legacy.adDismissed),
      welcomed: true,
      pendingFlight: null,
      receipt: `${installationId}:${legacy.nyDate}`,
    };
    return writeRecord(record);
  } catch {
    publish(null);
    return null;
  }
}

export async function readDailyOpen(): Promise<DailyOpenRecord | null> {
  return enqueue(() => loadRecord());
}

/**
 * First open on this installation grants FIRST_OPEN_CREDITS.
 * The first open of each later New York day grants DAILY_OPEN_CREDITS.
 * Minutes stack on the visible clock and stop at 12 hours.
 * A second call the same New York day is a no-op. Account switches do not grant again.
 * The cache updates only after the write succeeds.
 */
export async function grantDailyOpenCoin(
  now = new Date(),
  visibleUntilMs: number | null = null,
): Promise<DailyOpenRecord> {
  return enqueue(async () => {
    const nyDate = nyDateKey(now.getTime());
    const existing = await loadRecord();
    if (existing && existing.nyDate === nyDate) return existing;
    const welcomed = Boolean(existing?.welcomed);
    const credits = welcomed ? DAILY_OPEN_CREDITS : FIRST_OPEN_CREDITS;
    const kind = welcomed ? 'daily' : 'welcome';
    const prior = laterActiveUntil(existing?.untilMs, visibleUntilMs, now.getTime());
    const beforeMinutes = prior == null ? 0 : (prior - now.getTime()) / 60_000;
    const stacked = stackAdFreeMinutes(beforeMinutes, minutesForCredits(credits));
    const installationId = existing?.installationId ?? (await readInstallationId());
    const record: DailyOpenRecord = {
      schemaVersion: 2,
      installationId,
      nyDate,
      untilMs: now.getTime() + stacked.remainingMinutes * 60_000,
      adDismissed: false,
      welcomed: true,
      verifiedAdSessions: existing?.verifiedAdSessions ?? [],
      pendingFlight: {
        kind,
        credits,
        fromUntilMs: prior,
        minutesApplied: stacked.appliedMinutes,
        capped: stacked.capped,
      },
      receipt: kind === 'welcome' ? `${installationId}:welcome` : `${installationId}:${nyDate}`,
    };
    return writeRecord(record);
  });
}

/** Keep the longer visible clock after a later award so the gauge does not snap back. */
export async function extendDailyUntil(untilMs: number): Promise<void> {
  return enqueue(async () => {
    const existing = await loadRecord();
    if (!existing || !(untilMs > existing.untilMs)) return;
    await writeRecord({ ...existing, untilMs });
  });
}

/** SDK-confirmed dismissed ad; serialized with installation/date awards. */
export async function grantLocalAdCredits(credits: 1 | 2, nowMs: number, durableUntilMs: number | null, verifiedSession?: string) {
  return enqueue(async () => {
    const existing = await loadRecord();
    if (!existing) return null;
    if (verifiedSession && existing.verifiedAdSessions?.includes(verifiedSession)) return null;
    const before = laterActiveUntil(existing.untilMs, durableUntilMs, nowMs);
    const fromRemainingMs = Math.max(0, (before ?? nowMs) - nowMs);
    const stacked = stackAdFreeMinutes(fromRemainingMs / 60_000, minutesForCredits(credits));
    await writeRecord({ ...existing, untilMs: nowMs + stacked.remainingMinutes * 60_000,
      verifiedAdSessions: verifiedSession ? [...(existing.verifiedAdSessions ?? []), verifiedSession] : existing.verifiedAdSessions });
    return { credits, minutes: stacked.appliedMinutes, capped: stacked.capped,
      fromRemainingMs, toRemainingMs: stacked.remainingMinutes * 60_000 };
  });
}

export async function dismissDailyAd(now = new Date()): Promise<void> {
  return enqueue(async () => {
    const existing = await loadRecord();
    const nyDate = nyDateKey(now.getTime());
    if (!existing || existing.nyDate !== nyDate || existing.adDismissed) return;
    await writeRecord({ ...existing, adDismissed: true });
  });
}

/** The flying award finished or was acknowledged. Does not remove the grant. */
export async function clearPendingFlight(): Promise<void> {
  return enqueue(async () => {
    const existing = await loadRecord();
    if (!existing?.pendingFlight) return;
    await writeRecord({ ...existing, pendingFlight: null });
  });
}
