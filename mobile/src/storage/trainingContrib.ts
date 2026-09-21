import type { HistoryItem } from './phrasebook';
import {
  contributionFingerprintFor,
  findDraftByFingerprint,
  loadOutbox,
} from './contributionOutbox';

export function trainingKeyFor(item: HistoryItem): string {
  return contributionFingerprintFor({
    source_text: item.source,
    model_output: item.translation,
    source_lang: item.sourceLang,
    formality: item.formality ?? null,
    script: item.script ?? null,
  });
}

/** Keys already queued or synced — never silent-upload. */
export async function loadSentTrainingKeys(): Promise<Set<string>> {
  const items = await loadOutbox();
  return new Set(
    items
      .filter(
        (d) =>
          d.status === 'queued' ||
          d.status === 'syncing' ||
          d.status === 'retry' ||
          d.status === 'synced',
      )
      .map((d) => d.local_fingerprint),
  );
}

export async function hasTrainingDraft(item: HistoryItem): Promise<boolean> {
  const draft = await findDraftByFingerprint(trainingKeyFor(item));
  return Boolean(draft);
}
