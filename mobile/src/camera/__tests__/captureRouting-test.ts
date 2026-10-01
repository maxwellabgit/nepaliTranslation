import { groupCaptureLines } from '../groupCaptureLines';
import {
  acceptLatestTarget,
  captureResultKey,
  convertNepaliScript,
  foldScholarlyRoman,
  materializeCaptureGroups,
  routeCapture,
} from '../captureTarget';
import { resetCaptureMetrics, captureMetricSnapshot } from '../captureMetrics';
import { segmentOcr } from '../segmentSentences';
import { classifySourceText } from '../sourceCategory';
import type { SourceSentence } from '../ocrTypes';
import type { OcrFrame } from '../ocrTypes';

function frame(y: number, x = 10, width = 200, height = 20): OcrFrame {
  return { x, y, width, height };
}

function line(text: string, y: number, x = 10, width = 200) {
  const category = classifySourceText(text);
  return { text, category, frame: frame(y, x, width), polygon: [] };
}

describe('mixed-language capture routing', () => {
  beforeEach(() => {
    resetCaptureMetrics();
  });

  it('classifies English, Devanagari, and scholarly Roman Nepali', () => {
    expect(classifySourceText('35. Paying Respects')).toBe('en');
    expect(classifySourceText('to bow down, salute.')).toBe('en');
    expect(classifySourceText('ear.')).toBe('en');
    expect(classifySourceText('PARK')).toBe('en');
    expect(classifySourceText('जन्याकजुरुक्क उठ्यो')).toBe('ne-deva');
    expect(classifySourceText('jaryāk-jurukka uṭhyo ra khaseko')).toBe('ne-roman');
    expect(classifySourceText('dhognu')).toBe('ne-roman');
    expect(classifySourceText('kān')).toBe('ne-roman');
    expect(classifySourceText('namaste timi')).toBe('ne-roman');
  });

  it('drops a drawing-sized box on a photo and keeps the title line', () => {
    const doc = segmentOcr({
      width: 600,
      height: 800,
      blocks: [
        {
          text: 'page',
          language: 'en',
          confidence: 0.9,
          frame: { x: 10, y: 8, width: 500, height: 400 },
          cornerPoints: [],
          lines: [
            {
              text: '35. Paying Respects',
              confidence: 0.9,
              frame: { x: 200, y: 8, width: 180, height: 16 },
              cornerPoints: [],
            },
            {
              text: 'जन्याक',
              confidence: 0.9,
              frame: { x: 20, y: 40, width: 400, height: 24 },
              cornerPoints: [],
            },
            {
              text: 'scribble box',
              confidence: 0.7,
              frame: { x: 10, y: 200, width: 500, height: 180 },
              cornerPoints: [],
            },
          ],
        },
      ],
    });
    expect(doc.ok && doc.sentences.map((sentence) => sentence.text)).toEqual([
      '35. Paying Respects',
      'जन्याक',
    ]);
  });

  it('joins an interlinear passage and leaves side-by-side cells apart', () => {
    const story = groupCaptureLines([
      line('जन्याकजुरुक्क उठ्यो', 10),
      line('jaryāk-jurukka uṭhyo', 32),
      line('फर्काएर लगायो', 54),
      line('pharkāera lagāyo', 76),
    ]);
    expect(story.map((group) => group.category)).toEqual(['ne-deva', 'ne-roman']);
    expect(story[0]?.frames).toHaveLength(2);
    expect(story[1]?.text).toContain('jaryāk-jurukka');
    expect(story[1]?.text).toContain('pharkāera');

    const cells = groupCaptureLines([
      line('ढोग्नु', 200, 20, 40),
      line('dhognu', 200, 80, 50),
      line('to bow down, salute.', 200, 150, 90),
    ]);
    expect(cells).toHaveLength(3);
    expect(cells.map((group) => group.category)).toEqual(['ne-deva', 'ne-roman', 'en']);
  });

  it('routes all nine source and target pairs without chaining', () => {
    expect(routeCapture('en', 'en')).toEqual({ kind: 'keep' });
    expect(routeCapture('en', 'ne-deva')).toEqual({
      kind: 'translate',
      direction: 'en-ne',
      script: 'deva',
    });
    expect(routeCapture('en', 'ne-roman')).toEqual({
      kind: 'translate',
      direction: 'en-ne',
      script: 'roman',
    });
    expect(routeCapture('ne-deva', 'en')).toEqual({
      kind: 'translate',
      direction: 'ne-en',
      script: 'deva',
    });
    expect(routeCapture('ne-deva', 'ne-deva')).toEqual({ kind: 'keep' });
    expect(routeCapture('ne-deva', 'ne-roman')).toEqual({ kind: 'script', script: 'roman' });
    expect(routeCapture('ne-roman', 'en')).toEqual({
      kind: 'translate',
      direction: 'ne-en',
      script: 'deva',
    });
    expect(routeCapture('ne-roman', 'ne-deva')).toEqual({ kind: 'script', script: 'deva' });
    expect(routeCapture('ne-roman', 'ne-roman')).toEqual({ kind: 'keep' });
  });

  it('folds scholarly macrons before Devanagari conversion', () => {
    expect(foldScholarlyRoman('kān')).toBe('kan');
    const deva = convertNepaliScript('dhognu', 'deva');
    expect(deva).toMatch(/[\u0900-\u097F]/);
    const roman = convertNepaliScript('ढोग्नु', 'roman');
    expect(roman.toLowerCase()).toContain('dhog');
  });

  it('reuses a finished target and ignores a stale generation', () => {
    const groups: SourceSentence[] = groupCaptureLines([
      line('35. Paying Respects', 10),
      line('जन्याकजुरुक्क उठ्यो', 40),
    ]);
    const cache = new Map();
    let calls = 0;
    const translate = async () => {
      calls += 1;
      return 'translated';
    };
    return materializeCaptureGroups({
      groups,
      target: 'en',
      captureId: 1,
      cache,
      translate,
    }).then(async (first) => {
      expect(first[0]?.translation).toBe('35. Paying Respects');
      expect(first[0]?.failed).toBeFalsy();
      expect(first[1]?.translation).toBe('translated');
      expect(calls).toBe(1);
      expect(captureMetricSnapshot().keep).toBe(1);
      expect(captureMetricSnapshot().translate).toBe(1);
      const again = await materializeCaptureGroups({
        groups,
        target: 'en',
        captureId: 1,
        cache,
        translate,
      });
      expect(again[1]?.translation).toBe('translated');
      expect(calls).toBe(1);
      expect(captureResultKey(1, 's1', 'en')).toBe('1:s1:en');
      expect(
        acceptLatestTarget({
          requestGeneration: 1,
          currentGeneration: 2,
          requestCapture: 4,
          currentCapture: 4,
        }),
      ).toBe(false);
      expect(
        acceptLatestTarget({
          requestGeneration: 2,
          currentGeneration: 2,
          requestCapture: 4,
          currentCapture: 5,
        }),
      ).toBe(false);
    });
  });
});
