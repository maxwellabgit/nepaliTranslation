/**
 * Resolve IndicTrans2 ONNX bundles for on-device inference.
 *
 * Order:
 * 1. Packaged with the IPA/APK under Paths.bundle/models/ (preferred — no wait)
 * 2. Already copied under documentDirectory/models/
 * 3. Seed documents from the packaged bundle (offline copy)
 * 4. Last resort: download INT8 graphs from Hugging Face
 */
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

export type It2DirectionBundle = 'en-indic' | 'indic-en';

export const IT2_HF_REPOS: Record<It2DirectionBundle, string> = {
  'en-indic': 'hari31416/indictrans2-en-indic-dist-200M-ONNX-int8',
  'indic-en': 'hari31416/indictrans2-indic-en-dist-200M-ONNX-int8',
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
  'en-indic': 'it2_en_indic',
  'indic-en': 'it2_indic_en',
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

function hfResolveUrl(repo: string, fileName: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${fileName}?download=true`;
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

  const repo = IT2_HF_REPOS[kind];
  const total = IT2_REQUIRED_FILES.length;
  for (let i = 0; i < IT2_REQUIRED_FILES.length; i++) {
    const fileName = IT2_REQUIRED_FILES[i];
    const dest = fileIn(dir, fileName);
    if (dest.exists && dest.size > 0) continue;

    onProgress?.({
      kind,
      fileName,
      index: i + 1,
      total,
      phase: 'download',
    });
    const url = hfResolveUrl(repo, fileName);
    const downloaded = await File.downloadFileAsync(url, dest, {
      idempotent: true,
    });
    if (!downloaded.exists || downloaded.size <= 0) {
      throw new Error(
        `Model not bundled and download failed for ${repo}/${fileName}`,
      );
    }
  }

  if (!(await bundleIsComplete(kind))) {
    throw new Error(`Incomplete ONNX bundle: ${kind}`);
  }
}

