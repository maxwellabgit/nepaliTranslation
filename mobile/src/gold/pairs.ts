import { goldPack } from './pack';
import type { GoldItem } from './types';

export type ReviewLane = 'en_ne' | 'ne_en';

export const REVIEW_LANES: { id: ReviewLane; label: string }[] = [
  { id: 'en_ne', label: 'En→Ne formal/informal' },
  { id: 'ne_en', label: 'Ne→En Deva/Roman' },
];

/** One review card: shared English + two register/script variants. */
export type ReviewUnit = {
  id: string;
  lane: ReviewLane;
  /** English shown once (source for EN→NE, target for NE→EN). */
  shared: string;
  sharedLabel: string;
  left: GoldItem | null;
  right: GoldItem | null;
  leftLabel: string;
  rightLabel: string;
  itemIds: string[];
};

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:।]+$/u, '')
    .replace(/\s+/g, ' ');
}

function sortItems(a: GoldItem, b: GoldItem): number {
  return a.id.localeCompare(b.id);
}

function buildEnNeUnits(): ReviewUnit[] {
  const formal = goldPack.items.filter((i) => i.class_id === 'en_ne_formal');
  const informal = goldPack.items.filter((i) => i.class_id === 'en_ne_informal');
  const byKey = new Map<string, { formal?: GoldItem; informal?: GoldItem }>();

  for (const item of formal) {
    const key = normKey(item.source);
    const slot = byKey.get(key) ?? {};
    slot.formal = item;
    byKey.set(key, slot);
  }
  for (const item of informal) {
    const key = normKey(item.source);
    const slot = byKey.get(key) ?? {};
    slot.informal = item;
    byKey.set(key, slot);
  }

  const units: ReviewUnit[] = [];
  for (const [key, slot] of byKey) {
    const left = slot.formal ?? null;
    const right = slot.informal ?? null;
    const primary = left ?? right!;
    const itemIds = [left, right].filter(Boolean).map((i) => i!.id);
    units.push({
      id: `en_ne:${key}`,
      lane: 'en_ne',
      shared: primary.source,
      sharedLabel: 'English',
      left,
      right,
      leftLabel: 'Nepali (formal)',
      rightLabel: 'Nepali (informal)',
      itemIds,
    });
  }

  return units.sort((a, b) => {
    const ai = a.left ?? a.right!;
    const bi = b.left ?? b.right!;
    return sortItems(ai, bi);
  });
}

function buildNeEnUnits(): ReviewUnit[] {
  const deva = goldPack.items.filter((i) => i.class_id === 'ne_en_deva');
  const roman = goldPack.items.filter((i) => i.class_id === 'ne_en_roman');
  const byKey = new Map<string, { deva?: GoldItem; roman?: GoldItem }>();

  for (const item of deva) {
    const key = normKey(item.reference);
    const slot = byKey.get(key) ?? {};
    slot.deva = item;
    byKey.set(key, slot);
  }
  for (const item of roman) {
    const key = normKey(item.reference);
    const slot = byKey.get(key) ?? {};
    slot.roman = item;
    byKey.set(key, slot);
  }

  const units: ReviewUnit[] = [];
  for (const [key, slot] of byKey) {
    const left = slot.deva ?? null;
    const right = slot.roman ?? null;
    const primary = left ?? right!;
    const itemIds = [left, right].filter(Boolean).map((i) => i!.id);
    units.push({
      id: `ne_en:${key}`,
      lane: 'ne_en',
      shared: primary.reference,
      sharedLabel: 'English',
      left,
      right,
      leftLabel: 'Nepali (Devanagari)',
      rightLabel: 'Nepali (Roman)',
      itemIds,
    });
  }

  return units.sort((a, b) => {
    const ai = a.left ?? a.right!;
    const bi = b.left ?? b.right!;
    return sortItems(ai, bi);
  });
}

const EN_NE_UNITS = buildEnNeUnits();
const NE_EN_UNITS = buildNeEnUnits();

export function unitsForLane(lane: ReviewLane): ReviewUnit[] {
  return lane === 'en_ne' ? EN_NE_UNITS : NE_EN_UNITS;
}

export function allReviewUnits(): ReviewUnit[] {
  return [...EN_NE_UNITS, ...NE_EN_UNITS];
}

export function unitStats() {
  return {
    en_ne: EN_NE_UNITS.length,
    ne_en: NE_EN_UNITS.length,
    total_units: EN_NE_UNITS.length + NE_EN_UNITS.length,
    total_items: goldPack.n_items,
  };
}
