const PALETTE = ['#E6B325', '#2BBBAD', '#E15A6A', '#7C6BB0', '#3D8BFF', '#E07A3D'];

/**
 * Reading-order tints for the photo and the matching translation row.
 * Neighbors stay distinct; the same index always picks the same color.
 */
export const LINE_HIGHLIGHTS = [
  '#F4A3B5',
  '#F6D56A',
  '#8EBCF6',
  '#E4C56A',
  '#8FCBB0',
  '#F0A36A',
  '#C5B6E8',
];

/** Same sentence id always maps to the same highlight on the photo and in the drawer. */
export function colorForSentence(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

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
