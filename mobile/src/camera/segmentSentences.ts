import { splitSentences } from '../mt/sentences';
import type { OcrDocument, OcrLine, SourceSentence } from './ocrTypes';
import { sortReadingOrder } from './readingOrder';

const DEVANAGARI = /[\u0900-\u097F]/;
const LOW_CONFIDENCE = 0.35;

export type SegmentResult =
  | { ok: true; sentences: SourceSentence[]; language: 'en' | 'ne' }
  | { ok: false; reason: 'empty' | 'low-confidence' };

function lineLanguage(text: string): 'en' | 'ne' {
  const dev = (text.match(DEVANAGARI) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  return dev > lat ? 'ne' : 'en';
}

function hasPunctuation(text: string): boolean {
  return /[.?!।॥]/.test(text);
}

function compactLen(text: string): number {
  return text.replace(/\s+/g, '').length;
}

/** Letters or digits. A short sign is real text; punctuation alone is not. */
function lineHasSignal(text: string): boolean {
  return /[\u0900-\u097F]/u.test(text) || /[A-Za-z0-9]/.test(text);
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

/**
 * Assign each OCR line to exactly one sentence by walking reading order and
 * greedily consuming lines until the sentence's compact character budget is met.
 * Never falls back to "all lines".
 */
export function assignLinesToSentences(
  pieces: string[],
  lines: OcrLine[],
): OcrLine[][] {
  const assigned: OcrLine[][] = pieces.map(() => []);
  if (!pieces.length || !lines.length) return assigned;

  let lineIdx = 0;
  for (let pi = 0; pi < pieces.length; pi += 1) {
    const need = compactLen(pieces[pi]);
    if (need === 0) continue;
    let got = 0;
    while (lineIdx < lines.length && got < need) {
      assigned[pi].push(lines[lineIdx]);
      got += compactLen(lines[lineIdx].text);
      lineIdx += 1;
    }
  }

  // Leftover lines (soft-split remainder mismatch) stay with the last sentence.
  if (pieces.length > 0) {
    while (lineIdx < lines.length) {
      assigned[pieces.length - 1].push(lines[lineIdx]);
      lineIdx += 1;
    }
  }

  return assigned;
}

function geometryFromLines(lines: OcrLine[]): {
  frames: SourceSentence['frames'];
  polygons: SourceSentence['polygons'];
} {
  return {
    frames: lines.map((line) => line.frame),
    polygons: lines.map((line) => line.cornerPoints),
  };
}

/** Normalize OCR into stable sentences. Lines without punctuation stay whole. */
export function segmentOcr(doc: OcrDocument): SegmentResult {
  const lines = sortReadingOrder(doc.blocks.flatMap((block) => block.lines));
  const signaled = lines.filter((line) => lineHasSignal(line.text));
  if (!signaled.length) return { ok: false, reason: 'empty' };

  const usable = signaled.filter((line) => {
    if (!lineGeometryOk(line, doc)) return false;
    if (typeof line.confidence === 'number' && Number.isFinite(line.confidence)) {
      return line.confidence >= LOW_CONFIDENCE;
    }
    return true;
  });
  if (!usable.length) return { ok: false, reason: 'low-confidence' };

  const joined = usable.map((line) => line.text.trim()).join(' ');
  const language = lineLanguage(joined);

  let pieces: string[];
  let lineGroups: OcrLine[][];

  if (hasPunctuation(joined)) {
    const split = splitSentences(joined);
    pieces = [...split.complete, split.remainder].filter(Boolean);
    lineGroups = assignLinesToSentences(pieces, usable);
  } else {
    pieces = usable.map((line) => line.text.trim());
    lineGroups = usable.map((line) => [line]);
  }

  const sentences: SourceSentence[] = pieces.map((text, index) => {
    const geometry = geometryFromLines(lineGroups[index] ?? []);
    const localLang = lineLanguage(text);
    return {
      id: `s${index + 1}`,
      text,
      language: localLang === 'ne' || language === 'ne' ? localLang : 'en',
      frames: geometry.frames,
      polygons: geometry.polygons,
    };
  });

  const dominant: 'en' | 'ne' =
    sentences.filter((s) => s.language === 'ne').length >=
    sentences.filter((s) => s.language === 'en').length
      ? 'ne'
      : 'en';
  return { ok: true, sentences, language: dominant };
}
