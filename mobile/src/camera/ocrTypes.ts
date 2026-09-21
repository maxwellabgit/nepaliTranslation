export type OcrPoint = { x: number; y: number };

export type OcrFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrLine = {
  text: string;
  frame: OcrFrame;
  cornerPoints: OcrPoint[];
  confidence: number;
};

export type OcrBlock = {
  text: string;
  language: 'en' | 'ne' | 'unknown';
  frame: OcrFrame;
  cornerPoints: OcrPoint[];
  confidence: number;
  lines: OcrLine[];
};

export type OcrDocument = {
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  blocks: OcrBlock[];
};

export type SourceSentence = {
  id: string;
  text: string;
  language: 'en' | 'ne';
  frames: OcrFrame[];
  polygons: OcrPoint[][];
};

export type CorrelatedSentence = SourceSentence & {
  translation: string;
  color: string;
};
