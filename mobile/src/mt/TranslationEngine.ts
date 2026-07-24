/**
 * Phrasebook translation façade.
 * ONNX/IndicTrans2 is not wired in this traveler build — translate() always
 * runs the on-device phrasebook + lexicon path.
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

export type TranslateRequest = {
  text: string;
  preferred: Direction;
  formality: Formality;
  script: NepaliScript;
  /** Sentence-chunk when true (default). */
  bySentences?: boolean;
};

export type EngineTranslateResult = TranslateResult & {
  requestId: number;
  /** True when a newer translate/cancel superseded this request. */
  cancelled: boolean;
};

/**
 * Async façade for UI. Today: sync phrasebook. Sequence ids let callers
 * ignore stale results when chips / STT fire rapidly.
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
    this.state = 'ready';
  }

  async translate(req: TranslateRequest): Promise<EngineTranslateResult> {
    const requestId = ++this.seq;
    this.state = 'translating';
    try {
      const fn = req.bySentences === false ? translateOnDevice : translateBySentences;
      const result = fn(req.text, req.preferred, {
        formality: req.formality,
        script: req.script,
      });
      const cancelled = requestId !== this.seq;
      if (!cancelled) this.state = 'ready';
      return { ...result, requestId, cancelled };
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
