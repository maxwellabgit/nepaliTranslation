import AsyncStorage from '@react-native-async-storage/async-storage';

/** Speech and Camera photo sharing. Both default off, per authenticated account. */
const KEY = 'neptranslate.sharing_toggles.v2';

export type SharingToggles = {
  speech: boolean;
  photos: boolean;
};

const DEFAULTS: SharingToggles = { speech: false, photos: false };
let testOverride: SharingToggles | null = null;
const memory = new Map<string, SharingToggles>();

export function setSharingTogglesForTests(value: SharingToggles | null): void {
  testOverride = value;
}

function normalize(raw: Partial<SharingToggles> | null | undefined): SharingToggles {
  return {
    speech: raw?.speech === true,
    photos: raw?.photos === true,
  };
}

async function readStore(): Promise<Record<string, SharingToggles>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<SharingToggles>>;
    const next: Record<string, SharingToggles> = {};
    for (const [userId, value] of Object.entries(parsed)) {
      if (!userId || !value || typeof value !== 'object') continue;
      next[userId] = normalize(value);
    }
    return next;
  } catch {
    return {};
  }
}

/** Guests have no sharing choices. Another account's toggles are not visible. */
export async function loadSharingToggles(
  userId?: string | null,
): Promise<SharingToggles> {
  if (testOverride) return testOverride;
  if (!userId) return DEFAULTS;
  const remembered = memory.get(userId);
  if (remembered) return remembered;
  const store = await readStore();
  return store[userId] ?? DEFAULTS;
}

export async function saveSharingToggles(
  userId: string | null | undefined,
  next: SharingToggles,
): Promise<SharingToggles> {
  const value = normalize(next);
  if (!userId) return DEFAULTS;
  memory.set(userId, value);
  try {
    const store = await readStore();
    store[userId] = value;
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* keep the in-memory value for this session */
  }
  return value;
}
