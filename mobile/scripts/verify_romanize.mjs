/**
 * Letter transliteration only. No meaning-bank word list.
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
  `npx --yes esbuild src/mt/romanize.ts --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: root, encoding: 'utf8', shell: true },
);
if (build.status !== 0) {
  process.stderr.write(build.stderr || build.stdout || 'esbuild failed\n');
  process.exit(build.status ?? 1);
}

const require = createRequire(import.meta.url);
const t = require(out);

let failed = 0;
function check(label, ok, extra) {
  if (!ok) failed += 1;
  console.log(JSON.stringify({ label, ok, ...extra }));
}

const roman = t.devanagariToRoman('नमस्ते');
check('deva to latin letters', /^[a-z. ]+$/i.test(roman) && roman.length > 0, {
  out: roman,
});

const back = t.romanToDevanagari('namaste');
check(
  'syllable parse stays in devanagari',
  /[\u0900-\u097F]/.test(back) && !/[A-Za-z]/.test(back),
  { out: back },
);

check('chat roman still detected', t.looksLikeRomanNepali('tapai lai kasto cha') === true);
check('plain english is not roman nepali', t.looksLikeRomanNepali('where is the hotel') === false);

if (existsSync(out)) unlinkSync(out);
if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
