import { requireNativeModule } from 'expo-modules-core';

export type OcrPoint = { x: number; y: number };
export type OcrFrame = { x: number; y: number; width: number; height: number };
export type OcrLine = {
  text: string;
  frame: OcrFrame;
  cornerPoints: OcrPoint[];
  confidence: number | null;
};
export type OcrBlock = {
  text: string;
  language: 'en' | 'ne' | 'unknown';
  frame: OcrFrame;
  cornerPoints: OcrPoint[];
  confidence: number | null;
  lines: OcrLine[];
};
export type OcrDocument = {
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  blocks: OcrBlock[];
};

type NativeOcr = {
  recognize(uri: string): Promise<OcrDocument>;
};

const native = requireNativeModule<NativeOcr>('NeptranslateOcr');

/** Latin + Devanagari recognition. Images are not uploaded. */
export function recognizeText(uri: string): Promise<OcrDocument> {
  return native.recognize(uri);
}
