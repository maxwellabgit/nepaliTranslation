/**
 * The phrasebook translator is gone. Direction detection still picks a checkpoint.
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
  `npx --yes esbuild src/mt/onDeviceTranslate.ts --bundle --platform=node --format=cjs --outfile="${out}"`,
  { cwd: root, encoding: 'utf8', shell: true },
);
if (build.status !== 0) {
  process.stderr.write(build.stderr || build.stdout || 'esbuild failed\n');
  process.exit(build.status ?? 1);
}

const require = createRequire(import.meta.url);
const t = require(out);

let failed = 0;
function check(label, ok) {
  if (!ok) failed += 1;
  console.log(JSON.stringify({ label, ok }));
}

check('no phrase translator', typeof t.translateOnDevice !== 'function');
check('no sentence lexicon', typeof t.translateBySentences !== 'function');
check('english selects en-ne', t.detectDirection('Hello', 'ne-en') === 'en-ne');
check('devanagari selects ne-en', t.detectDirection('नमस्ते', 'en-ne') === 'ne-en');
check('chat roman selects ne-en', t.detectDirection('namaste', 'en-ne') === 'ne-en');

if (existsSync(out)) unlinkSync(out);
if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
