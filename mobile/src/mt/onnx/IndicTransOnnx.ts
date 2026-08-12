/**
 * IndicTrans2 ONNX greedy decode (encoder + decoder + decoder_with_past).
 * Port of Hari31416/indictrans2-onnx-export browser-lab + translate.py.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { File } from 'expo-file-system';

import type { Formality } from '../onDeviceTranslate';
import {
  ensureIt2Bundle,
  resolveModelDirectory,
  type It2DirectionBundle,
  type ModelDownloadProgress,
} from './modelAssets';
import { loadIt2Tokenizers, type It2TokenizerPair } from './loadTokenizers';

type TokenizerMeta = {
  src_dict_size: number;
  tgt_dict_size: number;
  unk_id: number;
};

type GenerationConfig = {
  decoder_start_token_id?: number;
  eos_token_id?: number;
};

type BundleSessions = {
  enc: InferenceSession;
  dec: InferenceSession;
  decPast: InferenceSession;
  numLayers: number;
  tokenizers: It2TokenizerPair;
  meta: TokenizerMeta;
  gen: GenerationConfig;
  root: string;
};

const MAX_NEW_TOKENS = 96;

function pastFeed(
  prevOutputs: Record<string, Tensor>,
  numLayers: number,
): Record<string, Tensor> {
  const feed: Record<string, Tensor> = {};
  for (let i = 0; i < numLayers; i++) {
    feed[`past_key_values.${i}.decoder.key`] =
      prevOutputs[`present.${i}.decoder.key`];
    feed[`past_key_values.${i}.decoder.value`] =
      prevOutputs[`present.${i}.decoder.value`];
    feed[`past_key_values.${i}.encoder.key`] =
      prevOutputs[`present.${i}.encoder.key`];
    feed[`past_key_values.${i}.encoder.value`] =
      prevOutputs[`present.${i}.encoder.value`];
  }
  return feed;
}

function argmaxLastLogits(logits: Tensor): number {
  const dims = logits.dims;
  const seqLen = dims[1] ?? 1;
  const vocabSize = dims[2] ?? dims[1];
  const data = logits.data as Float32Array | number[];
  const offset = (seqLen - 1) * vocabSize;
  let maxVal = -Infinity;
  let nextId = 0;
  for (let v = 0; v < vocabSize; v++) {
    const val = Number(data[offset + v]);
    if (val > maxVal) {
      maxVal = val;
      nextId = v;
    }
  }
  return nextId;
}

function int64Tensor(ids: number[], rank2Length: number): Tensor {
  return new Tensor(
    'int64',
    BigInt64Array.from(ids.map((n) => BigInt(n))),
    [1, rank2Length],
  );
}

async function readJson<T>(root: string, name: string): Promise<T> {
  const file = new File(root, name);
  return JSON.parse(await file.text()) as T;
}

async function loadBundle(kind: It2DirectionBundle): Promise<BundleSessions> {
  const dir = await resolveModelDirectory(kind);
  const root = dir.uri;

  const enc = await InferenceSession.create(
    new File(dir, 'encoder_model.onnx').uri,
  );
  const dec = await InferenceSession.create(
    new File(dir, 'decoder_model.onnx').uri,
  );
  const decPast = await InferenceSession.create(
    new File(dir, 'decoder_with_past_model.onnx').uri,
  );

  const numLayers = Math.floor((dec.outputNames.length - 1) / 4);
  if (numLayers < 1) {
    throw new Error(`Unexpected decoder outputs for ${kind}`);
  }

  const [tokenizers, meta, gen] = await Promise.all([
    loadIt2Tokenizers(kind),
    readJson<TokenizerMeta>(root, 'tokenizer_meta.json'),
    readJson<GenerationConfig>(root, 'generation_config.json'),
  ]);

  return { enc, dec, decPast, numLayers, tokenizers, meta, gen, root };
}

export class IndicTransOnnxEngine {
  private enIndic: BundleSessions | null = null;
  private indicEn: BundleSessions | null = null;
  private loading: Promise<void> | null = null;
  private indicEnLoading: Promise<void> | null = null;
  private ready = false;
  private lastError: string | null = null;
  private indicEnError: string | null = null;

  isReady(): boolean {
    return this.ready;
  }

  isDirectionReady(direction: 'en-ne' | 'ne-en'): boolean {
    return direction === 'en-ne' ? this.enIndic !== null : this.indicEn !== null;
  }

  /** Resolves when the background NE→EN load finishes (success or failure). */
  whenIndicEnSettled(): Promise<void> {
    return this.indicEnLoading ?? Promise.resolve();
  }

  getLastError(): string | null {
    return this.lastError ?? this.indicEnError;
  }

  async warmUp(
    onProgress?: (p: ModelDownloadProgress) => void,
  ): Promise<void> {
    if (this.ready) return;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        // EN→NE first: it unblocks the main translate surface fastest.
        await ensureIt2Bundle('en-indic', onProgress);
        this.enIndic = await loadBundle('en-indic');
        this.ready = true;
        this.lastError = null;
      } catch (e) {
        this.ready = false;
        this.enIndic = null;
        this.lastError = e instanceof Error ? e.message : String(e);
        throw e;
      } finally {
        this.loading = null;
      }

      // NE→EN loads behind readiness; ne-en requests await it below.
      this.startIndicEnLoad(onProgress);
    })();

    return this.loading;
  }

  private startIndicEnLoad(
    onProgress?: (p: ModelDownloadProgress) => void,
  ): Promise<void> {
    if (this.indicEn) return Promise.resolve();
    if (this.indicEnLoading) return this.indicEnLoading;
    this.indicEnLoading = (async () => {
      try {
        await ensureIt2Bundle('indic-en', onProgress);
        this.indicEn = await loadBundle('indic-en');
        this.indicEnError = null;
      } catch (e) {
        this.indicEn = null;
        this.indicEnError = e instanceof Error ? e.message : String(e);
      } finally {
        this.indicEnLoading = null;
      }
    })();
    return this.indicEnLoading;
  }

  async translate(opts: {
    text: string;
    direction: 'en-ne' | 'ne-en';
    formality: Formality;
    maxNewTokens?: number;
  }): Promise<string> {
    if (!this.ready) {
      throw new Error('IndicTrans ONNX engine is not ready');
    }

    const raw = opts.text.trim();
    if (!raw) return '';

    if (opts.direction === 'ne-en') {
      if (!this.indicEn) {
        await this.startIndicEnLoad();
      }
      if (!this.indicEn) {
        throw new Error(
          this.indicEnError ?? 'NE→EN model unavailable; use phrasebook',
        );
      }
      return this.generate(
        this.indicEn,
        raw,
        'npi_Deva',
        'eng_Latn',
        opts.maxNewTokens,
      );
    }

    if (!this.enIndic) {
      throw new Error('IndicTrans ONNX engine is not ready');
    }
    const tag = opts.formality === 'informal' ? '<informal>' : '<formal>';
    const body = `${tag} ${raw}`;

    return this.generate(
      this.enIndic,
      body,
      'eng_Latn',
      'npi_Deva',
      opts.maxNewTokens,
    );
  }

  private async generate(
    bundle: BundleSessions,
    text: string,
    srcLang: string,
    tgtLang: string,
    maxNewTokens = MAX_NEW_TOKENS,
  ): Promise<string> {
    const { src, tgt } = bundle.tokenizers;
    const { meta, gen } = bundle;

    const srcLangEnc = src.encode(srcLang, { add_special_tokens: false });
    const tgtLangEnc = src.encode(tgtLang, { add_special_tokens: false });
    const srcLangId = Number(srcLangEnc.ids[0]);
    const tgtLangId = Number(tgtLangEnc.ids[0]);

    const prepared = text.startsWith(' ') ? text : ` ${text}`;
    const textEnc = src.encode(prepared);
    const textIds = Array.from(textEnc.ids).map(Number);
    const textMask = Array.from(textEnc.attention_mask).map(Number);

    const safeInputIds = [srcLangId, tgtLangId, ...textIds].map((id) =>
      id < meta.src_dict_size ? id : meta.unk_id,
    );
    const attnMaskArray = [1, 1, ...textMask];

    const inputIdsTensor = int64Tensor(safeInputIds, safeInputIds.length);
    const attnMaskTensor = int64Tensor(attnMaskArray, attnMaskArray.length);

    const encOut = await bundle.enc.run({
      input_ids: inputIdsTensor,
      attention_mask: attnMaskTensor,
    });
    const encHiddenState =
      encOut.last_hidden_state ?? encOut[bundle.enc.outputNames[0]];

    const decoderStartId = gen.decoder_start_token_id ?? 2;
    const eosId = gen.eos_token_id ?? 2;

    let decoderInputIds = int64Tensor([decoderStartId], 1);
    const outputIds = [decoderStartId];
    let pastOutputs: Record<string, Tensor> | null = null;

    for (let step = 0; step < maxNewTokens; step++) {
      let decOut: Record<string, Tensor>;
      if (step === 0) {
        decOut = await bundle.dec.run({
          input_ids: decoderInputIds,
          encoder_hidden_states: encHiddenState,
          encoder_attention_mask: attnMaskTensor,
        });
      } else {
        decOut = await bundle.decPast.run({
          input_ids: decoderInputIds,
          encoder_attention_mask: attnMaskTensor,
          ...pastFeed(pastOutputs!, bundle.numLayers),
        });
      }

      const logits = decOut.logits ?? decOut[bundle.dec.outputNames[0]];
      pastOutputs = decOut;
      const nextId = argmaxLastLogits(logits);
      outputIds.push(nextId);

      if (nextId === eosId) break;
      decoderInputIds = int64Tensor([nextId], 1);
    }

    const safeOutputIds = outputIds.map((id) =>
      id < meta.tgt_dict_size ? id : meta.unk_id,
    );
    const decoded = tgt.decode(safeOutputIds, { skip_special_tokens: true });
    return String(decoded).trim();
  }
}

export const sharedIndicTransOnnx = new IndicTransOnnxEngine();
