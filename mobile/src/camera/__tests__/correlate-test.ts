import { captureShouldBeDeleted } from '../cleanup';
import { colorForSentence } from '../sentenceColors';
import { mapFrameToView, rotatePoint } from '../overlayGeometry';
import { sortReadingOrder } from '../readingOrder';
import { segmentOcr } from '../segmentSentences';
import { INSCRIPTION_FIXTURE } from '../inscriptionFixture';
import type { OcrLine } from '../ocrTypes';

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
  });

  it('letterboxes frames and rotates points', () => {
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
  });

  it('uses one color for a sentence id', () => {
    expect(colorForSentence('s1')).toBe(colorForSentence('s1'));
    expect(colorForSentence('s1')).not.toBe(colorForSentence('s2'));
  });

  it('rejects empty and low-confidence captures', () => {
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
  });

  it('deletes captures on retake, exit, and success only', () => {
    expect(captureShouldBeDeleted('retake')).toBe(true);
    expect(captureShouldBeDeleted('exit')).toBe(true);
    expect(captureShouldBeDeleted('processed')).toBe(true);
    expect(captureShouldBeDeleted('keep')).toBe(false);
  });
});
