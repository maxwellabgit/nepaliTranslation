/**
 * Resolve / fetch IndicTrans2 ONNX bundles onto the device.
 *
 * Resolution order:
 * 1. Already cached under documentDirectory/models/
 * 2. Copy from Paths.bundle/models/ when the IPA/APK bundled them
 * 3. Download INT8 dist-200M graphs from Hugging Face (once)
 */
import { Directory, File, Paths } from 'expo-file-system';

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

function modelsRoot(): Directory {
  return new Directory(Paths.document, 'models');
}

export function bundleDirectory(kind: It2DirectionBundle): Directory {
  return new Directory(modelsRoot(), DIR_NAME[kind]);
}

export function bundlePath(kind: It2DirectionBundle): string {
  return bundleDirectory(kind).uri;
}

function fileInBundle(kind: It2DirectionBundle, name: string): File {
  return new File(bundleDirectory(kind), name);
}

export async function bundleIsComplete(kind: It2DirectionBundle): Promise<boolean> {
  const dir = bundleDirectory(kind);
  if (!dir.exists) return false;
  for (const name of IT2_REQUIRED_FILES) {
    const f = fileInBundle(kind, name);
    if (!f.exists || f.size <= 0) return false;
  }
  return true;
}

export async function neuralAssetsAvailable(): Promise<boolean> {
  return (
    (await bundleIsComplete('en-indic')) && (await bundleIsComplete('indic-en'))
  );
}

function hfResolveUrl(repo: string, fileName: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${fileName}`;
}

async function trySeedFromBundle(kind: It2DirectionBundle): Promise<boolean> {
  const bundled = new Directory(Paths.bundle, 'models', DIR_NAME[kind]);
  if (!bundled.exists) return false;

  const dest = bundleDirectory(kind);
  if (!dest.exists) {
    dest.create({ intermediates: true, idempotent: true });
  }

  for (const name of IT2_REQUIRED_FILES) {
    const src = new File(bundled, name);
    if (!src.exists || src.size <= 0) return false;
    const target = fileInBundle(kind, name);
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
};

/**
 * Ensure both EN↔NE INT8 bundles exist under documentDirectory/models/.
 */
export async function ensureIt2OnnxBundles(
  onProgress?: (p: ModelDownloadProgress) => void,
): Promise<{ enIndic: string; indicEn: string }> {
  const root = modelsRoot();
  if (!root.exists) {
    root.create({ intermediates: true, idempotent: true });
  }

  for (const kind of ['en-indic', 'indic-en'] as It2DirectionBundle[]) {
    if (await bundleIsComplete(kind)) continue;
    if (await trySeedFromBundle(kind)) continue;

    const dir = bundleDirectory(kind);
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }

    const repo = IT2_HF_REPOS[kind];
    const total = IT2_REQUIRED_FILES.length;
    for (let i = 0; i < IT2_REQUIRED_FILES.length; i++) {
      const fileName = IT2_REQUIRED_FILES[i];
      const dest = fileInBundle(kind, fileName);
      if (dest.exists && dest.size > 0) continue;

      onProgress?.({ kind, fileName, index: i + 1, total });
      const url = hfResolveUrl(repo, fileName);
      const downloaded = await File.downloadFileAsync(url, dest, {
        idempotent: true,
      });
      if (!downloaded.exists || downloaded.size <= 0) {
        throw new Error(`Failed to download ${repo}/${fileName}`);
      }
    }

    if (!(await bundleIsComplete(kind))) {
      throw new Error(`Incomplete ONNX bundle after download: ${kind}`);
    }
  }

  return {
    enIndic: bundlePath('en-indic'),
    indicEn: bundlePath('indic-en'),
  };
}
