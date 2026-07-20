/**
 * Neural translation engine interface (on-device).
 * Phrasebook remains the fallback until ONNX/IndicTrans2 weights are bundled.
 */
import {
  translateBySentences,
  translateOnDevice,
  type Direction,
  type Formality,
  type NepaliScript,
  type TranslateResult,
} from './onDeviceTranslate';

export type EngineState = 'idle' | 'loading' | 'ready' | 'translating' | 'error';

export type NeuralTranslateRequest = {
  id: number;
  text: string;
  preferred: Direction;
  formality: Formality;
  script: NepaliScript;
  /** Sentence-chunk when true (default). */
  bySentences?: boolean;
};

/**
 * Async façade matching the review-plan TranslationEngine.
 * Today: wraps sync phrasebook. Tomorrow: ONNX Runtime session + cancellation.
 */
export class TranslationEngine {
  private state: EngineState = 'ready';
  private seq = 0;
  private lastError: string | null = null;

  getState(): EngineState {
    return this.state;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async warmUp(): Promise<void> {
    // Placeholder for loading ONNX encoder/decoder once.
    this.state = 'ready';
  }

  async translate(
    req: Omit<NeuralTranslateRequest, 'id'>,
  ): Promise<TranslateResult & { requestId: number }> {
    const requestId = ++this.seq;
    this.state = 'translating';
    try {
      const fn = req.bySentences === false ? translateOnDevice : translateBySentences;
      const result = fn(req.text, req.preferred, {
        formality: req.formality,
        script: req.script,
      });
      if (requestId !== this.seq) {
        return { ...result, requestId };
      }
      this.state = 'ready';
      return { ...result, requestId };
    } catch (e) {
      this.state = 'error';
      this.lastError = e instanceof Error ? e.message : String(e);
      throw e;
    }
  }

  cancelAll(): void {
    this.seq += 1;
    this.state = 'ready';
  }
}

export const sharedTranslationEngine = new TranslationEngine();
