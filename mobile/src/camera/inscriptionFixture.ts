import type { OcrDocument } from './ocrTypes';

/**
 * Three-passage inscription used by the camera overlay tests.
 * Geometry is in source-image pixels.
 */
export const INSCRIPTION_FIXTURE: OcrDocument = {
  width: 800,
  height: 1200,
  rotation: 0,
  blocks: [
    {
      text: 'शिवलाई नमस्कार ।',
      language: 'ne',
      confidence: 0.92,
      frame: { x: 80, y: 120, width: 640, height: 80 },
      cornerPoints: [
        { x: 80, y: 120 },
        { x: 720, y: 120 },
        { x: 720, y: 200 },
        { x: 80, y: 200 },
      ],
      lines: [
        {
          text: 'शिवलाई नमस्कार ।',
          confidence: 0.92,
          frame: { x: 80, y: 120, width: 640, height: 80 },
          cornerPoints: [
            { x: 80, y: 120 },
            { x: 720, y: 120 },
            { x: 720, y: 200 },
            { x: 80, y: 200 },
          ],
        },
      ],
    },
    {
      text: 'सबै प्राणीको हितका लागि ।',
      language: 'ne',
      confidence: 0.9,
      frame: { x: 80, y: 280, width: 640, height: 80 },
      cornerPoints: [
        { x: 80, y: 280 },
        { x: 720, y: 280 },
        { x: 720, y: 360 },
        { x: 80, y: 360 },
      ],
      lines: [
        {
          text: 'सबै प्राणीको हितका लागि ।',
          confidence: 0.9,
          frame: { x: 80, y: 280, width: 640, height: 80 },
          cornerPoints: [
            { x: 80, y: 280 },
            { x: 720, y: 280 },
            { x: 720, y: 360 },
            { x: 80, y: 360 },
          ],
        },
      ],
    },
    {
      text: 'समृद्धि रहोस् ।',
      language: 'ne',
      confidence: 0.88,
      frame: { x: 80, y: 440, width: 640, height: 80 },
      cornerPoints: [
        { x: 80, y: 440 },
        { x: 720, y: 440 },
        { x: 720, y: 520 },
        { x: 80, y: 520 },
      ],
      lines: [
        {
          text: 'समृद्धि रहोस् ।',
          confidence: 0.88,
          frame: { x: 80, y: 440, width: 640, height: 80 },
          cornerPoints: [
            { x: 80, y: 440 },
            { x: 720, y: 440 },
            { x: 720, y: 520 },
            { x: 80, y: 520 },
          ],
        },
      ],
    },
  ],
};

export const INSCRIPTION_TRANSLATIONS: Record<string, string> = {
  'शिवलाई नमस्कार ।': 'Hail to Lord Shiva.',
  'सबै प्राणीको हितका लागि ।': 'For the welfare of all beings.',
  'समृद्धि रहोस् ।': 'May there be enduring prosperity.',
};
