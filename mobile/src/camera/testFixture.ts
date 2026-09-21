import type { OcrDocument } from './ocrTypes';

/** Test-only capture. Production never sets this. */
let fixture: OcrDocument | null = null;

export function setCameraTestFixture(doc: OcrDocument | null): void {
  fixture = doc;
}

export function getCameraTestFixture(): OcrDocument | null {
  return fixture;
}
