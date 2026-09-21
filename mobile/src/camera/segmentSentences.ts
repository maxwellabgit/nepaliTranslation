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

function framesForText(text: string, lines: OcrLine[]): { frames: SourceSentence['frames']; polygons: SourceSentence['polygons'] } {
  const needle = text.replace(/\s+/g, '');
  const matched = lines.filter((line) => {
    const compact = line.text.replace(/\s+/g, '');
    return compact && (needle.includes(compact) || compact.includes(needle));
  });
  const use = matched.length ? matched : lines;
  return {
    frames: use.map((line) => line.frame),
    polygons: use.map((line) => line.cornerPoints),
  };
}

/** Normalize OCR into stable sentences. Lines without punctuation stay whole. */
export function segmentOcr(doc: OcrDocument): SegmentResult {
  const lines = sortReadingOrder(doc.blocks.flatMap((block) => block.lines));
  const usable = lines.filter((line) => line.text.trim());
  if (!usable.length) return { ok: false, reason: 'empty' };
  const mean =
    usable.reduce((sum, line) => sum + line.confidence, 0) / usable.length;
  if (mean < LOW_CONFIDENCE) return { ok: false, reason: 'low-confidence' };

  const joined = usable.map((line) => line.text.trim()).join(' ');
  const language = lineLanguage(joined);
  const pieces = hasPunctuation(joined)
    ? [...splitSentences(joined).complete, splitSentences(joined).remainder].filter(
        Boolean,
      )
    : usable.map((line) => line.text.trim());

  const sentences: SourceSentence[] = pieces.map((text, index) => {
    const geometry = framesForText(text, usable);
    return {
      id: `s${index + 1}`,
      text,
      language: lineLanguage(text) === 'ne' || language === 'ne' ? lineLanguage(text) : 'en',
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
