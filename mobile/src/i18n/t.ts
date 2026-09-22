import { en, type MessageKey } from './en';
import { ne } from './ne';

export type UiLang = 'en' | 'ne';

export type { MessageKey };

const catalogs: Record<UiLang, Record<MessageKey, string>> = {
  en,
  ne,
};

export type TParams = Record<string, string | number>;

/** Look up a UI string. Unknown keys fall back to English, then the key. */
export function t(
  key: MessageKey,
  lang: UiLang = 'en',
  params?: TParams,
): string {
  const primary = catalogs[lang]?.[key];
  let out = primary || en[key] || key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

export { en, ne };
