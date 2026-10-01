import { unionFrames } from './overlayGeometry';
import type { OcrFrame, OcrPoint, SourceSentence } from './ocrTypes';
import { languageForCategory, type SourceCategory } from './sourceCategory';

export type ClassifiedLine = {
  text: string;
  category: SourceCategory;
  frame: OcrFrame;
  polygon: OcrPoint[];
};

type WorkingGroup = {
  text: string;
  category: SourceCategory;
  frame: OcrFrame;
  frames: OcrFrame[];
  polygons: OcrPoint[][];
};

function horizontalOverlapRatio(a: OcrFrame, b: OcrFrame): number {
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const narrower = Math.min(a.width, b.width);
  if (!(narrower > 0)) return 0;
  return Math.max(0, overlap) / narrower;
}

function sameColumn(a: OcrFrame, b: OcrFrame): boolean {
  return horizontalOverlapRatio(a, b) >= 0.45;
}

function verticalGap(a: OcrFrame, b: OcrFrame): number {
  const upper = a.y <= b.y ? a : b;
  const lower = a.y <= b.y ? b : a;
  return lower.y - (upper.y + upper.height);
}

/** Wrapped lines of one paragraph sit tighter than a new passage. */
function tightWrap(a: OcrFrame, b: OcrFrame): boolean {
  const height = Math.max(a.height, b.height, 1);
  return verticalGap(a, b) < height * 0.35;
}

/** An interlinear gloss sits on the next band, not a column away. */
function verticallyClose(a: OcrFrame, b: OcrFrame): boolean {
  const height = Math.max(a.height, b.height, 1);
  return verticalGap(a, b) < height * 0.85;
}

function sameRow(a: OcrFrame, b: OcrFrame): boolean {
  const aMid = a.y + a.height / 2;
  const bMid = b.y + b.height / 2;
  return Math.abs(aMid - bMid) <= Math.max(a.height, b.height) * 0.6;
}

function horizontalGap(a: OcrFrame, b: OcrFrame): number {
  if (a.x + a.width < b.x) return b.x - (a.x + a.width);
  if (b.x + b.width < a.x) return a.x - (b.x + b.width);
  return 0;
}

/** A one-letter speck sitting on a longer line is an OCR split, not its own passage. */
function dropEmbeddedFragments(lines: ClassifiedLine[]): ClassifiedLine[] {
  return lines.filter((line) => {
    if ([...line.text.trim()].length !== 1) return true;
    const mid = line.frame.y + line.frame.height / 2;
    return !lines.some((other) => {
      if (other === line || [...other.text.trim()].length < 4) return false;
      return mid >= other.frame.y && mid <= other.frame.y + other.frame.height;
    });
  });
}

/** Join same-script pieces OCR split across one row, and leave a wide gap as separate cells. */
function mergeSameRowSplits(lines: ClassifiedLine[]): ClassifiedLine[] {
  const sorted = [...lines].sort((a, b) => a.frame.y - b.frame.y || a.frame.x - b.frame.x);
  const used = new Set<number>();
  const groups: WorkingGroup[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    if (used.has(index)) continue;
    const seed = sorted[index];
    if (!seed) continue;
    const current = asGroup(seed);
    used.add(index);
    let grew = true;
    while (grew) {
      grew = false;
      for (let otherIndex = 0; otherIndex < sorted.length; otherIndex += 1) {
        if (used.has(otherIndex)) continue;
        const other = sorted[otherIndex];
        if (!other || other.category !== current.category) continue;
        if (!sameRow(current.frame, other.frame)) continue;
        const limit = Math.max(current.frame.height, other.frame.height, 1);
        if (horizontalGap(current.frame, other.frame) > limit) continue;
        const next = asGroup(other);
        if (other.frame.x < current.frame.x) {
          current.text = `${next.text} ${current.text}`.replace(/\s+/g, ' ').trim();
          current.frames = [...next.frames, ...current.frames];
          current.polygons = [...next.polygons, ...current.polygons];
          current.frame = unionFrames([next.frame, current.frame]) ?? current.frame;
        } else {
          absorb(current, next);
        }
        used.add(otherIndex);
        grew = true;
      }
    }
    groups.push(current);
  }
  return groups.map((group) => ({
    text: group.text,
    category: group.category,
    frame: group.frame,
    polygon: group.polygons[0] ?? [],
  }));
}

