#!/usr/bin/env node
/**
 * Lightweight CI check: IT2 release manifest is well-formed and pins look valid.
 * Does not download weights (gitignored). If local model files exist under
 * assets/models/, optionally verifies SHA-256 when VERIFY_MODEL_FILES=1.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'src', 'mt', 'onnx', 'it2-release-manifest.json');
const MODELS = path.join(ROOT, 'assets', 'models');
const SHA256_RE = /^[a-f0-9]{64}$/i;
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

function fail(msg) {
  console.error(`model-hash-check: ${msg}`);
  process.exit(1);
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

if (!fs.existsSync(MANIFEST_PATH)) {
  fail(`missing manifest at ${MANIFEST_PATH}`);
}

const raw = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
if (!raw?.bundles?.['en-indic'] || !raw?.bundles?.['indic-en']) {
  fail('manifest missing en-indic or indic-en bundles');
}

let fileCount = 0;
for (const [name, bundle] of Object.entries(raw.bundles)) {
  if (!bundle.revision || typeof bundle.revision !== 'string') {
    fail(`bundle ${name} missing revision`);
  }
  if (!Array.isArray(bundle.files) || bundle.files.length === 0) {
    fail(`bundle ${name} has no files`);
  }
  const names = new Set(bundle.files.map((f) => f.filename));
  for (const required of ALLOW) {
    if (!names.has(required)) {
      fail(`bundle ${name} missing pin for ${required}`);
    }
  }
  for (const f of bundle.files) {
    if (!SHA256_RE.test(String(f.sha256 || ''))) {
      fail(`bundle ${name} file ${f.filename} has invalid sha256`);
    }
    if (typeof f.size !== 'number' || f.size < 0) {
      fail(`bundle ${name} file ${f.filename} has invalid size`);
    }
    fileCount += 1;

    if (process.env.VERIFY_MODEL_FILES === '1') {
      const local = path.join(MODELS, bundle.folder, f.filename);
      if (!fs.existsSync(local)) {
        console.warn(`model-hash-check: skip missing file ${local}`);
        continue;
      }
      const digest = sha256File(local);
      if (digest.toLowerCase() !== String(f.sha256).toLowerCase()) {
        fail(`SHA-256 mismatch for ${local}`);
      }
      const size = fs.statSync(local).size;
      if (f.size > 0 && size !== f.size) {
        fail(`size mismatch for ${local}`);
      }
    }
  }
}

console.log(
  `model-hash-check: ok (${fileCount} pins, schemaVersion=${raw.schemaVersion ?? '?'})`,
);
