import type { OcrDocument } from './ocrTypes';

/** Test-only capture. Production never sets this. */
let fixture: OcrDocument | null = null;

export function setCameraTestFixture(doc: OcrDocument | null): void {
  fixture = doc;
}

export function getCameraTestFixture(): OcrDocument | null {
  return fixture;
}

/**
 * Testing-ground file that should run through the same post-capture pipeline.
 * Production never sets this. It is not an OCR or translation answer.
 */
let captureSourceUri: string | null = null;

export function setTestingGroundCaptureUri(uri: string | null): void {
  captureSourceUri = uri;
}

export function getTestingGroundCaptureUri(): string | null {
  return captureSourceUri;
}
