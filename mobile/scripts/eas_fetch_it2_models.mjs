#!/usr/bin/env node
/**
 * EAS / local helper: download IndicTrans2 INT8 ONNX bundles into
 * mobile/assets/models/ so the withIt2Models config plugin can pack them
 * into the native app (no first-launch HF download).
 *
 * Pins: immutable revision + SHA-256 from it2-release-manifest.json.
 * Hash mismatch fails the EAS fetch (exit 1).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = path.join(ROOT, 'assets', 'models');
const MANIFEST_PATH = path.join(ROOT, 'src', 'mt', 'onnx', 'it2-release-manifest.json');

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

function loadManifest() {
  const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!raw?.bundles?.['en-indic'] || !raw?.bundles?.['indic-en']) {
    throw new Error(`Invalid IT2 release manifest: ${MANIFEST_PATH}`);
  }
  return raw;
}

function pinMap(bundle) {
  const map = new Map();
  for (const f of bundle.files) {
    map.set(f.filename, f);
  }
  for (const name of ALLOW) {
    if (!map.has(name)) {
      throw new Error(`Manifest missing pin for ${bundle.repo}/${name}`);
    }
  }
  return map;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function verifyFile(filePath, pin, label) {
  const size = fs.statSync(filePath).size;
  if (pin.size > 0 && size !== pin.size) {
    throw new Error(
      `Size mismatch for ${label}: got ${size}, expected ${pin.size}`,
    );
  }
  const digest = sha256File(filePath);
  if (digest.toLowerCase() !== String(pin.sha256).toLowerCase()) {
    throw new Error(
      `SHA-256 mismatch for ${label}: got ${digest}, expected ${pin.sha256}`,
    );
  }
}

function complete(dir, pins) {
  return ALLOW.every((name) => {
    const p = path.join(dir, name);
    try {
      if (!fs.existsSync(p) || fs.statSync(p).size <= 0) return false;
      verifyFile(p, pins.get(name), `${dir}/${name}`);
      return true;
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

async function ensureBundle(bundleKey, bundle) {
  const dest = path.join(MODELS, bundle.folder);
  const pins = pinMap(bundle);
  if (complete(dest, pins)) {
    console.log(`[it2] OK cached ${bundle.folder} @ ${bundle.revision.slice(0, 12)}`);
    return;
  }
  await fs.promises.mkdir(dest, { recursive: true });
  console.log(
    `[it2] Downloading ${bundle.repo}@${bundle.revision.slice(0, 12)} → ${bundle.folder}`,
  );
  for (const fileName of ALLOW) {
    const out = path.join(dest, fileName);
    const pin = pins.get(fileName);
    if (fs.existsSync(out) && fs.statSync(out).size > 0) {
      try {
        verifyFile(out, pin, `${bundleKey}/${fileName}`);
        continue;
      } catch {
        await fs.promises.unlink(out);
      }
    }
    const url = `https://huggingface.co/${bundle.repo}/resolve/${bundle.revision}/${fileName}?download=true`;
    process.stdout.write(`  - ${fileName} ... `);
    await downloadFile(url, out);
    verifyFile(out, pin, `${bundleKey}/${fileName}`);
    console.log(`${(fs.statSync(out).size / (1024 * 1024)).toFixed(1)} MB`);
  }
  if (!complete(dest, pins)) {
    throw new Error(`Incomplete or mismatched bundle after download: ${bundle.folder}`);
  }
  console.log(`[it2] Done ${bundle.folder}`);
}

async function main() {
  const manifest = loadManifest();
  await fs.promises.mkdir(MODELS, { recursive: true });
  for (const key of ['en-indic', 'indic-en']) {
    await ensureBundle(key, manifest.bundles[key]);
  }
  console.log('[it2] ALL_DONE');
}

main().catch((err) => {
  console.error('[it2] FAILED', err);
  process.exit(1);
});
