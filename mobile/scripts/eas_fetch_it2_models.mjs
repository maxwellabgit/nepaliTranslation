#!/usr/bin/env node
/**
 * EAS / local helper: download IndicTrans2 INT8 ONNX bundles into
 * mobile/assets/models/ so the withIt2Models config plugin can pack them
 * into the native app (no first-launch HF download).
 */
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = path.join(ROOT, 'assets', 'models');

/** Must match plugins/withIt2Models.js + src/mt/onnx/modelAssets.ts */
const ALLOW = [
  'encoder_model.onnx',
  'encoder_model.onnx.data',
  'decoder_model.onnx',
  'decoder_with_past_model.onnx',
  'decoder_shared.onnx.data',
  'tokenizer_src.json',
  'tokenizer_tgt.json',
  'tokenizer_meta.json',
  'generation_config.json',
];

const BUNDLES = [
  ['hari31416/indictrans2-en-indic-dist-200M-ONNX-int8', 'it2_en_indic'],
  ['hari31416/indictrans2-indic-en-dist-200M-ONNX-int8', 'it2_indic_en'],
];

function complete(dir) {
  return ALLOW.every((name) => {
    const p = path.join(dir, name);
    try {
      return fs.statSync(p).size > 0;
    } catch {
      return false;
    }
  });
}

async function downloadFile(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  await fs.promises.rename(tmp, dest);
}

async function ensureBundle(repo, folder) {
  const dest = path.join(MODELS, folder);
  if (complete(dest)) {
    console.log(`[it2] OK cached ${folder}`);
    return;
  }
  await fs.promises.mkdir(dest, { recursive: true });
  console.log(`[it2] Downloading ${repo} → ${folder}`);
  for (const fileName of ALLOW) {
    const out = path.join(dest, fileName);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) continue;
    const url = `https://huggingface.co/${repo}/resolve/main/${fileName}?download=true`;
    process.stdout.write(`  - ${fileName} ... `);
    await downloadFile(url, out);
    console.log(`${(fs.statSync(out).size / (1024 * 1024)).toFixed(1)} MB`);
  }
  if (!complete(dest)) {
    throw new Error(`Incomplete bundle after download: ${folder}`);
  }
  console.log(`[it2] Done ${folder}`);
}

async function main() {
  await fs.promises.mkdir(MODELS, { recursive: true });
  for (const [repo, folder] of BUNDLES) {
    await ensureBundle(repo, folder);
  }
  console.log('[it2] ALL_DONE');
}

main().catch((err) => {
  console.error('[it2] FAILED', err);
  process.exit(1);
});
