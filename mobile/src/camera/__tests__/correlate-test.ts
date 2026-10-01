import { captureShouldBeDeleted } from '../cleanup';
import { buildCorrelation } from '../correlate';
import { dedupeOcrDocument, frameIoU, normalizeOcrText } from '../dedupeOcr';
import { colorForIndex } from '../sentenceColors';
import {
  mapFrameToView,
  mapSentenceFramesToView,
  orientedImageSize,
  rotatePoint,
} from '../overlayGeometry';
import { sortReadingOrder } from '../readingOrder';
import { segmentOcr } from '../segmentSentences';
import {
  INSCRIPTION_FIXTURE,
  INSCRIPTION_TRANSLATIONS,
} from '../inscriptionFixture';
import type { OcrDocument, OcrLine } from '../ocrTypes';

describe('camera sentence correlation', () => {
  it('keeps one highlight on a visual line even when it contains two sentences', () => {
    const english = segmentOcr({
      width: 100,
      height: 40,
      blocks: [
        {
          text: 'Hello. How are you?',
          language: 'en',
          confidence: 0.9,
          frame: { x: 0, y: 0, width: 80, height: 20 },
          cornerPoints: [],
          lines: [
            {
              text: 'Hello. How are you?',
              confidence: 0.9,
              frame: { x: 0, y: 0, width: 80, height: 20 },
              cornerPoints: [],
            },
          ],
        },
      ],
    });
    expect(english.ok && english.sentences.map((s) => s.text)).toEqual([
      'Hello. How are you?',
    ]);
    expect(english.ok && english.sentences[0]?.frames).toHaveLength(1);

    const nepali = segmentOcr(INSCRIPTION_FIXTURE);
    expect(nepali.ok && nepali.sentences).toHaveLength(3);
    expect(nepali.ok && nepali.language).toBe('ne');
  });

  it('keeps OCR lines when punctuation is absent and sorts reading order', () => {
    const lines: OcrLine[] = [
      {
        text: 'second',
        confidence: 0.8,
        frame: { x: 10, y: 40, width: 20, height: 10 },
        cornerPoints: [],
      },
      {
        text: 'first',
        confidence: 0.8,
        frame: { x: 10, y: 10, width: 20, height: 10 },
        cornerPoints: [],
      },
    ];
    expect(sortReadingOrder(lines).map((line) => line.text)).toEqual([
      'first',
      'second',
    ]);
    const doc = segmentOcr({
      width: 100,
      height: 80,
      blocks: [
        {
          text: 'first second',
          language: 'en',
          confidence: 0.8,
          frame: { x: 0, y: 0, width: 40, height: 50 },
          cornerPoints: [],
          lines,
        },
      ],
    });
    expect(doc.ok && doc.sentences.map((s) => s.text)).toEqual(['first', 'second']);
    expect(doc.ok && doc.sentences[0]?.frames).toEqual([lines[1]!.frame]);
    expect(doc.ok && doc.sentences[1]?.frames).toEqual([lines[0]!.frame]);
  });

  it('does not fall back to all lines for every sentence', () => {
    const lineA: OcrLine = {
      text: 'Hello.',
      confidence: 0.9,
      frame: { x: 0, y: 0, width: 40, height: 10 },
      cornerPoints: [{ x: 0, y: 0 }],
    };
    const lineB: OcrLine = {
      text: 'How are you?',
      confidence: 0.9,
      frame: { x: 0, y: 20, width: 60, height: 10 },
      cornerPoints: [{ x: 0, y: 20 }],
    };
    const segmented = segmentOcr({
      width: 100,
      height: 40,
      blocks: [
        {
          text: 'Hello. How are you?',
          language: 'en',
          confidence: 0.9,
          frame: { x: 0, y: 0, width: 80, height: 40 },
          cornerPoints: [],
          lines: [lineA, lineB],
        },
      ],
    });
    expect(segmented.ok).toBe(true);
    if (!segmented.ok) return;
    expect(segmented.sentences).toHaveLength(2);
    expect(segmented.sentences[0]?.frames).toEqual([lineA.frame]);
    expect(segmented.sentences[1]?.frames).toEqual([lineB.frame]);
    expect(segmented.sentences[0]?.frames).not.toEqual(
      expect.arrayContaining([lineB.frame]),
    );
  });

  it('letterboxes frames, rotates points, and maps oriented sentence unions', () => {
    const mapped = mapFrameToView(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 100, height: 100 },
      { width: 200, height: 100 },
    );
    expect(mapped.x).toBeCloseTo(50);
    expect(mapped.width).toBeCloseTo(100);

    expect(rotatePoint({ x: 10, y: 0 }, { width: 100, height: 50 }, 90)).toEqual({
      x: 50,
      y: 10,
    });
    expect(orientedImageSize({ width: 100, height: 50 }, 90)).toEqual({
      width: 50,
      height: 100,
    });

    const oriented = mapSentenceFramesToView(
      [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 0, width: 10, height: 10 },
      ],
      { width: 100, height: 50 },
      90,
      { width: 50, height: 100 },
    );
    expect(oriented).not.toBeNull();
    // After 90°: (0,0)->(50,0), (10,10)->(40,10), (30,10)->(40,30) → union in oriented space
    expect(oriented!.width).toBeGreaterThan(0);
    expect(oriented!.height).toBeGreaterThan(0);
  });

  it('cycles crimson, saffron, and blue in order', () => {
    expect(colorForIndex(0)).toBe('#C8102E');
    expect(colorForIndex(1)).toBe('#E8A317');
    expect(colorForIndex(2)).toBe('#1A73E8');
    expect(colorForIndex(3)).toBe(colorForIndex(0));
    expect(colorForIndex(0)).not.toBe(colorForIndex(1));
  });

  it('rejects empty and low-confidence captures but skips unknown confidence', () => {
    expect(segmentOcr({ width: 10, height: 10, blocks: [] })).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(
      segmentOcr({
        width: 10,
        height: 10,
        blocks: [
          {
            text: 'nope',
            language: 'en',
            confidence: 0.1,
            frame: { x: 0, y: 0, width: 1, height: 1 },
            cornerPoints: [],
            lines: [
              {
                text: 'nope',
                confidence: 0.1,
                frame: { x: 0, y: 0, width: 8, height: 4 },
                cornerPoints: [],
              },
            ],
          },
        ],
      }),
    ).toEqual({ ok: false, reason: 'low-confidence' });

    const unknown = segmentOcr({
      width: 10,
      height: 10,
      blocks: [
        {
          text: 'ok',
          language: 'en',
          confidence: null,
          frame: { x: 0, y: 0, width: 1, height: 1 },
          cornerPoints: [],
          lines: [
            {
              text: 'ok',
              confidence: null,
              frame: { x: 0, y: 0, width: 1, height: 1 },
              cornerPoints: [],
            },
          ],
        },
      ],
    });
    expect(unknown.ok).toBe(true);

    const noBox = segmentOcr({
      width: 100,
      height: 100,
      blocks: [
        {
          text: 'speck',
          language: 'en',
          confidence: null,
          frame: { x: 0, y: 0, width: 0, height: 0 },
          cornerPoints: [],
          lines: [
            {
              text: 'speck',
              confidence: null,
              frame: { x: 0, y: 0, width: 0, height: 0 },
              cornerPoints: [],
            },
          ],
        },
      ],
    });
    expect(noBox).toEqual({ ok: false, reason: 'empty' });
  });

  it('ignores a distant sign and keeps foreground text', () => {
    const photo = (height: number, text: string) =>
      segmentOcr({
        width: 3000,
        height: 4000,
        blocks: [
          {
            text,
            language: 'en',
            confidence: null,
            frame: { x: 80, y: 80, width: 500, height },
            cornerPoints: [],
            lines: [
              {
                text,
                confidence: null,
                frame: { x: 80, y: 80, width: 500, height },
                cornerPoints: [],
              },
            ],
          },
        ],
      });
    expect(photo(40, 'PARK')).toEqual({ ok: false, reason: 'empty' });
    const close = photo(120, 'PARK');
    expect(close.ok).toBe(true);
    if (close.ok) expect(close.sentences[0]?.text).toBe('PARK');
  });

  it('deletes captures on retake, exit, and success only', () => {
    expect(captureShouldBeDeleted('retake')).toBe(true);
    expect(captureShouldBeDeleted('exit')).toBe(true);
    expect(captureShouldBeDeleted('processed')).toBe(true);
    expect(captureShouldBeDeleted('keep')).toBe(false);
  });

  it('dedupes overlapping Latin+Devanagari blocks', () => {
    expect(normalizeOcrText(' Hail  Shiva ')).toBe('hailshiva');
    const frame = { x: 10, y: 10, width: 100, height: 40 };
    expect(frameIoU(frame, frame)).toBeCloseTo(1);

    const doc: OcrDocument = {
      width: 200,
      height: 200,
      blocks: [
        {
          text: 'शिव',
          language: 'en',
          confidence: 0.5,
          frame,
          cornerPoints: [],
          lines: [
            {
              text: 'शिव',
              confidence: 0.5,
              frame,
              cornerPoints: [],
            },
          ],
        },
        {
          text: 'शिव',
          language: 'ne',
          confidence: 0.9,
          frame: { x: 12, y: 12, width: 98, height: 38 },
          cornerPoints: [],
          lines: [
            {
              text: 'शिव',
              confidence: 0.9,
              frame: { x: 12, y: 12, width: 98, height: 38 },
              cornerPoints: [],
            },
          ],
        },
      ],
    };
    const deduped = dedupeOcrDocument(doc);
    expect(deduped.blocks).toHaveLength(1);
    expect(deduped.blocks[0]?.language).toBe('ne');
  });

  it('keeps curated translations on the fixture path only', () => {
    const fixture = buildCorrelation(
      INSCRIPTION_FIXTURE,
      (text) => INSCRIPTION_TRANSLATIONS[text] ?? '',
    );
    expect(fixture.ok).toBe(true);
    if (!fixture.ok) return;
    expect(fixture.sentences.map((s) => s.translation)).toEqual([
      'Hail to Lord Shiva.',
      'For the welfare of all beings.',
      'May there be enduring prosperity.',
    ]);

    const production = buildCorrelation(INSCRIPTION_FIXTURE, () => '');
    expect(production.ok).toBe(true);
    if (!production.ok) return;
    expect(production.sentences.every((s) => s.translation === '')).toBe(true);
  });
});
