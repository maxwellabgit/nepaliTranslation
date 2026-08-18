/**
 * Sanity checks for phrase compose + mashup refusal + informal register.
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

const mashupCases = [
  ['thank you xyzzy', 'lexicon', false],
  ['can you hear me xyzzy', 'lexicon', false],
];
for (const [text, method, expectOut] of mashupCases) {
  const r = t.translateOnDevice(text, 'en-ne', 'formal');
  const latin = /[A-Za-z]/.test(r.text);
  const ok =
    r.method === method &&
    (expectOut ? r.text.length > 0 && !latin : r.text === '');
  if (!ok) failed += 1;
  console.log(JSON.stringify({ kind: 'mashup', text, method: r.method, out: r.text, latin, ok }));
}

const name = t.translateOnDevice('my name is John', 'en-ne', 'formal');
const nameOk =
  name.method === 'phrase' &&
  name.text.includes('मेरो नाम') &&
  name.text.includes('John') &&
  !name.text.includes('xyzzy');
if (!nameOk) failed += 1;
console.log(JSON.stringify({ kind: 'name', text: 'my name is John', method: name.method, out: name.text, ok: nameOk }));

function check(label, ok, extra) {
  if (!ok) failed += 1;
  console.log(JSON.stringify({ kind: 'register', label, ok, ...extra }));
}

const sorryF = t.translateOnDevice('sorry', 'en-ne', 'formal');
check('sorry-formal', sorryF.method === 'phrase' && sorryF.text === 'माफ गर्नुहोस्', {
  out: sorryF.text,
});

const sorryI = t.translateOnDevice('sorry', 'en-ne', 'informal');
check(
  'sorry-informal',
  sorryI.method === 'phrase' &&
    sorryI.text.includes('माफ') &&
    sorryI.text.includes('गर') &&
    !sorryI.text.includes('गर्नुहोस्') &&
    !sorryI.text.includes('तपाईं') &&
    !sorryI.text.includes('तँ'),
  { out: sorryI.text },
);

const helpF = t.translateOnDevice('can you help me', 'en-ne', 'formal');
check(
  'can-you-help-me-formal',
  helpF.method === 'phrase' &&
    helpF.text.includes('तपाईं') &&
    helpF.text.includes('सक्नुहुन्छ') &&
    !helpF.text.includes('तिमी') &&
    !helpF.text.includes('तँ'),
  { out: helpF.text },
);

const helpI = t.translateOnDevice('can you help me', 'en-ne', 'informal');
check(
  'can-you-help-me-informal',
  helpI.method === 'phrase' &&
    helpI.text.includes('तिमी') &&
    helpI.text.includes('सक्छौ') &&
    !helpI.text.includes('तपाईं') &&
    !helpI.text.includes('सक्नुहुन्छ') &&
    !helpI.text.includes('तँ'),
  { out: helpI.text },
);

const howI = t.translateOnDevice('how are you', 'en-ne', 'informal');
check(
  'how-are-you-informal',
  howI.method === 'phrase' &&
    howI.text.includes('तिमीलाई') &&
    !howI.text.includes('तपाईं') &&
    !howI.text.includes('तँ'),
  { out: howI.text },
);

const goI = t.translateOnDevice('go', 'en-ne', 'informal');
check(
  'go-informal',
  goI.method === 'phrase' &&
    goI.text.includes('जाऊ') &&
    !goI.text.includes('जानुहोस्') &&
    !goI.text.includes('तँ'),
  { out: goI.text },
);

const sorryRoman = t.translateOnDevice('sorry', 'en-ne', {
  formality: 'informal',
  script: 'roman',
});
check(
  'sorry-informal-roman',
  sorryRoman.method === 'phrase' &&
    sorryRoman.text === 'maaf gara' &&
    !/garnuhos/i.test(sorryRoman.text) &&
    !sorryRoman.text.includes('तँ'),
  { out: sorryRoman.text },
);

if (existsSync(out)) unlinkSync(out);
if (failed) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log('OK');
