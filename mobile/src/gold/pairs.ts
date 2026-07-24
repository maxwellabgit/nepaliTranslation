import { goldPack } from './pack';
import type { GoldItem } from './types';

/** Flat review queue — one gold pack row per sample (no lane categories). */
export function allReviewSamples(): GoldItem[] {
  return [...goldPack.items].sort((a, b) => a.id.localeCompare(b.id));
}

export function isPremiumSample(item: GoldItem): boolean {
  return (
    item.provenance.trust === 'gold' ||
    item.provenance.trust === 'high' ||
    item.provenance.tier === 'premium' ||
    item.provenance.tier === 'premium_word_choice'
  );
}

export function sampleKindLabel(item: GoldItem): string {
  const bits = [item.direction.replace('_', '→').toUpperCase()];
  if (item.register && item.register !== 'neutral') bits.push(item.register);
  if (item.script && item.script !== 'latin') bits.push(item.script);
  return bits.join(' · ');
}
