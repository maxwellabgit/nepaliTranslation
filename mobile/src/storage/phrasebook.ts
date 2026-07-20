import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'neptranslate.history.v1';
const STARRED_KEY = 'neptranslate.starred.v1';

export type HistoryItem = {
  id: string;
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  targetLang: 'en' | 'ne';
  createdAt: number;
};

async function readList(key: string): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(key: string, items: HistoryItem[]) {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function loadHistory(): Promise<HistoryItem[]> {
  return readList(HISTORY_KEY);
}

export async function loadStarred(): Promise<HistoryItem[]> {
  return readList(STARRED_KEY);
}

export async function addHistory(item: Omit<HistoryItem, 'id' | 'createdAt'>) {
  const list = await loadHistory();
  const next: HistoryItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const deduped = [
    next,
    ...list.filter(
      (h) =>
        !(
          h.source === next.source &&
          h.translation === next.translation &&
          h.sourceLang === next.sourceLang
        ),
    ),
  ].slice(0, 100);
  await writeList(HISTORY_KEY, deduped);
  return next;
}

export async function toggleStar(item: Omit<HistoryItem, 'id' | 'createdAt'> | HistoryItem) {
  const list = await loadStarred();
  const existing = list.find(
    (h) =>
      h.source === item.source &&
      h.translation === item.translation &&
      h.sourceLang === item.sourceLang,
  );
  if (existing) {
    await writeList(
      STARRED_KEY,
      list.filter((h) => h.id !== existing.id),
    );
    return false;
  }
  const next: HistoryItem = {
    id: 'id' in item ? item.id : `${Date.now()}-star`,
    source: item.source,
    translation: item.translation,
    sourceLang: item.sourceLang,
    targetLang: item.targetLang,
    createdAt: Date.now(),
  };
  await writeList(STARRED_KEY, [next, ...list].slice(0, 100));
  return true;
}

export async function isStarred(
  source: string,
  translation: string,
  sourceLang: 'en' | 'ne',
): Promise<boolean> {
  const list = await loadStarred();
  return list.some(
    (h) =>
      h.source === source &&
      h.translation === translation &&
      h.sourceLang === sourceLang,
  );
}

export async function clearHistory() {
  await writeList(HISTORY_KEY, []);
}
