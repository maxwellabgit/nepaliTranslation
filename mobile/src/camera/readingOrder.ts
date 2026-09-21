import type { OcrLine } from './ocrTypes';

/** Sort OCR lines into reading order: top to bottom, then left to right. */
export function sortReadingOrder(lines: OcrLine[]): OcrLine[] {
  const heights = lines.map((line) => line.frame.height).filter((h) => h > 0);
  const median = heights.length
    ? [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)]
    : 12;
  const band = Math.max(8, median * 0.6);
  return [...lines].sort((a, b) => {
    const rowA = Math.round(a.frame.y / band);
    const rowB = Math.round(b.frame.y / band);
    if (rowA !== rowB) return rowA - rowB;
    return a.frame.x - b.frame.x;
  });
}
