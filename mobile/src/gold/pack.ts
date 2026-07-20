import pack from '../../assets/gold/review_pack.json';
import type { GoldItem, GoldReviewPack } from './types';

export const goldPack = pack as GoldReviewPack;

export const GOLD_CLASSES = goldPack.classes.map((c) => c.id);

export function itemsForClass(classId: string): GoldItem[] {
  return goldPack.items.filter((i) => i.class_id === classId);
}

export function classMeta(classId: string) {
  return goldPack.classes.find((c) => c.id === classId);
}
