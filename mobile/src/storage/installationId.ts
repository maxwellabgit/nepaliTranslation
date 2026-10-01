import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'neptranslate.installation.v1';

let inflight: Promise<string> | null = null;

/** Stable per-installation id. Welcome grants and guest sample progress use this, not an account id. */
export function readInstallationId(): Promise<string> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const existing = await AsyncStorage.getItem(KEY);
      if (existing && existing.length >= 8) return existing;
      const created = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(KEY, created);
      return created;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
