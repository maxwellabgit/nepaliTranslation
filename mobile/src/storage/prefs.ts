import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'neptranslate.prefs.v1';

export type UiLangPref = 'en' | 'ne';

export type AppPrefs = {
  formalOn: boolean;
  devaOn: boolean;
  /** Conversation consent sheet shown once. */
  conversationConsentSeen: boolean;
  /** In-app UI language (English | नेपाली). */
  uiLang: UiLangPref;
};

const DEFAULTS: AppPrefs = {
  formalOn: true,
  devaOn: true,
  conversationConsentSeen: false,
  uiLang: 'en',
};

function parseUiLang(value: unknown): UiLangPref {
  return value === 'ne' ? 'ne' : 'en';
}

export async function loadPrefs(): Promise<AppPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppPrefs>;
    return {
      formalOn:
        typeof parsed.formalOn === 'boolean' ? parsed.formalOn : DEFAULTS.formalOn,
      devaOn: typeof parsed.devaOn === 'boolean' ? parsed.devaOn : DEFAULTS.devaOn,
      conversationConsentSeen:
        typeof parsed.conversationConsentSeen === 'boolean'
          ? parsed.conversationConsentSeen
          : DEFAULTS.conversationConsentSeen,
      uiLang: parseUiLang(parsed.uiLang),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePrefs(prefs: AppPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
