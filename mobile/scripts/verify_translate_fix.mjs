/**
 * Sanity checks for phrase compose + mashup refusal.
 * Run from mobile/: node scripts/verify_translate_fix.mjs
 */
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { unlinkSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const out = join(__dirname, '_translate_bundle.cjs');

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

const cases = [
  ["Hey what's up can you hear me", 'phrase', true],
  ['can you hear me', 'phrase', true],
  ['Hello', 'phrase', true],
  ['big dog', 'lexicon', true],
  ['xyzzy unknownword', 'lexicon', false],
  ['can you xyzzy me', 'lexicon', false],
];

let failed = 0;
for (const [text, method, expectOut] of cases) {
  const r = t.translateOnDevice(text, 'en-ne', 'formal');
  const latin = /[A-Za-z]/.test(r.text);
  const ok =
    r.method === method &&
    (expectOut ? r.text.length > 0 && !latin : r.text === '');
  if (!ok) failed += 1;
  console.log(JSON.stringify({ text, method: r.method, out: r.text, latin, ok }));
}

if (existsSync(out)) unlinkSync(out);
if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
