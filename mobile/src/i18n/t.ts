import { en, type MessageKey } from './en';
import { ne } from './ne';
import { formatNepaliScript } from '../mt/romanize';

export type UiLang = 'en' | 'ne' | 'ne-roman';

export type { MessageKey };

const catalogs: Record<UiLang, Record<MessageKey, string>> = {
  en,
  ne,
  'ne-roman': Object.fromEntries(Object.entries(ne).map(([key, value]) =>
    [key, value.split(/(\s+)/).map(part => /\S/.test(part)
      ? formatNepaliScript(part, 'roman').replace(/[।॥]/g, '.')
        .replace(/[०-९]/g, digit => String(digit.charCodeAt(0) - 0x0966))
      : part).join('')],
  )) as Record<MessageKey, string>,
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
