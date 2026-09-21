import type { OcrFrame, OcrPoint } from './ocrTypes';

export type Size = { width: number; height: number };

export function rotatePoint(
  point: OcrPoint,
  image: Size,
  rotation: 0 | 90 | 180 | 270,
): OcrPoint {
  if (rotation === 90) return { x: image.height - point.y, y: point.x };
  if (rotation === 180) return { x: image.width - point.x, y: image.height - point.y };
  if (rotation === 270) return { x: point.y, y: image.width - point.x };
  return { ...point };
}

export function orientedImageSize(image: Size, rotation: 0 | 90 | 180 | 270): Size {
  if (rotation === 90 || rotation === 270) {
    return { width: image.height, height: image.width };
  }
  return image;
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
