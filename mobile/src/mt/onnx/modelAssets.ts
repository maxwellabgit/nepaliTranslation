/**
 * Resolve IndicTrans2 ONNX bundles for on-device inference.
 *
 * Order:
 * 1. Packaged with the IPA/APK under Paths.bundle/models/ (preferred — no wait)
 * 2. Already copied under documentDirectory/models/
 * 3. Seed documents from the packaged bundle (offline copy)
 * 4. Last resort: download INT8 graphs from Hugging Face (pinned revision + SHA-256)
 */
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import releaseManifest from './it2-release-manifest.json';

export type It2DirectionBundle = 'en-indic' | 'indic-en';

export type It2PinnedFile = {
  filename: string;
  size: number;
  sha256: string;
};

export type It2BundlePin = {
  folder: string;
  repo: string;
  revision: string;
  files: It2PinnedFile[];
};

export const IT2_RELEASE_MANIFEST = releaseManifest as {
  schemaVersion: number;
  family: string;
  bundles: Record<It2DirectionBundle, It2BundlePin>;
};

export const IT2_HF_REPOS: Record<It2DirectionBundle, string> = {
  'en-indic': IT2_RELEASE_MANIFEST.bundles['en-indic'].repo,
  'indic-en': IT2_RELEASE_MANIFEST.bundles['indic-en'].repo,
};

export const IT2_REQUIRED_FILES = [
  'encoder_model.onnx',
  'encoder_model.onnx.data',
  'decoder_model.onnx',
  'decoder_with_past_model.onnx',
  'decoder_shared.onnx.data',
  'tokenizer_src.json',
  'tokenizer_tgt.json',
  'tokenizer_meta.json',
  'generation_config.json',
] as const;

const DIR_NAME: Record<It2DirectionBundle, string> = {
  'en-indic': IT2_RELEASE_MANIFEST.bundles['en-indic'].folder,
  'indic-en': IT2_RELEASE_MANIFEST.bundles['indic-en'].folder,
};

/** Writable cache used by ORT on both platforms. */
function cacheRoot(): Directory {
  return new Directory(Paths.document, 'models');
}

export function bundleDirectory(kind: It2DirectionBundle): Directory {
  return new Directory(cacheRoot(), DIR_NAME[kind]);
}

export function bundlePath(kind: It2DirectionBundle): string {
  return bundleDirectory(kind).uri;
}

/** Models packed into the native app by plugins/withIt2Models.js */
function packagedDirectory(kind: It2DirectionBundle): Directory {
  return new Directory(Paths.bundle, 'models', DIR_NAME[kind]);
}

function fileIn(dir: Directory, name: string): File {
  return new File(dir, name);
}

function pinFor(kind: It2DirectionBundle, fileName: string): It2PinnedFile {
  const pin = IT2_RELEASE_MANIFEST.bundles[kind].files.find(
    (f) => f.filename === fileName,
  );
  if (!pin) {
    throw new Error(`Missing IT2 pin for ${kind}/${fileName}`);
  }
  return pin;
}

function bytesToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/** SHA-256 hex of a local file (content integrity for pinned downloads). */
export async function sha256File(file: File): Promise<string> {
  const bytes = await file.bytes();
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  return bytesToHex(digest);
}

export async function verifyPinnedFile(
  kind: It2DirectionBundle,
  file: File,
  fileName: string,
): Promise<void> {
  const pin = pinFor(kind, fileName);
  if (!file.exists || file.size <= 0) {
    throw new Error(`Missing model file: ${kind}/${fileName}`);
  }
  if (pin.size > 0 && file.size !== pin.size) {
    throw new Error(
      `Size mismatch for ${kind}/${fileName}: got ${file.size}, expected ${pin.size}`,
    );
  }
  const hash = await sha256File(file);
  if (hash.toLowerCase() !== pin.sha256.toLowerCase()) {
    throw new Error(
      `SHA-256 mismatch for ${kind}/${fileName}: got ${hash}, expected ${pin.sha256}`,
    );
  }
}

async function dirIsComplete(dir: Directory): Promise<boolean> {
  if (!dir.exists) return false;
  for (const name of IT2_REQUIRED_FILES) {
    const f = fileIn(dir, name);
    if (!f.exists || f.size <= 0) return false;
  }
  return true;
}

export async function bundleIsComplete(kind: It2DirectionBundle): Promise<boolean> {
  return dirIsComplete(bundleDirectory(kind));
}

