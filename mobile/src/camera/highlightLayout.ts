import {
  mapLineFramesToView,
  orientedImageSize,
  rotateFrame,
  type ImageRotation,
  type Size,
} from './overlayGeometry';
import type { OcrFrame } from './ocrTypes';

/**
 * Grow a glyph box enough to tint the line, and stop at half the gap to the
 * next line so two highlights never paint the space between them.
 */
export function padLineFrames(frames: OcrFrame[], image: Size): OcrFrame[] {
  const nextBelow = frames.map((frame, index) => {
    let nearest = Number.POSITIVE_INFINITY;
    for (let other = 0; other < frames.length; other += 1) {
      if (other === index) continue;
      const candidate = frames[other];
      if (candidate.y < frame.y + frame.height * 0.5) continue;
      const overlap =
        Math.min(frame.x + frame.width, candidate.x + candidate.width) -
        Math.max(frame.x, candidate.x);
      if (overlap <= 0) continue;
      nearest = Math.min(nearest, candidate.y);
    }
    return Number.isFinite(nearest) ? nearest : null;
  });

  return frames.map((frame, index) => {
    const below = nextBelow[index];
    const gap = below == null ? frame.height : below - (frame.y + frame.height);
    const padY = Math.min(Math.max(1, frame.height * 0.18), Math.max(0, gap) / 2);
    const padX = Math.min(Math.max(2, frame.height * 0.35), image.width * 0.03);
    const x = Math.max(0, frame.x - padX);
    const y = Math.max(0, frame.y - padY);
    const right = Math.min(image.width, frame.x + frame.width + padX);
    const bottom = Math.min(image.height, frame.y + frame.height + padY);
    return {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    };
  });
}

/** Letterboxed photo size inside the stage. Zero until the stage has been measured. */
export function containedPhotoSize(image: Size, rotation: ImageRotation, stage: Size): Size {
  const oriented = orientedImageSize(image, rotation);
  if (stage.width <= 0 || stage.height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(
    stage.width / Math.max(1, oriented.width),
    stage.height / Math.max(1, oriented.height),
  );
  if (!(scale > 0)) return { width: 0, height: 0 };
  return { width: oriented.width * scale, height: oriented.height * scale };
}

type Percent = `${number}%`;

export type HighlightPercents = {
  left: Percent;
  top: Percent;
  width: Percent;
  height: Percent;
};

function percent(part: number, whole: number): Percent {
  return `${(part / whole) * 100}%` as Percent;
}

/**
 * Place one line box on the upright preview.
 * `rotation` is the quarter-turn from sensor pixels to the displayed photo.
 * A tall sensor strip (phone cameras store portrait shots sideways) becomes
 * a wide, short bar on the preview.
 */
export function highlightPercents(
  frame: OcrFrame,
  image: Size,
  rotation: ImageRotation,
): HighlightPercents | null {
  const oriented = orientedImageSize(image, rotation);
  const [mapped] = mapLineFramesToView([frame], image, rotation, oriented);
  if (!mapped || oriented.width <= 0 || oriented.height <= 0) return null;
  const [padded] = padLineFrames([mapped], oriented);
  return {
    left: percent(padded.x, oriented.width),
    top: percent(padded.y, oriented.height),
    width: percent(padded.width, oriented.width),
    height: percent(padded.height, oriented.height),
  };
}

/** True when the upright box follows a text line instead of a sideways strip. */
export function isHorizontalHighlight(
  frame: OcrFrame,
  image: Size,
  rotation: ImageRotation,
): boolean {
  const upright = rotateFrame(frame, image, rotation);
  return upright.width > upright.height;
}
