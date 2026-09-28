import {
  containedPhotoSize,
  highlightPercents,
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
    expect(padded[0].y + padded[0].height).toBeLessThan(padded[1].y);
    expect(padded[0].width).toBeGreaterThan(padded[0].height);
    expect(padded[1].width).toBeGreaterThan(padded[1].height);
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