function asGroup(line: ClassifiedLine): WorkingGroup {
  return {
    text: line.text.trim(),
    category: line.category,
    frame: line.frame,
    frames: [line.frame],
    polygons: [line.polygon],
  };
}

function absorb(into: WorkingGroup, next: WorkingGroup): void {
  into.text = `${into.text} ${next.text}`.replace(/\s+/g, ' ').trim();
  into.frames.push(...next.frames);
  into.polygons.push(...next.polygons);
  into.frame = unionFrames([into.frame, next.frame]) ?? into.frame;
}

function mergeTightWraps(lines: ClassifiedLine[]): WorkingGroup[] {
  const groups: WorkingGroup[] = [];
  for (const line of lines) {
    const next = asGroup(line);
    const prev = groups[groups.length - 1];
    if (
      prev &&
      prev.category === next.category &&
      sameColumn(prev.frame, next.frame) &&
      tightWrap(prev.frame, next.frame)
    ) {
      absorb(prev, next);
    } else {
      groups.push(next);
    }
  }
  return groups;
}

function takeBand(groups: WorkingGroup[], start: number): WorkingGroup[] {
  const band = [groups[start]];
  for (let index = start + 1; index < groups.length; index += 1) {
    const prev = band[band.length - 1];
    const next = groups[index];
    if (!prev || !next) break;
    if (next.category === prev.category && sameRow(prev.frame, next.frame)) {
      band.push(next);
      continue;
    }
    if (prev.category === 'en' || next.category === 'en') break;
    if (prev.category === next.category) break;
    if (!sameColumn(prev.frame, next.frame) || !verticallyClose(prev.frame, next.frame)) break;
    band.push(next);
  }
  return band;
}

function collapseBand(band: WorkingGroup[]): WorkingGroup[] {
  const order: SourceCategory[] = [];
  const buckets = new Map<SourceCategory, WorkingGroup>();
  for (const line of band) {
    const existing = buckets.get(line.category);
    if (!existing) {
      order.push(line.category);
      buckets.set(line.category, {
        ...line,
        frames: [...line.frames],
        polygons: [...line.polygons],
      });
    } else {
      absorb(existing, line);
    }
  }
  return order.flatMap((category) => {
    const group = buckets.get(category);
    return group ? [group] : [];
  });
}

/**
 * Keep side-by-side cells separate. Join an interlinear Devanagari/Roman
 * passage into one group per script, in the order those scripts first appear.
 * A band needs four lines so a single gloss pair is left as two lines.
 */
function collapseInterlinear(groups: WorkingGroup[]): WorkingGroup[] {
  const out: WorkingGroup[] = [];
  let index = 0;
  while (index < groups.length) {
    const band = takeBand(groups, index);
    if (band.length >= 4) {
      out.push(...collapseBand(band));
      index += band.length;
    } else {
      const current = groups[index];
      if (current) out.push(current);
      index += 1;
    }
  }
  return out;
}

export function groupCaptureLines(lines: ClassifiedLine[]): SourceSentence[] {
  const linesInOrder = mergeSameRowSplits(dropEmbeddedFragments(lines));
  return collapseInterlinear(mergeTightWraps(linesInOrder)).map((group, index) => ({
    id: `s${index + 1}`,
    text: group.text,
    language: languageForCategory(group.category),
    category: group.category,
    frames: group.frames,
    polygons: group.polygons,
  }));
}
