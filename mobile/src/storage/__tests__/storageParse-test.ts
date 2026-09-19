import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadHistory, clearHistory, addHistory } from '../phrasebook';
import { loadPrefs } from '../prefs';

describe('storage parse failures', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('loadHistory returns [] on corrupt JSON', async () => {
    await AsyncStorage.setItem('neptranslate.history.v1', '{not-json');
    await expect(loadHistory()).resolves.toEqual([]);
  });

  test('loadHistory returns [] when stored value is not an array', async () => {
    await AsyncStorage.setItem(
      'neptranslate.history.v1',
      JSON.stringify({ nope: true }),
    );
    await expect(loadHistory()).resolves.toEqual([]);
  });

  test('loadPrefs falls back to defaults on corrupt JSON', async () => {
    await AsyncStorage.setItem('neptranslate.prefs.v1', '!!!');
    await expect(loadPrefs()).resolves.toEqual({
      formalOn: true,
      devaOn: true,
      conversationConsentSeen: false,
    });
  });

  test('loadPrefs ignores non-boolean fields', async () => {
    await AsyncStorage.setItem(
      'neptranslate.prefs.v1',
      JSON.stringify({ formalOn: 'yes', devaOn: false }),
    );
    const prefs = await loadPrefs();
    expect(prefs.formalOn).toBe(true);
    expect(prefs.devaOn).toBe(false);
  });

  test('clearHistory empties a populated list', async () => {
    await addHistory({
      source: 'hi',
      translation: 'नमस्ते',
      sourceLang: 'en',
      targetLang: 'ne',
    });
    expect((await loadHistory()).length).toBe(1);
    await clearHistory();
    await expect(loadHistory()).resolves.toEqual([]);
  });
});
