import type { HistoryItem } from './phrasebook';
import { contributionKeyFor, findDraftByKey } from './contributionOutbox';

export function trainingKeyFor(item: HistoryItem): string {
  return contributionKeyFor({
    source_text: item.source,
    model_output: item.translation,
    source_lang: item.sourceLang,
    formality: 'formal',
    script: 'deva',
  });
}

/** Keys already queued or synced — never silent-upload. */
export async function loadSentTrainingKeys(): Promise<Set<string>> {
  const { loadOutbox } = await import('./contributionOutbox');
  const items = await loadOutbox();
  return new Set(
    items
      .filter((d) => d.status === 'pending' || d.status === 'synced')
      .map((d) => d.idempotency_key),
  );
}

export async function hasTrainingDraft(item: HistoryItem): Promise<boolean> {
  const draft = await findDraftByKey(trainingKeyFor(item));
  return Boolean(draft);
}
