/**
 * On-device translation engine.
 * Prefers IndicTrans2 ONNX when warmed; phrasebook/lexicon remain fallback.
 */
import {
  detectDirection,
  formatNepaliScript,
  translateBySentences,
  translateOnDevice,
  type Direction,
  type Formality,
  type NepaliScript,
  type TranslateResult,
} from './onDeviceTranslate';
import { splitSentences } from './sentences';
import { romanToDevanagari } from './romanize';
import { sharedIndicTransOnnx } from './onnx/IndicTransOnnx';
import type { ModelDownloadProgress } from './onnx/modelAssets';

export type EngineState = 'idle' | 'loading' | 'ready' | 'translating' | 'error';

export type TranslateRequest = {
  text: string;
  preferred: Direction;
  formality: Formality;
  script: NepaliScript;
  /** Sentence-chunk when true (default). */
  bySentences?: boolean;
  /** Conversation mode: trust preferred direction. */
  forcePreferred?: boolean;
};

export type EngineTranslateResult = TranslateResult & {
  requestId: number;
  /** True when a newer translate/cancel superseded this request. */
  cancelled: boolean;
};

export class TranslationEngine {
  private state: EngineState = 'idle';
  private seq = 0;
  private lastError: string | null = null;
  private neuralReady = false;

  getState(): EngineState {
    return this.state;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  isNeuralReady(): boolean {
    return this.neuralReady;
  }

  /**
   * Download (if needed) + load ONNX sessions.
   * Soft-fails so the app stays usable on phrasebook alone.
   */
  async warmUp(
    onProgress?: (p: ModelDownloadProgress) => void,
  ): Promise<void> {
    this.state = 'loading';
    try {
      await sharedIndicTransOnnx.warmUp(onProgress);
      this.neuralReady = sharedIndicTransOnnx.isReady();
      this.state = 'ready';
      this.lastError = null;
    } catch (e) {
      this.neuralReady = false;
      this.state = 'ready';
      this.lastError = e instanceof Error ? e.message : String(e);
    }
  }

  async translate(req: TranslateRequest): Promise<EngineTranslateResult> {
    const requestId = ++this.seq;
    this.state = 'translating';
    try {
      const result =
        this.neuralReady && sharedIndicTransOnnx.isReady()
          ? await this.translateNeural(req)
          : this.translateFallback(req);

      const cancelled = requestId !== this.seq;
      if (!cancelled) this.state = 'ready';
      return { ...result, requestId, cancelled };
    } catch (e) {
      try {
        const fallback = this.translateFallback(req);
        const cancelled = requestId !== this.seq;
        if (!cancelled) this.state = 'ready';
        return { ...fallback, requestId, cancelled };
      } catch (inner) {
        this.state = 'error';
        this.lastError =
          inner instanceof Error ? inner.message : String(inner);
        throw inner;
      }
    }
  }

  private translateFallback(req: TranslateRequest): TranslateResult {
    const opts = {
      formality: req.formality,
      script: req.script,
      forcePreferred: req.forcePreferred,
    };
    const fn =
      req.bySentences === false ? translateOnDevice : translateBySentences;
    return fn(req.text, req.preferred, opts);
  }

  private async translateNeural(
    req: TranslateRequest,
  ): Promise<TranslateResult> {
    const raw = (req.text || '').trim();
    if (!raw) {
      return { text: '', method: 'neural', direction: req.preferred };
    }

    const direction = req.forcePreferred
      ? req.preferred
      : detectDirection(raw, req.preferred);

    // Exact phrasebook hits stay authoritative and cheap.
    const phrase = translateOnDevice(raw, direction, {
      formality: req.formality,
      script: req.script,
      forcePreferred: true,
    });
    if (phrase.method === 'phrase') {
      return phrase;
    }

    const bySentences = req.bySentences !== false;
    if (bySentences) {
      const { complete, remainder } = splitSentences(raw);
      const parts = remainder ? [...complete, remainder] : complete;
      if (parts.length > 1) {
        const out: string[] = [];
        let dir: Direction = direction;
        for (const part of parts) {
          const piece = await this.translateNeural({
            ...req,
            text: part,
            preferred: dir,
            bySentences: false,
            forcePreferred: true,
          });
          dir = piece.direction;
          if (piece.text.trim()) out.push(piece.text.trim());
        }
        return {
          text: out.join(' '),
          method: 'neural',
          direction: dir,
        };
      }
    }

    if (direction === 'ne-en') {
      // Model expects Devanagari; convert chat-style roman Nepali first.
      const hasDeva = /[\u0900-\u097F]/.test(raw);
      const devaText = hasDeva ? raw : romanToDevanagari(raw);
      const neuralText = await sharedIndicTransOnnx.translate({
        text: devaText,
        direction: 'ne-en',
        formality: req.formality,
      });
      if (!neuralText.trim()) {
        return translateOnDevice(raw, 'ne-en', {
          formality: req.formality,
          script: req.script,
          forcePreferred: true,
        });
      }
      return { text: neuralText.trim(), method: 'neural', direction: 'ne-en' };
    }

    const neuralText = await sharedIndicTransOnnx.translate({
      text: raw,
      direction: 'en-ne',
      formality: req.formality,
    });

    const out = formatNepaliScript(neuralText, req.script ?? 'deva');

    if (!out.trim()) {
      return translateOnDevice(raw, 'en-ne', {
        formality: req.formality,
        script: req.script,
        forcePreferred: true,
      });
    }

    return { text: out, method: 'neural', direction: 'en-ne' };
  }

  cancelAll(): void {
    this.seq += 1;
    if (this.state === 'translating') {
      this.state = 'ready';
    }
  }
}

export const sharedTranslationEngine = new TranslationEngine();
