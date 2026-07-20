import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'neptranslate.prefs.v1';

export type AppPrefs = {
  formalOn: boolean;
  devaOn: boolean;
};

const DEFAULTS: AppPrefs = {
  formalOn: true,
  devaOn: true,
};

export async function loadPrefs(): Promise<AppPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppPrefs>;
    return {
      formalOn:
        typeof parsed.formalOn === 'boolean' ? parsed.formalOn : DEFAULTS.formalOn,
      devaOn: typeof parsed.devaOn === 'boolean' ? parsed.devaOn : DEFAULTS.devaOn,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePrefs(prefs: AppPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