export async function packagedIsComplete(kind: It2DirectionBundle): Promise<boolean> {
  try {
    return await dirIsComplete(packagedDirectory(kind));
  } catch {
    return false;
  }
}

/**
 * Directory ORT should load from for this direction.
 * Prefer packaged iOS bundle paths; on Android prefer documents cache
 * (ORT needs a real filesystem path for external .onnx.data sidecars).
 */
export async function resolveModelDirectory(
  kind: It2DirectionBundle,
): Promise<Directory> {
  if (Platform.OS === 'ios' && (await packagedIsComplete(kind))) {
    return packagedDirectory(kind);
  }
  if (await bundleIsComplete(kind)) {
    return bundleDirectory(kind);
  }
  if (await trySeedFromPackage(kind)) {
    return bundleDirectory(kind);
  }
  throw new Error(`ONNX bundle not available for ${kind}`);
}

export function hfResolveUrl(repo: string, revision: string, fileName: string): string {
  return `https://huggingface.co/${repo}/resolve/${revision}/${fileName}?download=true`;
}

async function trySeedFromPackage(kind: It2DirectionBundle): Promise<boolean> {
  const packaged = packagedDirectory(kind);
  if (!(await dirIsComplete(packaged))) return false;

  const dest = bundleDirectory(kind);
  if (!dest.exists) {
    dest.create({ intermediates: true, idempotent: true });
  }

  for (const name of IT2_REQUIRED_FILES) {
    const src = fileIn(packaged, name);
    const target = fileIn(dest, name);
    if (target.exists && target.size > 0) continue;
    await src.copy(target);
  }
  return bundleIsComplete(kind);
}

export type ModelDownloadProgress = {
  kind: It2DirectionBundle;
  fileName: string;
  index: number;
  total: number;
  phase: 'packaged' | 'cache' | 'download';
};

/**
 * Ensure one direction's INT8 bundle is usable by ORT.
 * Packaged IPA/APK models win — no network. Falls back to a Hugging Face
 * download only when the binary was built without bundled models.
 * Downloads are pinned to an immutable revision and verified by SHA-256.
 */
export async function ensureIt2Bundle(
  kind: It2DirectionBundle,
  onProgress?: (p: ModelDownloadProgress) => void,
): Promise<void> {
  const root = cacheRoot();
  if (!root.exists) {
    root.create({ intermediates: true, idempotent: true });
  }

  // Fast path: already usable from package (iOS) or cache.
  if (Platform.OS === 'ios' && (await packagedIsComplete(kind))) {
    onProgress?.({
      kind,
      fileName: DIR_NAME[kind],
      index: 1,
      total: 1,
      phase: 'packaged',
    });
    return;
  }
  if (await bundleIsComplete(kind)) {
    onProgress?.({
      kind,
      fileName: DIR_NAME[kind],
      index: 1,
      total: 1,
      phase: 'cache',
    });
    return;
  }
  if (await trySeedFromPackage(kind)) {
    onProgress?.({
      kind,
      fileName: DIR_NAME[kind],
      index: 1,
      total: 1,
      phase: 'packaged',
    });
    return;
  }

  const dir = bundleDirectory(kind);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const bundle = IT2_RELEASE_MANIFEST.bundles[kind];
  const total = IT2_REQUIRED_FILES.length;
  for (let i = 0; i < IT2_REQUIRED_FILES.length; i++) {
    const fileName = IT2_REQUIRED_FILES[i]!;
    const dest = fileIn(dir, fileName);
    if (dest.exists && dest.size > 0) {
      try {
        await verifyPinnedFile(kind, dest, fileName);
        continue;
      } catch {
        try {
          dest.delete();
        } catch {
          /* soft-fail delete before re-download */
        }
      }
    }

    onProgress?.({
      kind,
      fileName,
      index: i + 1,
      total,
      phase: 'download',
    });
    const url = hfResolveUrl(bundle.repo, bundle.revision, fileName);
    const downloaded = await File.downloadFileAsync(url, dest, {
      idempotent: true,
    });
    if (!downloaded.exists || downloaded.size <= 0) {
      throw new Error(
        `Model not bundled and download failed for ${bundle.repo}@${bundle.revision}/${fileName}`,
      );
    }
    await verifyPinnedFile(kind, downloaded, fileName);
  }

  if (!(await bundleIsComplete(kind))) {
    throw new Error(`Incomplete ONNX bundle: ${kind}`);
  }
}
