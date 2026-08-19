#!/usr/bin/env node
/**
 * Place Dragneel Nepali Whisper ggml where the app probes:
 *   mobile/assets/models/whisper/ggml-ne-small-q5_1.bin
 *
 * Does NOT download ~190 MB by default (CI / cloud agents). Stock Whisper
 * small is unusable on Nepali — do not copy ggml-small-q5_1.bin here.
 *
 * Convert on a machine with whisper.cpp, then copy:
 *   WHISPER_GGML=/path/to/ggml-ne-small-q5_1.bin node scripts/fetch_whisper_nepali.mjs
 *
 * Flags:
 *   --check   exit 0 if the dest bin exists and is non-empty; else 1
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEST_DIR = path.join(ROOT, 'assets', 'models', 'whisper');
const DEST = path.join(DEST_DIR, 'ggml-ne-small-q5_1.bin');

function present() {
  try {
    return fs.statSync(DEST).size > 0;
  } catch {
    return false;
  }
}

function printHowTo() {
  console.log(`Nepali Whisper ggml is not at:
  ${DEST}

Convert Dragneel/whisper-small-nepali → q5_1 (not stock Whisper small):

  huggingface-cli download Dragneel/whisper-small-nepali
  python whisper.cpp/models/convert-h5-to-ggml.py <hf-dir> <whisper.cpp> .
  whisper-quantize ggml-model.bin ggml-ne-small-q5_1.bin q5_1

Then:

  WHISPER_GGML=/path/to/ggml-ne-small-q5_1.bin node scripts/fetch_whisper_nepali.mjs

whisper.rn is not in package.json yet. Typed Nepali fallback stays until
both the native module and this file ship in an EAS build.
`);
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    if (present()) {
      console.log(`[whisper] OK ${DEST} (${(fs.statSync(DEST).size / (1024 * 1024)).toFixed(1)} MB)`);
      process.exit(0);
    }
    console.log('[whisper] missing ggml-ne-small-q5_1.bin');
    process.exit(1);
  }

  const src = process.env.WHISPER_GGML;
  if (!src) {
    if (present()) {
      console.log(`[whisper] already present ${DEST}`);
      return;
    }
    printHowTo();
    process.exit(1);
  }

  if (!fs.existsSync(src) || fs.statSync(src).size <= 0) {
    throw new Error(`WHISPER_GGML not a non-empty file: ${src}`);
  }
  await fs.promises.mkdir(DEST_DIR, { recursive: true });
  const tmp = `${DEST}.partial`;
  await fs.promises.copyFile(src, tmp);
  await fs.promises.rename(tmp, DEST);
  console.log(
    `[whisper] copied → ${DEST} (${(fs.statSync(DEST).size / (1024 * 1024)).toFixed(1)} MB)`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
