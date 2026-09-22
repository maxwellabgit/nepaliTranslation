import { useWindowDimensions } from 'react-native';

export type SizeClass = 'phone' | 'tablet11' | 'tablet13';

/** Rough iPad breakpoints for responsive chrome (points). */
export function sizeClassForWidth(width: number): SizeClass {
  if (width >= 1024) return 'tablet13';
  if (width >= 744) return 'tablet11';
  return 'phone';
}

export function useSizeClass(): SizeClass {
  const { width } = useWindowDimensions();
  return sizeClassForWidth(width);
}

/** Content max width on large tablets so Translate/Learn stay readable. */
export function contentMaxWidth(size: SizeClass): number | undefined {
  if (size === 'tablet13') return 720;
  if (size === 'tablet11') return 600;
  return undefined;
}

/** Minimum touch target for primary controls (pt). */
export const MIN_TOUCH = 44;
