import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoldReviewItem } from '../gold/types';
import type {
  CorrectionRoute,
  MeaningReview,
  MeaningReviewAction,
  ReviewKind,
} from './meaningReviews';

const GOLD_KEY = 'neptranslate.gold_reviews.v1';

/** Payload the phone POSTs to this PC. */
export type SyncableReview = MeaningReview & {
  kind: ReviewKind;
  review_key: string;
  class_id?: string;
  item_id?: string;
  source_label?: string;
  target_label?: string;
  source_original?: string;
  source_final?: string;
  reference_original?: string;
  reference_final?: string;
  deva_original?: string | null;
  deva_final?: string | null;
};

export function reviewKeyOf(review: { review_key?: string; meaning_id: string }): string {
  return review.review_key || review.meaning_id;
}

export type GoldReviewMap = Record<string, SyncableReview>;

export async function loadGoldReviews(): Promise<GoldReviewMap> {
  try {
    const raw = await AsyncStorage.getItem(GOLD_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as GoldReviewMap;
  } catch {
    return {};
  }
}

export async function saveGoldReviews(map: GoldReviewMap): Promise<void> {
  await AsyncStorage.setItem(GOLD_KEY, JSON.stringify(map));
}

export function completeGoldSend(
  item: GoldReviewItem,
  finals: { source: string; reference: string; deva?: string },
): SyncableReview {
  const source = finals.source.trim();
  const reference = finals.reference.trim();
  const deva = (finals.deva ?? item.deva ?? '')?.toString().trim() || null;
  const fields: string[] = [];
  if (source !== item.source.trim()) fields.push('source');
  if (reference !== item.reference.trim()) fields.push('reference');
  if ((deva || '') !== (item.deva || '').trim()) fields.push('deva');
  const edited = fields.length > 0;
  const action: MeaningReviewAction = edited ? 'edited' : 'accepted';
  const route: CorrectionRoute = 'gold_holdout';
  const stamp = new Date().toISOString();
  return {
    kind: 'gold',
    review_key: `gold:${item.id}`,
    meaning_id: item.id,
    english: item.direction === 'en-ne' ? source : reference,
    ne_formal_original: item.direction === 'en-ne' && item.register === 'formal' ? item.reference : '',
    ne_informal_original:
      item.direction === 'en-ne' && item.register === 'informal' ? item.reference : '',
    roman_formal_original: item.script === 'roman' ? item.source : '',
    roman_informal_original: '',
    ne_formal_final: item.direction === 'en-ne' && item.register === 'formal' ? reference : '',
    ne_informal_final: item.direction === 'en-ne' && item.register === 'informal' ? reference : '',
    roman_formal_final: item.script === 'roman' ? source : '',
    roman_informal_final: '',
    action,
    flag_for_founder: false,
    route,
    surface: item.class_id,
    provenance: 'human_gold_review',
    completed_at: stamp,
    fields_changed: fields,
    class_id: item.class_id,
    item_id: item.id,
    source_label: item.source_label,
    target_label: item.target_label,
    source_original: item.source,
    source_final: source,
    reference_original: item.reference,
    reference_final: reference,
    deva_original: item.deva ?? null,
    deva_final: item.script === 'roman' ? deva : item.deva ?? null,
  };
}
