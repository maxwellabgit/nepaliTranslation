import '@testing-library/react-native/matchers';
import { configure } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import './consoleGuard';
import { setCameraTestFixture } from '../camera/testFixture';

configure({ asyncUtilTimeout: 8000 });

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

jest.mock('expo-apple-authentication', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    signInAsync: jest.fn(),
    refreshAsync: jest.fn(),
    isAvailableAsync: jest.fn(async () => true),
    addRevokeListener: jest.fn(() => ({ remove: jest.fn() })),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1 },
    AppleAuthenticationButtonStyle: { BLACK: 0, WHITE: 1, WHITE_OUTLINE: 2 },
    AppleAuthenticationButton: ({ onPress, accessibilityLabel }: {
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        Pressable,
        {
          onPress,
          accessibilityRole: 'button',
          accessibilityLabel: accessibilityLabel ?? 'Sign in with Apple',
          testID: 'apple-auth-button',
        },
        React.createElement(Text, null, 'Sign in with Apple'),
      ),
  };
});

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>();
  (globalThis as { __nepSecureStore?: Map<string, string> }).__nepSecureStore = mem;
  return {
    getItemAsync: jest.fn(async (key: string) => mem.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      mem.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      mem.delete(key);
    }),
    AFTER_FIRST_UNLOCK: 0,
  };
});

jest.mock('expo-crypto', () => {
  let uuidSeq = 0;
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn(async (_alg: string, data: string) => `sha256:${data}`),
    getRandomBytesAsync: jest.fn(async (n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = (i * 17 + 3) % 256;
      return out;
    }),
    getRandomBytes: jest.fn((n: number) => {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = (i * 17 + 3) % 256;
      return out;
    }),
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

jest.mock('react-native-google-mobile-ads', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: () => ({
      initialize: jest.fn(async () => undefined),
    }),
    MobileAds: () => ({
      initialize: jest.fn(async () => undefined),
    }),
    AdsConsent: {
      gatherConsent: jest.fn(async () => ({
        canRequestAds: false,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      })),
      showPrivacyOptionsForm: jest.fn(async () => undefined),
    },
    AdsConsentPrivacyOptionsRequirementStatus: {
      REQUIRED: 'REQUIRED',
      NOT_REQUIRED: 'NOT_REQUIRED',
      UNKNOWN: 'UNKNOWN',
    },
    TestIds: {
      BANNER: 'ca-app-pub-3940256099942544/2934735716',
      REWARDED: 'ca-app-pub-3940256099942544/1712485313',
      ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/2435281174',
    },
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
    },
    BannerAd: ({ unitId }: { unitId: string }) =>
      React.createElement(
        View,
        { testID: 'mock-banner-ad' },
        React.createElement(Text, null, unitId),
      ),
    RewardedAd: {
      createForAdRequest: jest.fn(() => {
        const listeners = new Map<string, () => void>();
        return {
          load: jest.fn(async () => {
            listeners.get('loaded')?.();
          }),
          show: jest.fn(async () => {
            listeners.get('earned_reward')?.();
          }),
          addAdEventListener: jest.fn((event: string, cb: () => void) => {
            listeners.set(event, cb);
            return jest.fn();
          }),
        };
      }),
    },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
  };
});

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
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: (props: object) => React.createElement(View, props),
    useCameraPermissions: () => [
      { granted: false, canAskAgain: true },
      jest.fn(async () => ({ granted: false, canAskAgain: true })),
    ],
  };
});

jest.mock('../features/subscription', () => ({}), { virtual: true });

beforeEach(async () => {
  setCameraTestFixture(null);
  (globalThis as { __nepSecureStore?: Map<string, string> }).__nepSecureStore?.clear();
  await AsyncStorage.clear();
});
