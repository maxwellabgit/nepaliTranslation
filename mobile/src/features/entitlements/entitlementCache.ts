import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nepx.entitlement.v1';

export type CachedEntitlement = {
  earnedAdFreeUntilMs: number | null;
  lifetimeCredits: number;
  version: number;
  syncedAtMs: number;
};

export async function loadCachedEntitlement(): Promise<CachedEntitlement | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntitlement;
    if (typeof parsed.version !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveCachedEntitlement(
  value: CachedEntitlement,
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
}

export async function clearCachedEntitlement(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
