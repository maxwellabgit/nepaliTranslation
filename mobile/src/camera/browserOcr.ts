import { PSM } from 'tesseract.js';
import { tesseractPageToOcrDocument, type TesseractPage } from './browserOcrMap';
import type { OcrDocument } from './ocrTypes';

type TessWorker = {
  recognize: (image: string) => Promise<{ data: TesseractPage }>;
  setParameters: (params: Record<string, string>) => Promise<void>;
};

let workerPromise: Promise<TessWorker> | null = null;

/**
 * Browser-only OCR for the Windows testing ground.
 * The still is decoded in this page and posted to a local Tesseract worker.
 * Language files may download once. The capture itself is not uploaded.
 */
async function localWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng+nep');
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      return worker as unknown as TessWorker;
    })().catch((err: unknown) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

/**
 * Read the captured photo at its real size.
 * Enlarging a 640×480 webcam still blurs the screen text and the reader
 * returns a blank page. A data URL is required; a Blob is rejected.
 */
async function prepareImage(
  uri: string,
): Promise<{ source: string; width: number; height: number }> {
  if (uri.startsWith('data:')) {
    const bitmap = await createImageBitmap(await (await fetch(uri)).blob());
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    if (size.width <= 0 || size.height <= 0) throw new Error('capture_empty');
    return { source: uri, ...size };
  }
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`capture_unreadable:${response.status}`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;
  if (width <= 0 || height <= 0) {
    bitmap.close();
    throw new Error('capture_empty');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('capture_unreadable');
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { source: canvas.toDataURL('image/png'), width, height };
}

/** Recognize text in a photo that has already been captured. */
export async function recognizeBrowserOcr(uri: string): Promise<OcrDocument> {
  const [{ source, width, height }, worker] = await Promise.all([
    prepareImage(uri),
    localWorker(),
  ]);
  const result = await worker.recognize(source);
  return tesseractPageToOcrDocument(result.data, { width, height });
}
