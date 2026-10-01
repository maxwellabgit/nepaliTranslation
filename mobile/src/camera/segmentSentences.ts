import type { OcrDocument, OcrLine, SourceSentence } from './ocrTypes';
import { sortReadingOrder } from './readingOrder';

const DEVANAGARI = /[\u0900-\u097F]/;
const LOW_CONFIDENCE = 0.5;
/** Distant signs are a small slice of the frame. Foreground text is not. */
export const MIN_TEXT_HEIGHT_RATIO = 0.02;

export type SegmentResult =
  | { ok: true; sentences: SourceSentence[]; language: 'en' | 'ne' }
  | { ok: false; reason: 'empty' | 'low-confidence' };

function lineLanguage(text: string): 'en' | 'ne' {
  const dev = (text.match(DEVANAGARI) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return dev > lat ? 'ne' : 'en';
}

/** At least two letters. A speck or a single noise glyph is not a line. */
function lineReadable(text: string): boolean {
  const letters = text.match(/[\u0900-\u097FA-Za-z]/gu);
  return (letters?.length ?? 0) >= 2;
}

function lineLargeEnough(line: OcrLine, doc: OcrDocument): boolean {
  const shorter = Math.min(doc.width, doc.height);
  if (!(shorter > 0) || !(line.frame.height > 0)) return false;
  return line.frame.height >= shorter * MIN_TEXT_HEIGHT_RATIO;
}

/**
 * A line needs a real box on the photo. Unknown confidence is not enough.
 * Do not reject short signs by character count.
 */
function lineGeometryOk(line: OcrLine, doc: OcrDocument): boolean {
  const { x, y, width, height } = line.frame;
  if (![x, y, width, height, doc.width, doc.height].every(Number.isFinite)) return false;
  if (width <= 0 || height <= 0 || doc.width <= 0 || doc.height <= 0) return false;
  if (width * height >= doc.width * doc.height * 0.9) return false;
  const overlapW = Math.min(doc.width, x + width) - Math.max(0, x);
  const overlapH = Math.min(doc.height, y + height) - Math.max(0, y);
  return overlapW > 0 && overlapH > 0;
}

/** One camera highlight per foreground line, in reading order. */
export function segmentOcr(doc: OcrDocument): SegmentResult {
  const lines = sortReadingOrder(doc.blocks.flatMap((block) => block.lines));
  const readable = lines.filter((line) => lineReadable(line.text));
  if (!readable.length) return { ok: false, reason: 'empty' };

  const foreground = readable.filter(
    (line) => lineGeometryOk(line, doc) && lineLargeEnough(line, doc),
  );
  if (!foreground.length) return { ok: false, reason: 'empty' };

  const usable = foreground.filter((line) => {
    if (typeof line.confidence === 'number' && Number.isFinite(line.confidence)) {
      return line.confidence >= LOW_CONFIDENCE;
    }
    return true;
  });
  if (!usable.length) return { ok: false, reason: 'low-confidence' };

  const sentences: SourceSentence[] = usable.map((line, index) => {
    const text = line.text.trim();
    return {
      id: `s${index + 1}`,
      text,
      language: lineLanguage(text),
      frames: [line.frame],
      polygons: [line.cornerPoints],
    };
  });

  const nepali = sentences.filter((sentence) => sentence.language === 'ne').length;
  return {
    ok: true,
    sentences,
    language: nepali >= sentences.length - nepali ? 'ne' : 'en',
  };
}
