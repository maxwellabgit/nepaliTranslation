import {
  mapFrameToView,
  orientedImageSize,
  rotateFrame,
  type ImageRotation,
  type Size,
} from './overlayGeometry';
import type { OcrFrame } from './ocrTypes';

function horizontalOverlap(a: OcrFrame, b: OcrFrame): number {
  return (
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  );
}

/**
 * Grow a glyph box enough to tint the line, and stop at half the gap to the
 * lines above and below so two highlights never paint the same pixels.
 */
export function padLineFrames(frames: OcrFrame[], image: Size): OcrFrame[] {
  return frames.map((frame, index) => {
    let aboveBottom: number | null = null;
    let belowTop: number | null = null;
    for (let other = 0; other < frames.length; other += 1) {
      if (other === index) continue;
      const candidate = frames[other];
      if (horizontalOverlap(frame, candidate) <= 0) continue;
      const candidateBottom = candidate.y + candidate.height;
      if (candidateBottom <= frame.y + frame.height * 0.5) {
        aboveBottom = aboveBottom == null ? candidateBottom : Math.max(aboveBottom, candidateBottom);
      }
      if (candidate.y >= frame.y + frame.height * 0.5) {
        belowTop = belowTop == null ? candidate.y : Math.min(belowTop, candidate.y);
      }
    }
    const gapAbove = aboveBottom == null ? frame.height : frame.y - aboveBottom;
    const gapBelow = belowTop == null ? frame.height : belowTop - (frame.y + frame.height);
    const maxPad = Math.max(1, frame.height * 0.18);
    const padUp = Math.min(maxPad, Math.max(0, gapAbove) / 2);
    const padDown = Math.min(maxPad, Math.max(0, gapBelow) / 2);
    const padX = Math.min(Math.max(2, frame.height * 0.35), image.width * 0.03);
    const x = Math.max(0, frame.x - padX);
    const y = Math.max(0, frame.y - padUp);
    const right = Math.min(image.width, frame.x + frame.width + padX);
    const bottom = Math.min(image.height, frame.y + frame.height + padDown);
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

function toPercents(frame: OcrFrame, image: Size): HighlightPercents {
  return {
    left: percent(frame.x, image.width),
    top: percent(frame.y, image.height),
    width: percent(frame.width, image.width),
    height: percent(frame.height, image.height),
  };
}

/**
 * Place every visible line together so padding sees both neighbors.
 * Order and length match `frames`. A line that does not map is null.
 */
export function highlightPercentsForFrames(
  frames: OcrFrame[],
  image: Size,
  rotation: ImageRotation,
): (HighlightPercents | null)[] {
  const oriented = orientedImageSize(image, rotation);
  if (oriented.width <= 0 || oriented.height <= 0) return frames.map(() => null);
  const mapped = frames.map((frame) => {
    const rotated = rotateFrame(frame, image, rotation);
    const view = mapFrameToView(rotated, oriented, oriented);
    if (view.width <= 0 || view.height <= 0) return null;
    return view;
  });
  const present = mapped.filter((frame): frame is OcrFrame => frame != null);
  const padded = padLineFrames(present, oriented);
  let cursor = 0;
  return mapped.map((frame) => {
    if (!frame) return null;
    const box = padded[cursor];
    cursor += 1;
    return box ? toPercents(box, oriented) : null;
  });
}

/**
 * Place one line box on the upright preview.
 * `rotation` is the quarter-turn from sensor pixels to the displayed photo.
 * A tall sensor strip (phone cameras store portrait shots sideways) becomes
 * a wide, short bar on the preview. Several lines must use highlightPercentsForFrames.
 */
export function highlightPercents(
  frame: OcrFrame,
  image: Size,
  rotation: ImageRotation,
): HighlightPercents | null {
  return highlightPercentsForFrames([frame], image, rotation)[0] ?? null;
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
