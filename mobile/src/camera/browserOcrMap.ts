import { unionFrames } from './overlayGeometry';
import type { OcrBlock, OcrDocument, OcrFrame, OcrLine, OcrPoint } from './ocrTypes';
import { classifySourceText } from './sourceCategory';

/** Axis-aligned box from Tesseract.js (`x0,y0` → `x1,y1`). */
export type TesseractBBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type TesseractWord = {
  text?: string | null;
  confidence?: number | null;
  bbox?: TesseractBBox | null;
};

export type TesseractLine = {
  text?: string | null;
  confidence?: number | null;
  bbox?: TesseractBBox | null;
  words?: TesseractWord[] | null;
};

export type TesseractParagraph = {
  lines?: TesseractLine[] | null;
};

export type TesseractBlock = {
  text?: string | null;
  confidence?: number | null;
  bbox?: TesseractBBox | null;
  paragraphs?: TesseractParagraph[] | null;
  lines?: TesseractLine[] | null;
};

/** Subset of a Tesseract.js page. The browser worker returns this shape. */
export type TesseractPage = {
  width?: number | null;
  height?: number | null;
  blocks?: TesseractBlock[] | null;
};

function frameFromBBox(bbox: TesseractBBox | null | undefined): OcrFrame | null {
  if (!bbox) return null;
  const x = bbox.x0;
  const y = bbox.y0;
  const width = bbox.x1 - bbox.x0;
  const height = bbox.y1 - bbox.y0;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function corners(frame: OcrFrame): OcrPoint[] {
  return [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.width, y: frame.y },
    { x: frame.x + frame.width, y: frame.y + frame.height },
    { x: frame.x, y: frame.y + frame.height },
  ];
}

/**
 * Tesseract reports 0–100. The correlation pipeline expects 0–1.
 * Missing confidence stays null. A reported zero stays zero.
 */
export function tesseractConfidence(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  if (value > 1) return Math.min(1, value / 100);
  return value;
}

/** Same readable-text rule as sentence segmentation: a letter or a digit counts. */
function lineHasReadableText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963]+$/u.test(trimmed)) {
    return false;
  }
  return /[\u0904-\u097F0-9A-Za-z]/u.test(trimmed);
}

function lineLanguage(text: string): 'en' | 'ne' | 'unknown' {
  const dev = (text.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (text.match(/[A-Za-z]/g) || []).length;
  if (dev === 0 && lat === 0) return 'unknown';
  return dev > lat ? 'ne' : 'en';
}

function sameTextRow(a: OcrFrame, b: OcrFrame): boolean {
  const aMid = a.y + a.height / 2;
  const bMid = b.y + b.height / 2;
  return Math.abs(aMid - bMid) <= Math.max(a.height, b.height) * 0.6;
}

/** One highlight per visual line, tight to the word glyphs rather than a loose line box. */
function linesFromWords(entry: TesseractLine): OcrLine[] {
  const words = (entry.words ?? []).flatMap((word) => {
    const text = (word.text ?? '').replace(/\s+/g, ' ').trim();
    const frame = frameFromBBox(word.bbox);
    if (!text || !frame) return [];
    return [{ text, frame, confidence: tesseractConfidence(word.confidence) }];
  });
  if (!words.length) return [];
  const sorted = [...words].sort(
    (a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x,
  );
  const rows: (typeof sorted)[] = [];
  for (const word of sorted) {
    const row = rows.find((group) => sameTextRow(group[0].frame, word.frame));
    if (row) row.push(word);
    else rows.push([word]);
  }
  return rows.flatMap((row) => {
    const ordered = [...row].sort((a, b) => a.frame.x - b.frame.x);
    const kept = ordered.filter((word) => {
      if (word.confidence == null) return true;
      if (/[\u0900-\u097F]/.test(word.text)) return word.confidence >= 0.4;
      return word.confidence >= 0.45;
    });
    if (!kept.length) return [];
    const runs: (typeof kept)[] = [];
    for (const word of kept) {
      const category = classifySourceText(word.text);
      const current = runs[runs.length - 1];
      const previous = current?.[0] ? classifySourceText(current[0].text) : null;
      if (current && previous === category) current.push(word);
      else runs.push([word]);
    }
    return runs.flatMap((run) => {
      const text = run.map((word) => word.text).join(' ').trim();
      const frame = unionFrames(run.map((word) => word.frame));
      if (!text || !frame || !lineHasReadableText(text)) return [];
      const confs = run
        .map((word) => word.confidence)
        .filter((value): value is number => value != null)
        .sort((a, b) => a - b);
      const mid = Math.floor(confs.length / 2);
      const confidence = confs.length
        ? confs.length % 2
          ? confs[mid]
          : (confs[mid - 1] + confs[mid]) / 2
        : null;
      return [
        {
          text,
          frame,
          cornerPoints: corners(frame),
          confidence,
        },
      ];
    });
  });
}

function toLine(entry: TesseractLine): OcrLine | null {
  const text = (entry.text ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const frame = frameFromBBox(entry.bbox);
  if (!frame) return null;
  return {
    text,
    frame,
    cornerPoints: corners(frame),
    confidence: tesseractConfidence(entry.confidence),
  };
}

function linesOf(block: TesseractBlock): OcrLine[] {
  const fromParagraphs = (block.paragraphs ?? []).flatMap((paragraph) => paragraph.lines ?? []);
  const raw = fromParagraphs.length > 0 ? fromParagraphs : (block.lines ?? []);
  const fromWords = raw.flatMap((line) => linesFromWords(line));
  if (fromWords.length) return fromWords;
  return raw.flatMap((line) => {
    const mapped = toLine(line);
    return mapped ? [mapped] : [];
  });
}

/**
 * Turn a browser OCR page into the same `OcrDocument` the iOS ML Kit adapter returns.
 * `segmentOcr` / `buildCorrelation` stay the only sentence and highlight path.
 */
function scaleFrame(frame: OcrFrame, scaleX: number, scaleY: number): OcrFrame {
  return {
    x: frame.x * scaleX,
    y: frame.y * scaleY,
    width: frame.width * scaleX,
    height: frame.height * scaleY,
  };
}

/**
 * Tesseract sometimes reports boxes in a resized page. Scale them onto the
 * upright bitmap the preview shows. A mismatch here paints the tint off the glyphs.
 */
export function tesseractPageToOcrDocument(
  page: TesseractPage,
  image: { width: number; height: number },
): OcrDocument {
  const pageWidth = page.width && page.width > 0 ? page.width : image.width;
  const pageHeight = page.height && page.height > 0 ? page.height : image.height;
  const scaleX = image.width > 0 && pageWidth > 0 ? image.width / pageWidth : 1;
  const scaleY = image.height > 0 && pageHeight > 0 ? image.height / pageHeight : 1;
  const blocks: OcrBlock[] = [];
  for (const block of page.blocks ?? []) {
    const lines = linesOf(block).map((line) => {
      const frame = scaleFrame(line.frame, scaleX, scaleY);
      return { ...line, frame, cornerPoints: corners(frame) };
    });
    if (!lines.length) continue;
    const text = lines.map((line) => line.text).join(' ');
    const rawFrame = frameFromBBox(block.bbox);
    const frame = rawFrame ? scaleFrame(rawFrame, scaleX, scaleY) : lines[0].frame;
    blocks.push({
      text,
      language: lineLanguage(text),
      frame,
      cornerPoints: corners(frame),
      confidence: tesseractConfidence(block.confidence),
      lines,
    });
  }
  return {
    width: image.width,
    height: image.height,
    rotation: 0,
    blocks,
  };
}
