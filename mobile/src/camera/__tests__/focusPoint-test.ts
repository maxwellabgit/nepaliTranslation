import { focusPointFromTap } from '../focusPoint';

describe('focusPointFromTap', () => {
  it('maps a tap to the preview', () => {
    expect(focusPointFromTap(30, 80, 100, 200)).toEqual({ x: 0.3, y: 0.4 });
  });

  it('clamps taps that land outside the preview', () => {
    expect(focusPointFromTap(-10, 400, 100, 200)).toEqual({ x: 0, y: 1 });
  });

  it('waits until the preview has a size', () => {
    expect(focusPointFromTap(10, 10, 0, 200)).toBeNull();
    expect(focusPointFromTap(Number.NaN, 10, 100, 200)).toBeNull();
  });
});
