import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  PROVISIONAL_AD_FREE_MS,
  PROVISIONAL_EXPIRE_MS,
} from './adConfig';

const STORAGE_KEY = 'neptranslate.ads.provisional_grant.v1';

export type ProvisionalGrant = {
  sessionToken: string;
  startedAtMs: number;
  /** Local ad-free until (started + 10 min). */
  untilMs: number;
  /** Drop unverified remainder after this (started + 15 min). */
  expireAtMs: number;
  verified: boolean;
};

export function createProvisionalGrant(
  sessionToken: string,
  nowMs: number,
): ProvisionalGrant {
  return {
    sessionToken,
    startedAtMs: nowMs,
    untilMs: nowMs + PROVISIONAL_AD_FREE_MS,
    expireAtMs: nowMs + PROVISIONAL_EXPIRE_MS,
    verified: false,
  };
}

/**
 * One unresolved provisional grant at a time.
 * Returns null if an unresolved provisional already exists.
 */
export function acceptProvisionalGrant(
  current: ProvisionalGrant | null,
  next: ProvisionalGrant,
  nowMs: number,
): { ok: true; grant: ProvisionalGrant } | { ok: false; reason: string } {
  const cleaned = reconcileProvisional(current, nowMs);
  if (cleaned && !cleaned.verified && cleaned.expireAtMs > nowMs) {
    return { ok: false, reason: 'unresolved_provisional_exists' };
  }
  return { ok: true, grant: next };
}

/**
 * Reconcile with verified SSV: mark verified.
 * After 15 minutes without verification, remove the unverified remainder.
 */
export function reconcileProvisional(
  grant: ProvisionalGrant | null,
  nowMs: number,
  opts?: { verifiedSessionToken?: string },
): ProvisionalGrant | null {
  if (!grant) return null;
  if (
    opts?.verifiedSessionToken &&
    opts.verifiedSessionToken === grant.sessionToken
  ) {
    return { ...grant, verified: true };
  }
  if (!grant.verified && nowMs >= grant.expireAtMs) {
    return null;
  }
  return grant;
}

/** Effective local earned-until from provisional (never extends past untilMs). */
export function provisionalEarnedUntilMs(
  grant: ProvisionalGrant | null,
  nowMs: number,
): number | null {
  const live = reconcileProvisional(grant, nowMs);
  if (!live) return null;
  if (nowMs >= live.untilMs) return null;
  return live.untilMs;
}

export async function loadProvisionalGrant(): Promise<ProvisionalGrant | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProvisionalGrant;
    if (
      typeof parsed.sessionToken !== 'string' ||
      typeof parsed.startedAtMs !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveProvisionalGrant(
  grant: ProvisionalGrant | null,
): Promise<void> {
  if (!grant) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(grant));
}

export function supportMessageForExpiredProvisional(): string {
  return 'Your optional ad reward could not be verified. If ad-free time is missing, contact support with the time you watched the ad.';
}
