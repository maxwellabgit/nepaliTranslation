import { colorForSentence } from './sentenceColors';
import { segmentOcr, type SegmentResult } from './segmentSentences';
import type { CorrelatedSentence, OcrDocument } from './ocrTypes';

export function correlateSentences(
  segmented: Extract<SegmentResult, { ok: true }>,
  translate: (text: string) => string,
): CorrelatedSentence[] {
  return segmented.sentences.map((sentence) => ({
    ...sentence,
    translation: translate(sentence.text),
    color: colorForSentence(sentence.id),
  }));
}

export function previewText(text: string, limit = 42): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return `${flat.slice(0, limit - 1)}…`;
}

export function buildCorrelation(
  doc: OcrDocument,
  translate: (text: string) => string,
):
  | { ok: true; sentences: CorrelatedSentence[]; language: 'en' | 'ne' }
  | { ok: false; reason: 'empty' | 'low-confidence' } {
  const segmented = segmentOcr(doc);
  if (!segmented.ok) return segmented;
  return {
    ok: true,
    language: segmented.language,
    sentences: correlateSentences(segmented, translate),
  };
}
