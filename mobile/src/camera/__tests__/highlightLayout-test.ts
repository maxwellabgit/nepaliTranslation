import {
  containedPhotoSize,
  highlightPercents,
  highlightPercentsForFrames,
  isHorizontalHighlight,
  padLineFrames,
} from '../highlightLayout';

describe('camera highlight layout', () => {
  it('turns a sideways sensor strip into a horizontal line on the preview', () => {
    const sensor = { width: 800, height: 600 };
    const strip = { x: 420, y: 40, width: 22, height: 360 };
    expect(isHorizontalHighlight(strip, sensor, 0)).toBe(false);
    expect(isHorizontalHighlight(strip, sensor, 90)).toBe(true);

    const box = highlightPercents(strip, sensor, 90);
    expect(box).not.toBeNull();
    const width = Number.parseFloat(box!.width);
    const height = Number.parseFloat(box!.height);
    const left = Number.parseFloat(box!.left);
    const top = Number.parseFloat(box!.top);
    expect(width).toBeGreaterThan(height * 3);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(100.1);
    expect(top + height).toBeLessThanOrEqual(100.1);
  });

  it('keeps padding from painting the gap between two lines', () => {
    const frames = [
      { x: 10, y: 10, width: 120, height: 16 },
      { x: 10, y: 80, width: 120, height: 16 },
    ];
    const padded = padLineFrames(frames, { width: 200, height: 200 });
    expect(padded[0].y + padded[0].height).toBeLessThanOrEqual(padded[1].y);
    expect(padded[0].width).toBeGreaterThan(padded[0].height);
    expect(padded[1].width).toBeGreaterThan(padded[1].height);
  });

  it('keeps two tightly spaced lines from overlapping when padded together', () => {
    const image = { width: 200, height: 80 };
    const frames = [
      { x: 10, y: 10, width: 100, height: 20 },
      { x: 10, y: 32, width: 100, height: 20 },
    ];
    const boxes = highlightPercentsForFrames(frames, image, 0);
    const top0 = Number.parseFloat(boxes[0]!.top);
    const height0 = Number.parseFloat(boxes[0]!.height);
    const top1 = Number.parseFloat(boxes[1]!.top);
    expect(top0 + height0).toBeLessThanOrEqual(top1 + 0.001);
    const separate = [
      highlightPercents(frames[0], image, 0),
      highlightPercents(frames[1], image, 0),
    ];
    const separateBottom =
      Number.parseFloat(separate[0]!.top) + Number.parseFloat(separate[0]!.height);
    const separateTop = Number.parseFloat(separate[1]!.top);
    expect(separateBottom).toBeGreaterThan(separateTop);
  });

  it('letterboxes the photo inside the stage', () => {
    expect(
      containedPhotoSize({ width: 800, height: 400 }, 0, { width: 200, height: 400 }),
    ).toEqual({ width: 200, height: 100 });
    expect(containedPhotoSize({ width: 800, height: 400 }, 0, { width: 0, height: 0 })).toEqual({
      width: 0,
      height: 0,
    });
  });
});
