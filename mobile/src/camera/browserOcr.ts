import { PSM } from 'tesseract.js';
import { tesseractPageToOcrDocument, type TesseractPage } from './browserOcrMap';
import type { OcrDocument } from './ocrTypes';

type TessWorker = {
  recognize: (image: string | Blob) => Promise<{ data: TesseractPage }>;
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
 * Read the captured photo at its upright size.
 * `createImageBitmap` applies EXIF, then the canvas bakes that orientation
 * into pixels. Tesseract ignores EXIF, so handing it the original file
 * returns tall strips for lines that are horizontal on screen.
 * Do not enlarge a small webcam still; a blurred page comes back empty.
 */
async function prepareImage(uri: string): Promise<{
  source: string;
  width: number;
  height: number;
  recognizedWidth: number;
  recognizedHeight: number;
}> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`capture_unreadable:${response.status}`);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const width = bitmap.width;
  const height = bitmap.height;
  if (width <= 0 || height <= 0) {
    bitmap.close();
    throw new Error('capture_empty');
  }
  // Small captures lose short lines. Recognize a larger bitmap and map
  // boxes back onto the original upright pixels. The file itself is unchanged.
  const shortEdge = Math.min(width, height);
  const scale = shortEdge > 0 && shortEdge < 1000 ? Math.min(3, 1000 / shortEdge) : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('capture_unreadable');
  }
  context.imageSmoothingEnabled = true;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    source: canvas.toDataURL('image/png'),
    width,
    height,
    recognizedWidth: canvas.width,
    recognizedHeight: canvas.height,
  };
}

/** Recognize text in a photo that has already been captured. */
export async function recognizeBrowserOcr(uri: string): Promise<OcrDocument> {
  const [prepared, worker] = await Promise.all([prepareImage(uri), localWorker()]);
  const result = await worker.recognize(prepared.source);
  // Word boxes are in the bitmap Tesseract saw. That bitmap may be larger
  // than the upright photo. Map them back onto the photo.
  return tesseractPageToOcrDocument(
    {
      ...result.data,
      width: prepared.recognizedWidth,
      height: prepared.recognizedHeight,
    },
    { width: prepared.width, height: prepared.height },
  );
}
