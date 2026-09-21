import { en, type MessageKey } from './en';
import { ne } from './ne';

export type UiLang = 'en' | 'ne';

export type { MessageKey };

const catalogs: Record<UiLang, Record<MessageKey, string>> = {
  en,
  ne,
};

/** Look up a UI string. Unknown keys fall back to English, then the key. */
export function t(key: MessageKey, lang: UiLang = 'en'): string {
  const primary = catalogs[lang]?.[key];
  if (primary) return primary;
  return en[key] ?? key;
}

export { en, ne };
