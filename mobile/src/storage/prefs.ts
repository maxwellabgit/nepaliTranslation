import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY = 'neptranslate.prefs.v1';
const listeners = new Set<(prefs: AppPrefs) => void>();

export function subscribePrefs(listener: (prefs: AppPrefs) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export type UiLangPref = 'en' | 'ne' | 'ne-roman';

export type AppPrefs = {
  formalOn: boolean;
  devaOn: boolean;
  /** Conversation consent sheet shown once. */
  conversationConsentSeen: boolean;
  /** In-app UI language and its selected Nepali writing system. */
  uiLang: UiLangPref;
};

const DEFAULTS: AppPrefs = {
  formalOn: true,
  devaOn: true,
  conversationConsentSeen: false,
  uiLang: 'en',
};

function parseUiLang(value: unknown): UiLangPref {
  return value === 'ne' || value === 'ne-roman' ? value : 'en';
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
  listeners.forEach(listener => listener(prefs));
}
