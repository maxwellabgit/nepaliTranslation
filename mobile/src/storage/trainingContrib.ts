import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HistoryItem } from './phrasebook';
import { sendLiveIncorrectToReviewSet } from './liveIncorrect';

const SENT_KEY = 'neptranslate.training_contrib_sent.v1';

/** Same pair from history should map to the same key regardless of row id. */
export function trainingKeyFor(item: Pick<HistoryItem, 'source' | 'translation' | 'sourceLang'>): string {
  return `${item.sourceLang}|${item.source.trim()}|${item.translation.trim()}`;
}

export async function loadSentTrainingKeys(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SENT_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function markSent(key: string): Promise<void> {
  const keys = await loadSentTrainingKeys();
  keys.add(key);
  await AsyncStorage.setItem(SENT_KEY, JSON.stringify([...keys].slice(-500)));
}

/**
 * Send one history pair to the training review set (founder queue).
 * Returns false if this pair was already sent.
 */
export async function sendHistoryItemToTraining(
  item: HistoryItem,
): Promise<{ ok: boolean; alreadySent: boolean; error?: string }> {
  const key = trainingKeyFor(item);
  const sent = await loadSentTrainingKeys();
  if (sent.has(key)) return { ok: false, alreadySent: true };

  const result = await sendLiveIncorrectToReviewSet({
    source: item.source,
    translation: item.translation,
    sourceLang: item.sourceLang,
    formality: 'formal',
    script: 'deva',
    origin: 'history_contribution',
  });
  if (!result.ok) return { ok: false, alreadySent: false, error: result.error };
  await markSent(key);
  return { ok: true, alreadySent: false };
}
