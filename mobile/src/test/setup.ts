import '@testing-library/react-native/matchers';
import './consoleGuard';

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
    requestPermissionsAsync: jest.fn(async () => ({
      granted: true,
      status: 'granted',
    })),
    getPermissionsAsync: jest.fn(async () => ({
      granted: true,
      status: 'granted',
    })),
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

jest.mock('expo-crypto', () => {
  let uuidSeq = 0;
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async () => 'hashed-nonce'),
    randomUUID: jest.fn(() => {
      uuidSeq += 1;
      const n = String(uuidSeq).padStart(12, '0');
      return `00000000-0000-4000-8000-${n}`;
    }),
  };
});

jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'WIFI',
  })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
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
