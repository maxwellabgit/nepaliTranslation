import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addHistory,
  loadHistory,
  updateHistoryTranslation,
  clearHistory,
  deleteHistoryItem,
} from '../phrasebook';

describe('local history edit', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('updates one row and leaves the others unchanged', async () => {
    await addHistory({
      id: 'a',
      source: 'hello',
      translation: 'नमस्ते',
      sourceLang: 'en',
      targetLang: 'ne',
    });
    await addHistory({
      id: 'b',
      source: 'thanks',
      translation: 'धन्यवाद',
      sourceLang: 'en',
      targetLang: 'ne',
    });

    expect(await updateHistoryTranslation('a', 'नमस्कार')).toBe(true);
    const rows = await loadHistory();
    expect(rows.find((row) => row.id === 'a')?.translation).toBe('नमस्कार');
    expect(rows.find((row) => row.id === 'b')?.translation).toBe('धन्यवाद');
    expect(await updateHistoryTranslation('missing', 'x')).toBe(false);
  });

  test('clears existing history once, then keeps rows saved after that', async () => {
    await AsyncStorage.setItem(
      'neptranslate.history.v1',
      JSON.stringify([
        {
          id: 'old',
          source: 'old',
          translation: 'पुरानो',
          sourceLang: 'en',
          targetLang: 'ne',
          createdAt: 1,
        },
      ]),
    );
    expect(await loadHistory()).toEqual([]);
    await addHistory({
      source: 'new',
      translation: 'नयाँ',
      sourceLang: 'en',
      targetLang: 'ne',
    });
    expect((await loadHistory()).map((row) => row.source)).toEqual(['new']);
  });
  test('Clear waits behind an earlier delayed add and no old rows are resurrected', async () => {
    const row = { id: 'old', source: 'old', translation: 'old target', sourceLang: 'en' as const, targetLang: 'ne' as const };
    await addHistory(row);
    const originalGet = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    let release!: () => void;
    let announce!: () => void;
    let held = false;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const snapshotReady = new Promise<void>((resolve) => { announce = resolve; });
    const get = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      const snapshot = await originalGet(key);
      if (key === 'neptranslate.history.v1' && !held) { held = true; announce(); await hold; }
      return snapshot;
    });
    const pendingAdd = addHistory({ ...row, id: 'before-clear', source: 'before clear' });
    await snapshotReady;
    const pendingClear = clearHistory();
    release();
    await Promise.all([pendingAdd, pendingClear]);
    get.mockImplementation(originalGet);
    expect(await loadHistory()).toEqual([]);
    await addHistory({ ...row, id: 'after-clear', source: 'after clear' });
    expect((await loadHistory()).map((item) => item.id)).toEqual(['after-clear']);
  });
  test('concurrent add, edit and delete preserve invocation order without lost rows', async () => {
    const row = { source: 'source', translation: 'target', sourceLang: 'en' as const, targetLang: 'ne' as const };
    await Promise.all([addHistory({ ...row, id: 'a', source: 'a' }), addHistory({ ...row, id: 'b', source: 'b' })]);
    expect(await loadHistory()).toHaveLength(2);
    await Promise.all([updateHistoryTranslation('a', 'edited'), deleteHistoryItem('b')]);
    expect((await loadHistory()).map((item) => [item.id, item.translation])).toEqual([['a', 'edited']]);
  });
  test('a failed write does not poison subsequent history mutations', async () => {
    await loadHistory();
    const originalWrite = (AsyncStorage.setItem as jest.Mock).getMockImplementation()!;
    const write = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    const row = { source: 'source', translation: 'target', sourceLang: 'en' as const, targetLang: 'ne' as const };
    await expect(addHistory({ ...row, id: 'failed' })).rejects.toThrow('disk full');
    write.mockImplementation(originalWrite);
    await addHistory({ ...row, id: 'success' });
    expect((await loadHistory()).map((item) => item.id)).toEqual(['success']);
  });
  test('failed mutation reads leave the existing list intact and allow recovery', async () => {
    const row = { id: 'old', source: 'old', translation: 'target', sourceLang: 'en' as const, targetLang: 'ne' as const };
    await addHistory(row);
    const originalGet = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
    const read = jest.spyOn(AsyncStorage, 'getItem').mockImplementation(async (key) => {
      if (key === 'neptranslate.history.v1') throw new Error('read failed');
      return originalGet(key);
    });
    await expect(addHistory({ ...row, id: 'new', source: 'new' })).rejects.toThrow('read failed');
    read.mockImplementation(originalGet);
    expect((await loadHistory()).map((item) => item.id)).toEqual(['old']);
    await clearHistory();
    expect(await loadHistory()).toEqual([]);
  });
});
