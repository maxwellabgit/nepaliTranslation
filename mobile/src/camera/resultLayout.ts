import { containedPhotoSize } from './highlightLayout';
import type { ImageRotation, Size } from './overlayGeometry';

/** Visible strip when the translation sheet is lowered. */
export const RESULT_SHEET_HANDLE = 76;

/** Expanded sheet starts here, leaving the photo in the top of the screen. */
export const RESULT_SHEET_TOP_RATIO = 0.42;

export type PhotoFrame = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function resultSheetTops(stageHeight: number): { expanded: number; collapsed: number } {
  const collapsed = Math.max(0, stageHeight - RESULT_SHEET_HANDLE);
  const expanded = Math.min(collapsed, Math.max(0, stageHeight * RESULT_SHEET_TOP_RATIO));
  return { expanded, collapsed };
}

/**
 * Fit the photo in the space above the sheet and center it there.
 * A higher sheet leaves a shorter space, so the photo shrinks and its
 * center moves toward the top of the screen.
 */
export function photoAboveSheet(
  image: Size,
  rotation: ImageRotation,
  stage: Size,
  sheetTop: number,
): PhotoFrame {
  const availH = Math.max(0, sheetTop - 12);
  const box = containedPhotoSize(image, rotation, { width: Math.max(0, stage.width), height: availH });
  return {
    width: box.width,
    height: box.height,
    left: Math.max(0, (stage.width - box.width) / 2),
    top: Math.max(0, (availH - box.height) / 2),
  };
}
