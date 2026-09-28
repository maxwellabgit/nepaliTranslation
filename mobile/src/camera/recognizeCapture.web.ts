import type { OcrDocument } from './ocrTypes';
import { recognizeBrowserOcr } from './browserOcr';

/** Web override. Production iOS keeps `recognizeCapture.ts` → ML Kit. */
export function recognizeCapture(uri: string): Promise<OcrDocument> {
  return recognizeBrowserOcr(uri);
}
