/**
 * Web stub. IndicTrans2 ONNX is native-only; the manual web test uses the phrase/lexicon path.
 */
export class IndicTransOnnxEngine {
  isReady(): boolean {
    return false;
  }

  isDirectionReady(): boolean {
    return false;
  }

  whenIndicEnSettled(): Promise<void> {
    return Promise.resolve();
  }

  getLastError(): string | null {
    return 'ONNX is not available in the browser test.';
  }

  async warmUp(): Promise<void> {
    return undefined;
  }

  async translate(): Promise<string> {
    return '';
  }
}

export const sharedIndicTransOnnx = new IndicTransOnnxEngine();
