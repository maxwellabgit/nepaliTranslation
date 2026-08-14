import pack from '../../assets/data/gold_review_pack.json';
import type { GoldReviewItem, GoldReviewPack } from './types';

export const goldPack = pack as GoldReviewPack;

export function allGoldItems(): GoldReviewItem[] {
  return goldPack.items ?? [];
}

export function goldClassLabel(classId: string): string {
  const hit = (goldPack.classes ?? []).find((c) => c.id === classId);
  if (hit?.target_label && hit?.source_label) {
    return `${hit.source_label} → ${hit.target_label}`;
  }
  return classId;
}
