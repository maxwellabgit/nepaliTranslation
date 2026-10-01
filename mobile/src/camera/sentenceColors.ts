import { getTheme, type ColorScheme } from '../theme';

/** Crimson, saffron, then blue, from the shared theme tokens. */
export function lineHighlights(scheme: ColorScheme = 'light'): readonly [string, string, string] {
  const colors = getTheme(scheme).colors;
  return [colors.crimson, colors.saffron, colors.blue];
}

export const LINE_HIGHLIGHTS = lineHighlights('light');

export function colorForIndex(index: number, scheme: ColorScheme = 'light'): string {
  const palette = scheme === 'light' ? LINE_HIGHLIGHTS : lineHighlights(scheme);
  const size = palette.length;
  const slot = ((index % size) + size) % size;
  return palette[slot];
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
