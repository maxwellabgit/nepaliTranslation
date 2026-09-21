import type { OcrBlock, OcrDocument, OcrFrame } from './ocrTypes';

const DEVANAGARI = /[\u0900-\u097F]/;
const SAME_TEXT_OVERLAP = 0.25;
const HIGH_OVERLAP = 0.65;

export function normalizeOcrText(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

function frameArea(frame: OcrFrame): number {
  return Math.max(0, frame.width) * Math.max(0, frame.height);
}

/** Intersection-over-union for axis-aligned OCR frames. */
export function frameIoU(a: OcrFrame, b: OcrFrame): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  const w = Math.max(0, x1 - x0);
  const h = Math.max(0, y1 - y0);
  const inter = w * h;
  if (inter <= 0) return 0;
  const union = frameArea(a) + frameArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

function preferBlock(a: OcrBlock, b: OcrBlock): OcrBlock {
  const aNe = DEVANAGARI.test(a.text);
  const bNe = DEVANAGARI.test(b.text);
  if (aNe !== bNe) return aNe ? a : b;
  const ac = a.confidence ?? -1;
  const bc = b.confidence ?? -1;
  if (ac !== bc) return ac >= bc ? a : b;
  if (a.language !== b.language) {
    if (a.language === 'ne') return a;
    if (b.language === 'ne') return b;
  }
  return a.text.length >= b.text.length ? a : b;
}

function shouldMerge(a: OcrBlock, b: OcrBlock): boolean {
  const overlap = frameIoU(a.frame, b.frame);
  if (overlap >= HIGH_OVERLAP) return true;
  const sameText =
    normalizeOcrText(a.text).length > 0 &&
    normalizeOcrText(a.text) === normalizeOcrText(b.text);
  return sameText && overlap >= SAME_TEXT_OVERLAP;
}

/**
 * Merge Latin+Devanagari duplicate blocks before sentence segmentation.
 * Keeps one block per overlapping cluster (prefers Devanagari / higher confidence).
 */
export function dedupeOcrDocument(doc: OcrDocument): OcrDocument {
  const blocks = doc.blocks;
  if (blocks.length < 2) return doc;

  const keep = blocks.map(() => true);
  for (let i = 0; i < blocks.length; i += 1) {
    if (!keep[i]) continue;
    for (let j = i + 1; j < blocks.length; j += 1) {
      if (!keep[j]) continue;
      if (!shouldMerge(blocks[i], blocks[j])) continue;
      const winner = preferBlock(blocks[i], blocks[j]);
      if (winner === blocks[i]) {
        keep[j] = false;
      } else {
        keep[i] = false;
        break;
      }
    }
  }

  return {
    ...doc,
    blocks: blocks.filter((_, index) => keep[index]),
  };
}
