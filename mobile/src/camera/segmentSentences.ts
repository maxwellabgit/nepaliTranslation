import { groupCaptureLines } from './groupCaptureLines';
import type { OcrDocument, OcrLine, SourceSentence } from './ocrTypes';
import { sortReadingOrder } from './readingOrder';
import { classifySourceText } from './sourceCategory';

const LOW_CONFIDENCE = 0.5;
/** Distant signs are a small slice of the frame. Foreground text is not. */
export const MIN_TEXT_HEIGHT_RATIO = 0.02;

export type SegmentResult =
  | { ok: true; sentences: SourceSentence[]; language: 'en' | 'ne' }
  | { ok: false; reason: 'empty' | 'low-confidence' };

/** Combining marks and vedic signs with no base letter or digit. */
const ISOLATED_MARK = /^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]+$/u;

/**
 * A useful line has a letter or a number at a size the caller already checked.
 * One "A", a room number, a price, or one Nepali syllable can be a sign.
 * An isolated combining mark is not.
 */
function lineReadable(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || ISOLATED_MARK.test(trimmed)) return false;
  return /[\u0904-\u097F0-9A-Za-z]/u.test(trimmed);
}

function lineLargeEnough(line: OcrLine, doc: OcrDocument): boolean {
  const shorter = Math.min(doc.width, doc.height);
  if (!(shorter > 0) || !(line.frame.height > 0)) return false;
  return line.frame.height >= shorter * MIN_TEXT_HEIGHT_RATIO;
}

/**
 * A text line is a strip. A box tall enough to cover a drawing is a region,
 * and letting it into a paragraph pulls later lines into the same group.
 * Tiny test documents are left alone.
 */
function lineIsTextStrip(line: OcrLine, doc: OcrDocument): boolean {
  const shorter = Math.min(doc.width, doc.height);
  if (shorter < 400) return true;
  return line.frame.height <= doc.height * 0.08;
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
    (line) => lineGeometryOk(line, doc) && lineLargeEnough(line, doc) && lineIsTextStrip(line, doc),
  );
  if (!foreground.length) return { ok: false, reason: 'empty' };

  const usable = foreground.filter((line) => {
    if (typeof line.confidence === 'number' && Number.isFinite(line.confidence)) {
      return line.confidence >= LOW_CONFIDENCE;
    }
    return true;
  });
  if (!usable.length) return { ok: false, reason: 'low-confidence' };

  const sentences = groupCaptureLines(
    usable.map((line) => {
      const text = line.text.trim();
      return {
        text,
        category: classifySourceText(text),
        frame: line.frame,
        polygon: line.cornerPoints,
      };
    }),
  );

  const nepali = sentences.filter((sentence) => sentence.language === 'ne').length;
  return {
    ok: true,
    sentences,
    language: nepali >= sentences.length - nepali ? 'ne' : 'en',
  };
}
