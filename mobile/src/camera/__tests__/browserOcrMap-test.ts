import fs from 'node:fs';
import path from 'node:path';
import { buildCorrelation } from '../correlate';
import { tesseractPageToOcrDocument } from '../browserOcrMap';

describe('browser OCR document mapping', () => {
  it('keeps iOS capture OCR on the ML Kit module', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'recognizeCapture.ts'),
      'utf8',
    );
    expect(src).toContain("import('neptranslate-ocr')");
    expect(src).not.toContain('tesseract');
  });

  it('feeds Tesseract lines through the existing correlation pipeline', () => {
    const doc = tesseractPageToOcrDocument(
      {
        blocks: [
          {
            text: 'OPEN',
            confidence: 92,
            bbox: { x0: 40, y0: 80, x1: 200, y1: 120 },
            paragraphs: [
              {
                lines: [
                  {
                    text: 'OPEN',
                    confidence: 92,
                    bbox: { x0: 40, y0: 80, x1: 200, y1: 120 },
                  },
                ],
              },
            ],
          },
          {
            text: 'बाटो',
            confidence: 80,
            bbox: { x0: 40, y0: 140, x1: 180, y1: 190 },
            paragraphs: [
              {
                lines: [
                  {
                    text: 'बाटो',
                    confidence: 80,
                    bbox: { x0: 40, y0: 140, x1: 180, y1: 190 },
                  },
                ],
              },
            ],
          },
        ],
      },
      { width: 800, height: 1200 },
    );

    expect(doc.blocks).toHaveLength(2);
    expect(doc.blocks[0].lines[0].confidence).toBeCloseTo(0.92);
    const built = buildCorrelation(doc, (text) =>
      text === 'OPEN' ? 'खुला' : 'road',
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.sentences.map((sentence) => sentence.text)).toEqual([
      'OPEN',
      'बाटो',
    ]);
  });

  it('scales page boxes onto the upright bitmap the preview shows', () => {
    const doc = tesseractPageToOcrDocument(
      {
        width: 1600,
        height: 2400,
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    text: 'OPEN',
                    bbox: { x0: 80, y0: 160, x1: 400, y1: 240 },
                    words: [
                      { text: 'OPEN', bbox: { x0: 80, y0: 160, x1: 400, y1: 240 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { width: 800, height: 1200 },
    );
    expect(doc.blocks[0].lines[0].frame).toEqual({
      x: 40,
      y: 80,
      width: 160,
      height: 40,
    });
  });

  it('tightens a loose line box to the word glyphs on that row', () => {
    const doc = tesseractPageToOcrDocument(
      {
        blocks: [
          {
            bbox: { x0: 0, y0: 0, x1: 800, y1: 400 },
            paragraphs: [
              {
                lines: [
                  {
                    text: 'loose',
                    bbox: { x0: 0, y0: 0, x1: 800, y1: 400 },
                    words: [
                      { text: 'यसको', bbox: { x0: 40, y0: 80, x1: 120, y1: 110 } },
                      { text: 'विपरित', bbox: { x0: 128, y0: 82, x1: 220, y1: 112 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { width: 800, height: 1200 },
    );
    expect(doc.blocks[0].lines).toHaveLength(1);
    expect(doc.blocks[0].lines[0].frame).toEqual({
      x: 40,
      y: 80,
      width: 180,
      height: 32,
    });
  });

  it('keeps a Devanagari line when one nearby word is noise', () => {
    const doc = tesseractPageToOcrDocument(
      {
        blocks: [
          {
            paragraphs: [
              {
                lines: [
                  {
                    words: [
                      {
                        text: 'Co',
                        confidence: 10,
                        bbox: { x0: 10, y0: 200, x1: 40, y1: 230 },
                      },
                      {
                        text: 'जीवनभरको',
                        confidence: 96,
                        bbox: { x0: 215, y0: 216, x1: 329, y1: 229 },
                      },
                      {
                        text: 'यात्रामा',
                        confidence: 97,
                        bbox: { x0: 299, y0: 216, x1: 360, y1: 229 },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { width: 640, height: 480 },
    );
    expect(doc.blocks[0].lines).toHaveLength(1);
    expect(doc.blocks[0].lines[0].text).toBe('जीवनभरको यात्रामा');
    expect(doc.blocks[0].lines[0].confidence).toBeGreaterThan(0.9);
    expect(doc.blocks[0].lines[0].frame.x).toBe(215);
  });

  it('drops blank lines and keeps unknown confidence', () => {
    const doc = tesseractPageToOcrDocument(
      {
        blocks: [
          {
            confidence: 0,
            paragraphs: [
              {
                lines: [
                  { text: '   ', confidence: 10, bbox: { x0: 1, y0: 1, x1: 2, y1: 2 } },
                  { text: 'Hi', confidence: 0, bbox: { x0: 10, y0: 10, x1: 40, y1: 28 } },
                ],
              },
            ],
          },
        ],
      },
      { width: 100, height: 100 },
    );
    expect(doc.blocks).toHaveLength(1);
    expect(doc.blocks[0].lines[0].confidence).toBeNull();
    expect(doc.blocks[0].confidence).toBeNull();
  });
});
