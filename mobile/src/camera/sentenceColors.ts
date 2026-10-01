/** Crimson, saffron, then blue. Neighbors never share a color. */
export const LINE_HIGHLIGHTS = ['#C8102E', '#E8A317', '#1A73E8'] as const;

export function colorForIndex(index: number): string {
  const size = LINE_HIGHLIGHTS.length;
  const slot = ((index % size) + size) % size;
  return LINE_HIGHLIGHTS[slot];
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
