import type { OcrDocument } from './ocrTypes';

/**
 * Production iOS OCR. Latin + Devanagari via the on-device ML Kit module.
 * The web testing-ground override is `recognizeCapture.web.ts`.
 */
export async function recognizeCapture(uri: string): Promise<OcrDocument> {
  const mod = await import('neptranslate-ocr');
  return mod.recognizeText(uri);
}
