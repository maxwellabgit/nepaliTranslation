import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';
import type { MeaningReview } from './meaningReviews';
import { enqueueReviewSync, flushReviewSync } from '../sync/reviewSync';

export type LiveIncorrectInput = {
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  formality: Formality;
  script: NepaliScript;
  /** Provenance tag; defaults to the Mark-incorrect flow. */
  origin?: 'user_mark_incorrect' | 'history_contribution';
};

function shortId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 8);
}

/**
 * Build a Meaning Review payload that routes to the founder / training
 * data review set (same path as Meaning Review "Skip").
 */
export function buildLiveIncorrectReview(input: LiveIncorrectInput): MeaningReview {
  const source = input.source.trim();
  const translation = input.translation.trim();
  const english = input.sourceLang === 'en' ? source : translation;
  const nepali = input.sourceLang === 'en' ? translation : source;
  const formal = input.formality === 'formal';
  const stamp = new Date().toISOString();
  const meaning_id = `live_${shortId(`${english}|${nepali}|${stamp}`)}_${Date.now().toString(36)}`;

  const ne_formal = formal ? nepali : '';
  const ne_informal = formal ? '' : nepali;
  const origin = input.origin ?? 'user_mark_incorrect';

  return {
    meaning_id,
    english,
    ne_formal_original: ne_formal,
    ne_informal_original: ne_informal,
    roman_formal_original: '',
    roman_informal_original: '',
    ne_formal_final: ne_formal,
    ne_informal_final: ne_informal,
    roman_formal_final: '',
    roman_informal_final: '',
    action: 'skipped',
    flag_for_founder: true,
    route: 'founder_queue',
    surface: 'live_translate',
    provenance: `${origin}:${input.sourceLang === 'en' ? 'en-ne' : 'ne-en'}:${input.formality}:${input.script}`,
    completed_at: stamp,
    fields_changed: [],
  };
}

/**
 * Queue + flush a live "Mark incorrect" flag to the training review sync inbox.
 */
export async function sendLiveIncorrectToReviewSet(
  input: LiveIncorrectInput,
): Promise<{ ok: true; meaning_id: string } | { ok: false; error: string }> {
  const source = input.source.trim();
  const translation = input.translation.trim();
  if (!source || !translation) {
    return { ok: false, error: 'Nothing to mark' };
  }
  const review = buildLiveIncorrectReview(input);
  await enqueueReviewSync(review);
  const flush = await flushReviewSync({ reason: 'mark_incorrect' });
  if (!flush.ok) {
    // Still queued locally — sync will retry later.
    return { ok: true, meaning_id: review.meaning_id };
  }
  return { ok: true, meaning_id: review.meaning_id };
}
