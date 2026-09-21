import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';

const HISTORY_KEY = 'neptranslate.history.v1';

export type TranslationDirection = 'en-ne' | 'ne-en';
export type TranslationMethod = 'phrase' | 'lexicon' | 'neural';

export type HistoryItem = {
  id: string;
  source: string;
  translation: string;
  sourceLang: 'en' | 'ne';
  targetLang: 'en' | 'ne';
  createdAt: number;
  /** Present on new rows; legacy rows may omit. */
  direction?: TranslationDirection;
  /** Present on new rows; legacy rows must not invent formal/deva. */
  formality?: Formality;
  /** Present on new rows; legacy rows must not invent formal/deva. */
  script?: NepaliScript;
  translationMethod?: TranslationMethod;
  modelVersion?: string;
};

function asLang(v: unknown): 'en' | 'ne' | null {
  return v === 'en' || v === 'ne' ? v : null;
}

function asFormality(v: unknown): Formality | undefined {
  return v === 'formal' || v === 'informal' ? v : undefined;
}

function asScript(v: unknown): NepaliScript | undefined {
  return v === 'deva' || v === 'roman' ? v : undefined;
}

function asMethod(v: unknown): TranslationMethod | undefined {
  return v === 'phrase' || v === 'lexicon' || v === 'neural' ? v : undefined;
}

function asDirection(
  v: unknown,
  sourceLang: 'en' | 'ne',
  targetLang: 'en' | 'ne',
): TranslationDirection | undefined {
  if (v === 'en-ne' || v === 'ne-en') return v;
  if (sourceLang === 'en' && targetLang === 'ne') return 'en-ne';
  if (sourceLang === 'ne' && targetLang === 'en') return 'ne-en';
  return undefined;
}

/** Normalize a stored row. Never invent formality/script for legacy items. */
export function normalizeHistoryItem(raw: unknown): HistoryItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const source = typeof row.source === 'string' ? row.source : '';
  const translation =
    typeof row.translation === 'string' ? row.translation : '';
  const sourceLang = asLang(row.sourceLang);
  const targetLang = asLang(row.targetLang);
  if (!sourceLang || !targetLang) return null;
  const id =
    typeof row.id === 'string' && row.id
      ? row.id
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt =
    typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
      ? row.createdAt
      : Date.now();
  const item: HistoryItem = {
    id,
    source,
    translation,
    sourceLang,
    targetLang,
    createdAt,
  };
  const direction = asDirection(row.direction, sourceLang, targetLang);
  if (direction) item.direction = direction;
  const formality = asFormality(row.formality);
  if (formality) item.formality = formality;
  const script = asScript(row.script);
  if (script) item.script = script;
  const translationMethod = asMethod(row.translationMethod);
  if (translationMethod) item.translationMethod = translationMethod;
  if (typeof row.modelVersion === 'string' && row.modelVersion.trim()) {
    item.modelVersion = row.modelVersion.trim();
  }
  return item;
}

async function readList(key: string): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeHistoryItem(row))
      .filter((row): row is HistoryItem => row != null);
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

export async function addHistory(
  item: Omit<HistoryItem, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: number;
  },
) {
  const list = await loadHistory();
  const next: HistoryItem = {
    ...item,
    id: item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: item.createdAt ?? Date.now(),
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

export async function clearHistory() {
  await writeList(HISTORY_KEY, []);
}

export async function deleteHistoryItem(id: string) {
  const list = await loadHistory();
  await writeList(
    HISTORY_KEY,
    list.filter((h) => h.id !== id),
  );
}
