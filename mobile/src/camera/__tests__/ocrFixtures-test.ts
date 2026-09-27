import { buildCorrelation } from '../correlate';
import { dedupeOcrDocument } from '../dedupeOcr';
import { mapLineFramesToView, unionFrames } from '../overlayGeometry';
import { segmentOcr } from '../segmentSentences';
import type { OcrDocument, OcrFrame, OcrLine } from '../ocrTypes';

function line(
  text: string,
  frame: OcrFrame,
  confidence: number | null,
): OcrLine {
  return {
    text,
    confidence,
    frame,
    cornerPoints: [
      { x: frame.x, y: frame.y },
      { x: frame.x + frame.width, y: frame.y },
      { x: frame.x + frame.width, y: frame.y + frame.height },
      { x: frame.x, y: frame.y + frame.height },
    ],
  };
}

function doc(lines: OcrLine[], width = 800, height = 1200): OcrDocument {
  return {
    width,
    height,
    blocks: lines.map((entry) => ({
      text: entry.text,
      language: /[\u0900-\u097F]/.test(entry.text) ? 'ne' : 'en',
      confidence: entry.confidence,
      frame: entry.frame,
      cornerPoints: entry.cornerPoints,
      lines: [entry],
    })),
  };
}

describe('camera OCR fixtures', () => {
  it('treats a blank capture as no text and does not translate it', () => {
    const blank = segmentOcr({ width: 800, height: 1200, blocks: [] });
    expect(blank).toEqual({ ok: false, reason: 'empty' });
    const built = buildCorrelation(
      { width: 800, height: 1200, blocks: [] },
      () => {
        throw new Error('rejected lines must not be translated');
      },
    );
    expect(built).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a full-frame texture and a blurry line as unclear', () => {
    const texture = segmentOcr(
      doc([
        line('asdf', { x: 0, y: 0, width: 790, height: 1180 }, null),
      ]),
    );
    expect(texture).toEqual({ ok: false, reason: 'low-confidence' });

    const blur = segmentOcr(
      doc([line('shop', { x: 40, y: 40, width: 120, height: 28 }, 0.1)]),
    );
    expect(blur).toEqual({ ok: false, reason: 'low-confidence' });
  });

  it('keeps a short sign, English, Devanagari, and non-overlapping mixed script', () => {
    const stop = segmentOcr(
      doc([line('A', { x: 40, y: 40, width: 36, height: 28 }, null)]),
    );
    expect(stop.ok).toBe(true);

    const english = segmentOcr(
      doc([line('OPEN', { x: 40, y: 80, width: 160, height: 40 }, null)]),
    );
    expect(english.ok).toBe(true);

    const devanagari = segmentOcr(
      doc([line('बाटो', { x: 40, y: 140, width: 120, height: 40 }, null)]),
    );
    expect(devanagari.ok).toBe(true);

    const mixed = dedupeOcrDocument(
      doc([
        line('Shop', { x: 20, y: 20, width: 100, height: 30 }, null),
        line('पसल', { x: 20, y: 200, width: 100, height: 30 }, null),
      ]),
    );
    expect(mixed.blocks).toHaveLength(2);
    const segmented = segmentOcr(mixed);
    expect(segmented.ok).toBe(true);
    if (!segmented.ok) return;
    expect(segmented.sentences.map((s) => s.text).sort()).toEqual(['Shop', 'पसल']);
  });

  it('highlights separated lines without coloring the gap', () => {
    const top = { x: 10, y: 10, width: 80, height: 16 };
    const bottom = { x: 10, y: 90, width: 80, height: 16 };
    const boxes = mapLineFramesToView(
      [top, bottom],
      { width: 200, height: 200 },
      0,
      { width: 200, height: 200 },
    );
    expect(boxes).toEqual([top, bottom]);
    const union = unionFrames([top, bottom]);
    expect(union!.height).toBeGreaterThan(boxes[0].height + boxes[1].height);
  });
});
