/** Preview-relative point in the 0–1 range the native camera expects. */
export function focusPointFromTap(
  locationX: number,
  locationY: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return null;
  return {
    x: Math.min(1, Math.max(0, locationX / width)),
    y: Math.min(1, Math.max(0, locationY / height)),
  };
}
