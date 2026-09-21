const PALETTE = ['#E6B325', '#2BBBAD', '#E15A6A', '#7C6BB0', '#3D8BFF', '#E07A3D'];

/** Same sentence id always maps to the same highlight on the photo and in the drawer. */
export function colorForSentence(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
