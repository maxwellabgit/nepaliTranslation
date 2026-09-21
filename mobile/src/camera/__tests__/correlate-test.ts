import { captureShouldBeDeleted } from '../cleanup';
import { buildCorrelation } from '../correlate';
import { dedupeOcrDocument, frameIoU, normalizeOcrText } from '../dedupeOcr';
import { colorForSentence } from '../sentenceColors';
import {
  mapFrameToView,
  mapSentenceFramesToView,
  orientedImageSize,
  rotatePoint,
} from '../overlayGeometry';
import { sortReadingOrder } from '../readingOrder';
import { assignLinesToSentences, segmentOcr } from '../segmentSentences';
import {
  INSCRIPTION_FIXTURE,
  INSCRIPTION_TRANSLATIONS,
} from '../inscriptionFixture';
import type { OcrDocument, OcrLine } from '../ocrTypes';

describe('camera sentence correlation', () => {
  it('splits English and Nepali punctuation into sentences', () => {
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
      'Hello.',
      'How are you?',
    ]);

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

    const assigned = assignLinesToSentences(['Hello.', 'How are you?'], [lineA, lineB]);
    expect(assigned[0]).toEqual([lineA]);
    expect(assigned[1]).toEqual([lineB]);
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

  it('uses one color for a sentence id', () => {
    expect(colorForSentence('s1')).toBe(colorForSentence('s1'));
    expect(colorForSentence('s1')).not.toBe(colorForSentence('s2'));
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
            text: 'x',
            language: 'en',
            confidence: 0.1,
            frame: { x: 0, y: 0, width: 1, height: 1 },
            cornerPoints: [],
            lines: [
              {
                text: 'x',
                confidence: 0.1,
                frame: { x: 0, y: 0, width: 1, height: 1 },
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
