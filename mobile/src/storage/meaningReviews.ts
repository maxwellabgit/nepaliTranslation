import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MeaningUnit } from '../meaning/types';

const KEY = 'neptranslate.meaning_reviews.v1';

export type MeaningReviewAction = 'accepted' | 'edited' | 'skipped';

/** Route hint for PC-side correction router. */
export type CorrectionRoute =
  | 'train_meaning'
  | 'founder_queue'
  | 'eval_probe';

export type MeaningReview = {
  meaning_id: string;
  english: string;
  ne_formal_original: string;
  ne_informal_original: string;
  roman_formal_original: string;
  roman_informal_original: string;
  ne_formal_final: string;
  ne_informal_final: string;
  roman_formal_final: string;
  roman_informal_final: string;
  action: MeaningReviewAction;
  /** Skip always flags for founder review. */
  flag_for_founder: boolean;
  route: CorrectionRoute;
  surface: string;
  provenance: string;
  completed_at: string;
  fields_changed: string[];
};

export type MeaningReviewMap = Record<string, MeaningReview>;

export async function loadMeaningReviews(): Promise<MeaningReviewMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MeaningReviewMap;
  } catch {
    return {};
  }
}

export async function saveMeaningReviews(map: MeaningReviewMap): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

function changedFields(
  unit: MeaningUnit,
  finals: {
    ne_formal: string;
    ne_informal: string;
    roman_formal: string;
    roman_informal: string;
  },
): string[] {
  const out: string[] = [];
  if (finals.ne_formal !== unit.ne_formal.trim()) out.push('ne_formal');
  if (finals.ne_informal !== unit.ne_informal.trim()) out.push('ne_informal');
  if (finals.roman_formal !== unit.roman_formal.trim()) out.push('roman_formal');
  if (finals.roman_informal !== unit.roman_informal.trim()) out.push('roman_informal');
  return out;
}

export function completeMeaningAccept(
  unit: MeaningUnit,
  finals: {
    ne_formal: string;
    ne_informal: string;
    roman_formal: string;
    roman_informal: string;
  },
): MeaningReview {
  const fields = changedFields(unit, finals);
  const edited = fields.length > 0;
  return {
    meaning_id: unit.meaning_id,
    english: unit.english,
    ne_formal_original: unit.ne_formal,
    ne_informal_original: unit.ne_informal,
    roman_formal_original: unit.roman_formal,
    roman_informal_original: unit.roman_informal,
    ne_formal_final: finals.ne_formal.trim(),
    ne_informal_final: finals.ne_informal.trim(),
    roman_formal_final: finals.roman_formal.trim(),
    roman_informal_final: finals.roman_informal.trim(),
    action: edited ? 'edited' : 'accepted',
    flag_for_founder: false,
    route: 'train_meaning',
    surface: unit.surface,
    provenance: unit.provenance,
    completed_at: new Date().toISOString(),
    fields_changed: fields,
  };
}

export function completeMeaningSkip(unit: MeaningUnit): MeaningReview {
  return {
    meaning_id: unit.meaning_id,
    english: unit.english,
    ne_formal_original: unit.ne_formal,
    ne_informal_original: unit.ne_informal,
    roman_formal_original: unit.roman_formal,
    roman_informal_original: unit.roman_informal,
    ne_formal_final: unit.ne_formal,
    ne_informal_final: unit.ne_informal,
    roman_formal_final: unit.roman_formal,
    roman_informal_final: unit.roman_informal,
    action: 'skipped',
    flag_for_founder: true,
    route: 'founder_queue',
    surface: unit.surface,
    provenance: unit.provenance,
    completed_at: new Date().toISOString(),
    fields_changed: [],
  };
}

export function buildMeaningExportPayload(reviews: MeaningReviewMap) {
  const completed = Object.values(reviews).filter((r) => r.completed_at);
  const n_edited = completed.filter((r) => r.action === 'edited').length;
  const n_accepted = completed.filter((r) => r.action === 'accepted').length;
  const n_skipped = completed.filter((r) => r.action === 'skipped').length;
  const by_route: Record<string, number> = {};
  for (const r of completed) {
    by_route[r.route] = (by_route[r.route] ?? 0) + 1;
  }
  return {
    export_kind: 'meaning_unit_reviews',
    exported_at: new Date().toISOString(),
    model_family: 'indictrans2-dist-200M',
    n_completed: completed.length,
    n_edited,
    n_accepted,
    n_skipped,
    by_route,
    /** PC: python training/route_corrections.py <file> */
    reviews: Object.fromEntries(completed.map((r) => [r.meaning_id, r])),
  };
}
