import '@testing-library/react-native/matchers';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: true,
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-speech', () => ({
  stop: jest.fn(async () => undefined),
  speak: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
  isSpeakingAsync: jest.fn(async () => false),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    abort: jest.fn(),
    stop: jest.fn(),
    start: jest.fn(),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  isAvailableAsync: jest.fn(async () => false),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
}));

jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: { create: jest.fn() },
  Tensor: jest.fn(),
}));

jest.mock('../mt/TranslationEngine', () => ({
  sharedTranslationEngine: {
    warmUp: jest.fn(async () => undefined),
    whenReverseSettled: jest.fn(async () => undefined),
    isNeuralReady: jest.fn(() => false),
    cancelAll: jest.fn(),
    translate: jest.fn(async () => ({
      text: '',
      method: 'lexicon',
      cancelled: false,
    })),
  },
}));

jest.mock('../stt/sttSupport', () => ({
  hardStopRecognition: jest.fn(),
  getSttSupport: jest.fn(async () => ({
    available: false,
    permission: 'denied',
  })),
  hasNepaliVoice: jest.fn(async () => false),
}));

// Optional services soft-fail when unconfigured.
jest.mock('../services/supabase', () => ({
  getSupabase: jest.fn(() => null),
  bindAuthRefresh: jest.fn(),
}));
jest.mock('../features/subscription', () => ({}), { virtual: true });
