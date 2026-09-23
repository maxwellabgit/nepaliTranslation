import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addHistory,
  loadHistory,
  updateHistoryTranslation,
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
});
