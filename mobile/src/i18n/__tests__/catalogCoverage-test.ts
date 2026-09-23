/**
 * Guards F2 chrome: AppShell / Translate / Camera must not reintroduce
 * hardcoded English that already lives in the i18n catalog.
 *
 * Uses require() so tsc (jest-only types) does not need @types/node.
 */

const fs = require('fs') as {
  readFileSync: (p: string, enc: string) => string;
};
const path = require('path') as {
  resolve: (...parts: string[]) => string;
  join: (...parts: string[]) => string;
};

declare const __dirname: string;

const ROOT = path.resolve(__dirname, '../..');

const TARGETS = [
  'app/AppShell.tsx',
  'screens/TranslateScreen.tsx',
  'screens/CameraScreen.tsx',
  'features/contribution/CorrectionSheet.tsx',
] as const;

/** Phrases that must come from t('…') — not string literals in these files. */
const BANNED: string[] = [
  'Translate tab',
  'Camera tab',
  'Learn tab',
  'Listening…',
  'Finishing speech…',
  'Mark incorrect',
  'Allow camera',
  'No text found',
  'Capture failed. Try again.',
  'Speak to translate',
  'Stop listening',
  'Need microphone access to speak.',
  'Camera OCR runs on this phone',
  'Nepali → English',
  'English → Nepali',
  '13 or older',
  'Sign in with Apple in Settings to contribute',
  'Sentence ${',
  '`Sentence ',
];

function stripNoise(source: string): string {
  let out = source;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/\/\/.*$/gm, '');
  out = out.replace(/from\s+['`][^'`]+['`]/g, '');
  out = out.replace(/t\(\s*['`][^'`]+['`]/g, 't(');
  out = out.replace(/testID=\{?['`][^'`]+['`]\}?/g, '');
  out = out.replace(/name=["'][^"']+["']/g, '');
  out = out.split('NepTranslate').join('');
  out = out.replace(/[\u0900-\u097F]+/g, '');
  return out;
}

describe('i18n catalog coverage (F2 chrome)', () => {
  test('F2 chrome and contribution sheets avoid banned hardcoded English', () => {
    const hits: string[] = [];
    for (const rel of TARGETS) {
      const full = path.join(ROOT, rel);
      const raw = fs.readFileSync(full, 'utf8');
      const scanned = stripNoise(raw);
      for (const phrase of BANNED) {
        if (scanned.includes(phrase)) {
          hits.push(`${rel}: ${JSON.stringify(phrase)}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  test('ne catalog covers every en MessageKey', () => {
    const { en } = require('../en') as { en: Record<string, string> };
    const { ne } = require('../ne') as { ne: Record<string, string> };
    const missing = Object.keys(en).filter((k) => typeof ne[k] !== 'string');
    expect(missing).toEqual([]);
  });
});
