import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_SUBSCRIPTION,
  type SubscriptionSnapshot,
  type SubscriptionStatus,
} from './purchaseTypes';

const KEY = 'nepx.subscription.v1';

export async function loadCachedSubscription(): Promise<SubscriptionSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubscriptionSnapshot;
    if (typeof parsed.status !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedSubscription(
  value: SubscriptionSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}

export async function clearCachedSubscription(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export function snapshotFromServerRow(row: {
  status?: string | null;
  product_id?: string | null;
  expires_at?: string | null;
}): SubscriptionSnapshot {
  const status = (row.status ?? 'none') as SubscriptionStatus;
  const expiresAtMs = row.expires_at ? Date.parse(row.expires_at) : null;
  return {
    status: ['none', 'active', 'expired', 'billing_retry', 'cancelled'].includes(
      status,
    )
      ? status
      : 'none',
    productId: row.product_id ?? null,
    priceString: null,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    updatedAtMs: Date.now(),
  };
}

export { EMPTY_SUBSCRIPTION };
