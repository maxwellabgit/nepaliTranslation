/**
 * Check Roman Nepali → English phrase hits + transliteration sanity.
 * Run from mobile/: node scripts/verify_romanize.mjs
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const out = join(__dirname, '_roman_bundle.cjs');

const build = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  [
    '--yes',
    'esbuild',
    'src/mt/onDeviceTranslate.ts',
    '--bundle',
    '--platform=node',
    '--format=cjs',
    `--outfile=${out}`,
  ],
  { cwd: root, encoding: 'utf8', shell: true },
);
if (build.status !== 0) {
  process.stderr.write(build.stderr || build.stdout || 'esbuild failed\n');
  process.exit(build.status ?? 1);
}

const require = createRequire(import.meta.url);
const t = require(out);

const phraseCases = [
  ['namaste', 'hello'],
  ['tapai lai kasto cha?', 'how are you'],
  ['dhanyabad', 'thank you'],
  ['ma thik chu', 'i am fine'],
];

const romanWords = [
  ['tapai', 'तपाईं'],
  ['kasto', 'कस्तो'],
  ['namaste', 'नमस्ते'],
  ['pani', 'पानी'],
];

let failed = 0;
for (const [src, expectSub] of phraseCases) {
  const r = t.translateOnDevice(src, 'ne-en', { forcePreferred: true });
  const ok =
    r.method === 'phrase' &&
    r.text.toLowerCase().includes(expectSub);
  if (!ok) {
    failed += 1;
    console.log('PHRASE_FAIL', JSON.stringify({ src, method: r.method, out: r.text }));
  } else {
    console.log('PHRASE_OK', src, '→', r.text);
  }
}

for (const [src, expect] of romanWords) {
  const got = t.romanToDevanagari
    ? t.romanToDevanagari(src)
    : null;
  // romanToDevanagari is re-exported from onDeviceTranslate via format path;
  // fall back to translating the word through the engine's romanizer by
  // checking the bundled module's own export if present.
  const { romanToDevanagari } = t;
  const outDeva = romanToDevanagari ? romanToDevanagari(src) : got;
  const ok = outDeva === expect;
  if (!ok) {
    failed += 1;
    console.log('ROMAN_FAIL', JSON.stringify({ src, expect, out: outDeva }));
  } else {
    console.log('ROMAN_OK', src, '→', outDeva);
  }
}

if (existsSync(out)) unlinkSync(out);
if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
