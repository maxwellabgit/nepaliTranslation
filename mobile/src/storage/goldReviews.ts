import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GoldItem, GoldProvenance } from '../gold/types';

const KEY = 'neptranslate.gold_reviews.v1';

export type ReviewAction = 'accepted' | 'edited' | 'split';

export type GoldReview = {
  id: string;
  class_id: string;
  source_original: string;
  reference_original: string;
  source_final: string;
  reference_final: string;
  action: ReviewAction;
  completed_at: string;
  provenance: GoldProvenance;
  deva?: string | null;
  /** Parent gold id when this row was created by sentence split. */
  split_from?: string;
  split_index?: number;
  multi_sentence_flag?: boolean;
};

export type ReviewMap = Record<string, GoldReview>;

export async function loadReviews(): Promise<ReviewMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ReviewMap;
  } catch {
    return {};
  }
}

export async function saveReviews(map: ReviewMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

export async function upsertReview(review: GoldReview): Promise<ReviewMap> {
  const map = await loadReviews();
  map[review.id] = review;
  await saveReviews(map);
  return map;
}

export async function clearReviews(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export function completeFromItem(
  item: GoldItem,
  sourceFinal: string,
  referenceFinal: string,
  extra?: Partial<GoldReview>,
): GoldReview {
  const src = sourceFinal.trim();
  const ref = referenceFinal.trim();
  const edited =
    src !== item.source.trim() || ref !== item.reference.trim();
  return {
    id: item.id,
    class_id: item.class_id,
    source_original: item.source,
    reference_original: item.reference,
    source_final: src,
    reference_final: ref,
    action: edited ? 'edited' : 'accepted',
    completed_at: new Date().toISOString(),
    provenance: item.provenance,
    deva: item.deva ?? null,
    ...extra,
  };
}

export async function completeSentenceSplits(
  item: GoldItem,
  pairs: { source: string; reference: string }[],
): Promise<ReviewMap> {
  const map = await loadReviews();
  const now = new Date().toISOString();
  map[item.id] = {
    id: item.id,
    class_id: item.class_id,
    source_original: item.source,
    reference_original: item.reference,
    source_final: item.source,
    reference_final: item.reference,
    action: 'split',
    completed_at: now,
    provenance: item.provenance,
    deva: item.deva ?? null,
    multi_sentence_flag: true,
  };
  pairs.forEach((p, i) => {
    const kid = `${item.id}__s${i + 1}`;
    map[kid] = {
      id: kid,
      class_id: item.class_id,
      source_original: p.source,
      reference_original: p.reference,
      source_final: p.source.trim(),
      reference_final: p.reference.trim(),
      action: 'edited',
      completed_at: now,
      provenance: {
        ...item.provenance,
        dataset_id: 'human_app_review',
        trust: 'gold',
        note: `sentence split from ${item.id}`,
      },
      split_from: item.id,
      split_index: i + 1,
      multi_sentence_flag: false,
    };
  });
  await saveReviews(map);
  return map;
}

export function buildExportPayload(reviews: ReviewMap) {
  const completed = Object.values(reviews).filter((r) => r.completed_at);
  const byDataset: Record<string, number> = {};
  for (const r of completed) {
    const d = r.provenance?.dataset_id ?? 'unknown';
    byDataset[d] = (byDataset[d] ?? 0) + 1;
  }
  return {
    exported_at: new Date().toISOString(),
    model_family: 'indictrans2-dist-200M',
    n_completed: completed.length,
    by_dataset: byDataset,
    reviews: Object.fromEntries(completed.map((r) => [r.id, r])),
  };
}
