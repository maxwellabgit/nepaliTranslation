import AsyncStorage from '@react-native-async-storage/async-storage';

/** Speech and Camera photo sharing. Both default off. Consent is not a third toggle. */
const KEY = 'neptranslate.sharing_toggles.v1';

export type SharingToggles = {
  speech: boolean;
  photos: boolean;
};

const DEFAULTS: SharingToggles = { speech: false, photos: false };
let testOverride: SharingToggles | null = null;

export function setSharingTogglesForTests(value: SharingToggles | null): void {
  testOverride = value;
}

export async function loadSharingToggles(): Promise<SharingToggles> {
  if (testOverride) return testOverride;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<SharingToggles>;
    return {
      speech: parsed.speech === true,
      photos: parsed.photos === true,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveSharingToggles(next: SharingToggles): Promise<SharingToggles> {
  const value = { speech: next.speech === true, photos: next.photos === true };
  testOverride = value;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* keep the in-memory value for this session */
  }
  return value;
}
