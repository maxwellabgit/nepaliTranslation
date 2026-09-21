import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@neptranslate/banner_cooldown_v1';

export type BannerCooldownState = {
  lastNetworkBannerAtMs: number | null;
  lastHouseBannerAtMs: number | null;
};

const EMPTY: BannerCooldownState = {
  lastNetworkBannerAtMs: null,
  lastHouseBannerAtMs: null,
};

/** Load persisted banner show timestamps (12m network / 24m house cooldowns). */
export async function loadBannerCooldowns(): Promise<BannerCooldownState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<BannerCooldownState>;
    return {
      lastNetworkBannerAtMs:
        typeof parsed.lastNetworkBannerAtMs === 'number'
          ? parsed.lastNetworkBannerAtMs
          : null,
      lastHouseBannerAtMs:
        typeof parsed.lastHouseBannerAtMs === 'number'
          ? parsed.lastHouseBannerAtMs
          : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/** Record a banner/house impression and persist for cross-screen cooldowns. */
export async function recordBannerShown(
  kind: 'banner' | 'house',
  atMs: number = Date.now(),
): Promise<BannerCooldownState> {
  const current = await loadBannerCooldowns();
  const next: BannerCooldownState =
    kind === 'banner'
      ? { ...current, lastNetworkBannerAtMs: atMs }
      : { ...current, lastHouseBannerAtMs: atMs };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Soft-fail: in-memory still applies for this session via caller state.
  }
  return next;
}

/** Test helper. */
export async function clearBannerCooldowns(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
