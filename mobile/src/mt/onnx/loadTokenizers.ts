/**
 * Load HF fast tokenizers from IndicTrans2 ONNX bundle JSON files.
 * Uses pure JS @huggingface/tokenizers (no sharp / native deps).
 */
import { Tokenizer } from '@huggingface/tokenizers';
import { File } from 'expo-file-system';

import type { It2DirectionBundle } from './modelAssets';
import { resolveModelDirectory } from './modelAssets';

export type It2TokenizerPair = {
  src: Tokenizer;
  tgt: Tokenizer;
};

const DEFAULT_TOK_CONFIG = { tokenizer_class: 'PreTrainedTokenizerFast' };

async function loadTokenizerFromBundle(
  bundleKind: It2DirectionBundle,
  fileName: 'tokenizer_src.json' | 'tokenizer_tgt.json',
): Promise<Tokenizer> {
  const bundle = await resolveModelDirectory(bundleKind);
  const tokFile = new File(bundle, fileName);
  const configFile = new File(bundle, 'tokenizer_config.json');
  const tokenizerJson = JSON.parse(await tokFile.text()) as object;
  const tokenizerConfig = configFile.exists
    ? (JSON.parse(await configFile.text()) as object)
    : DEFAULT_TOK_CONFIG;
  return new Tokenizer(tokenizerJson, tokenizerConfig);
}

export async function loadIt2Tokenizers(
  kind: It2DirectionBundle,
): Promise<It2TokenizerPair> {
  const [src, tgt] = await Promise.all([
    loadTokenizerFromBundle(kind, 'tokenizer_src.json'),
    loadTokenizerFromBundle(kind, 'tokenizer_tgt.json'),
  ]);
  return { src, tgt };
}
