import pack from '../../assets/meaning/review_pack.json';
import type { MeaningReviewPack, MeaningUnit } from './types';

export const meaningPack = pack as MeaningReviewPack;

export function allMeaningUnits(): MeaningUnit[] {
  return meaningPack.items ?? [];
}
