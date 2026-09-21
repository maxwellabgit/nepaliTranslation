const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition') as {
  ExpoSpeechRecognitionModule: {
    getSupportedLocales?: jest.Mock;
  };
};

const {
  getSttSupport,
  resetSttSupportCache,
} = jest.requireActual('../sttSupport') as typeof import('../sttSupport');

describe('getSttSupport fail-closed', () => {
  const mod = ExpoSpeechRecognitionModule;

  beforeEach(() => {
    resetSttSupportCache();
    mod.getSupportedLocales = jest.fn(async () => ({
      locales: [],
      installedLocales: [],
    }));
  });

  test('missing getSupportedLocales → both false', async () => {
    delete mod.getSupportedLocales;
    resetSttSupportCache();
    await expect(getSttSupport()).resolves.toEqual({ en: false, ne: false });
  });

  test('empty locales → both false', async () => {
    mod.getSupportedLocales = jest.fn(async () => ({
      locales: [],
      installedLocales: [],
    }));
    await expect(getSttSupport()).resolves.toEqual({ en: false, ne: false });
  });

  test('throwing probe → both false', async () => {
    mod.getSupportedLocales = jest.fn(async () => {
      throw new Error('probe failed');
    });
    await expect(getSttSupport()).resolves.toEqual({ en: false, ne: false });
  });

  test('prefers installedLocales for on-device', async () => {
    mod.getSupportedLocales = jest.fn(async () => ({
      locales: ['en-US', 'ne-NP', 'hi-IN'],
      installedLocales: ['en-US'],
    }));
    await expect(getSttSupport()).resolves.toEqual({ en: true, ne: false });
  });

  test('uses supported locales when installed list empty but supported present', async () => {
    mod.getSupportedLocales = jest.fn(async () => ({
      locales: ['en-GB', 'ne-NP'],
      installedLocales: [],
    }));
    await expect(getSttSupport()).resolves.toEqual({ en: true, ne: true });
  });
});
