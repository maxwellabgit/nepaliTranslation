/**
 * On-device translation engine.
 * English→Nepali uses the en-indic checkpoint. Nepali→English uses indic-en.
 */
import {
  detectDirection,
  formatNepaliScript,
  type Direction,
  type Formality,
  type NepaliScript,
  type TranslateResult,
} from './onDeviceTranslate';
import { matchTerminalPunctuation } from './terminalPunctuation';
import { splitSentences } from './sentences';
import { romanToDevanagari } from './romanize';
import { cleanTranslationText } from './cleanText';
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

  /** Resolves when the background NE→EN model load settles. */
  whenReverseSettled(): Promise<void> {
    return sharedIndicTransOnnx.whenIndicEnSettled();
  }

  /**
   * Download (if needed) + load both ONNX checkpoints.
   * A failed load leaves translation unavailable. There is no phrase list.
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
    const cleanedReq: TranslateRequest = {
      ...req,
      text: cleanTranslationText(req.text),
    };
    this.state = 'translating';
    try {
      if (!this.neuralReady || !sharedIndicTransOnnx.isReady()) {
        throw new Error(this.lastError ?? 'Translation model is not loaded');
      }
      const result = await this.translateNeural(cleanedReq);

      const cancelled = requestId !== this.seq;
      if (!cancelled) {
        this.state = 'ready';
      }
      return { ...result, requestId, cancelled };
    } catch (inner) {
      const cancelled = requestId !== this.seq;
      if (!cancelled) this.state = 'ready';
      this.lastError = inner instanceof Error ? inner.message : String(inner);
      throw inner;
    }
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
      return { text: matchTerminalPunctuation(raw, neuralText, 'ne-en', req.script), method: 'neural', direction: 'ne-en' };
    }

    const neuralText = await sharedIndicTransOnnx.translate({
      text: raw,
      direction: 'en-ne',
      formality: req.formality,
    });

    const out = formatNepaliScript(neuralText, req.script ?? 'deva');
    return { text: matchTerminalPunctuation(raw, out, 'en-ne', req.script), method: 'neural', direction: 'en-ne' };
  }

  cancelAll(): void {
    this.seq += 1;
    if (this.state === 'translating') {
      this.state = 'ready';
    }
  }
}

export const sharedTranslationEngine = new TranslationEngine();
