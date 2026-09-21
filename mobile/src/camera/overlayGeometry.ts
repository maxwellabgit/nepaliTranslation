import type { OcrFrame, OcrPoint } from './ocrTypes';

export type Size = { width: number; height: number };
export type ImageRotation = 0 | 90 | 180 | 270;

export function rotatePoint(
  point: OcrPoint,
  image: Size,
  rotation: ImageRotation,
): OcrPoint {
  if (rotation === 90) return { x: image.height - point.y, y: point.x };
  if (rotation === 180) return { x: image.width - point.x, y: image.height - point.y };
  if (rotation === 270) return { x: point.y, y: image.width - point.x };
  return { ...point };
}

export function orientedImageSize(image: Size, rotation: ImageRotation): Size {
  if (rotation === 90 || rotation === 270) {
    return { width: image.height, height: image.width };
  }
  return image;
}

/** Rotate an axis-aligned frame by transforming its corners, then taking the AABB. */
export function rotateFrame(
  frame: OcrFrame,
  image: Size,
  rotation: ImageRotation,
): OcrFrame {
  if (rotation === 0) return { ...frame };
  const corners = [
    { x: frame.x, y: frame.y },
    { x: frame.x + frame.width, y: frame.y },
    { x: frame.x + frame.width, y: frame.y + frame.height },
    { x: frame.x, y: frame.y + frame.height },
  ].map((point) => rotatePoint(point, image, rotation));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function unionFrames(frames: OcrFrame[]): OcrFrame | null {
  if (!frames.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const frame of frames) {
    minX = Math.min(minX, frame.x);
    minY = Math.min(minY, frame.y);
    maxX = Math.max(maxX, frame.x + frame.width);
    maxY = Math.max(maxY, frame.y + frame.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Map a point on the source photo into a letterboxed preview (contain). */
export function mapImagePointToView(
  point: OcrPoint,
  image: Size,
  view: Size,
): OcrPoint {
  const scale = Math.min(view.width / image.width, view.height / image.height);
  const renderedW = image.width * scale;
  const renderedH = image.height * scale;
  const offsetX = (view.width - renderedW) / 2;
  const offsetY = (view.height - renderedH) / 2;
  return {
    x: offsetX + point.x * scale,
    y: offsetY + point.y * scale,
  };
}

export function mapFrameToView(frame: OcrFrame, image: Size, view: Size): OcrFrame {
  const origin = mapImagePointToView({ x: frame.x, y: frame.y }, image, view);
  const far = mapImagePointToView(
    { x: frame.x + frame.width, y: frame.y + frame.height },
    image,
    view,
  );
  return {
    x: origin.x,
    y: origin.y,
    width: far.x - origin.x,
    height: far.y - origin.y,
  };
}

/**
 * Rotate every sentence frame into oriented image space, union them, then
 * letterbox into the preview view.
 */
export function mapSentenceFramesToView(
  frames: OcrFrame[],
  image: Size,
  rotation: ImageRotation,
  view: Size,
): OcrFrame | null {
  const rotated = frames.map((frame) => rotateFrame(frame, image, rotation));
  const union = unionFrames(rotated);
  if (!union) return null;
  return mapFrameToView(union, orientedImageSize(image, rotation), view);
}
