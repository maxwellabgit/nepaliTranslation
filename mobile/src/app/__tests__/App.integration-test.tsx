/**
 * Production-composition integration: real NepTranslateApp, real screens,
 * fake external adapters only. Not AppShell stand-in panes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { NepTranslateApp } from '../../../App';
import { hardStopRecognition } from '../../stt/sttSupport';
import { sharedTranslationEngine } from '../../mt/TranslationEngine';
import { createTestServices } from '../../services/createTestServices';
import { createTestRuntime } from '../../runtime/createTestRuntime';
import { listDrafts } from '../../storage/contributionOutbox';
import { clearHistory, loadHistory } from '../../storage/phrasebook';
import { setCameraTestFixture } from '../../camera/testFixture';
import { INSCRIPTION_FIXTURE } from '../../camera/inscriptionFixture';

jest.mock('../../../App', () => jest.requireActual('../../../App'));

async function renderApp(
  services = createTestServices({ offline: true }),
  runtime = undefined as ReturnType<typeof createTestRuntime> | undefined,
) {
  await act(async () => {
    render(
      <NepTranslateApp
        services={services}
        runtime={runtime}
        skipWarmUp
        bypassStartupConsent
      />,
    );
  });
  return services;
}

describe('NepTranslateApp production composition', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearHistory();
    const stt = require('../../stt/sttSupport') as {
      getSttSupport: jest.Mock;
      resetSttSupportCache?: () => void;
    };
    stt.resetSttSupportCache?.();
    stt.getSttSupport.mockReset();
    stt.getSttSupport.mockResolvedValue({ en: true, ne: true });
    (sharedTranslationEngine.translate as jest.Mock).mockImplementation(
      async (req: { text: string; preferred?: string }) => {
        const t = req.text.trim().toLowerCase();
        if (t === 'hello') {
          return {
            text: 'नमस्ते',
            method: 'phrase',
            direction: 'en-ne',
            cancelled: false,
          };
        }
        if (t === 'नमस्ते' || t.includes('नमस्ते')) {
          return {
            text: 'Hello',
            method: 'phrase',
            direction: 'ne-en',
            cancelled: false,
          };
        }
        return {
          text: '',
          method: 'lexicon',
          direction: req.preferred ?? 'en-ne',
          cancelled: false,
        };
      },
    );
    (sharedTranslationEngine.cancelAll as jest.Mock).mockClear();
    (hardStopRecognition as jest.Mock).mockClear();
    (Speech.stop as jest.Mock).mockClear();
    setCameraTestFixture(null);
  });

  it('guest cold launch with Supabase unavailable shows Translate, no login wall', async () => {
    await renderApp(createTestServices({ offline: true, authConfigured: false }));
    expect(screen.getByTestId('app-shell')).toBeTruthy();
    expect(screen.getByTestId('pane-translate')).toBeTruthy();
    expect(screen.getByTestId('translate-input')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    expect(screen.queryByText(/sign in to translate/i)).toBeNull();
  });

  it('types Hello and shows नमस्ते with real result actions', async () => {
    await renderApp();
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe(
        'नमस्ते',
      );
    });
    expect(screen.getByTestId('mark-incorrect')).toBeTruthy();
    expect(screen.getByLabelText('Speak translation aloud')).toBeTruthy();
  });

  it('translates through a recorded runtime adapter without the neural engine', async () => {
    const runtime = createTestRuntime({
      translations: [
        {
          match: (req) => req.text.toLowerCase() === 'hello',
          result: {
            text: 'नमस्ते',
            method: 'phrase',
            direction: 'en-ne',
          },
        },
      ],
    });
    await renderApp(createTestServices({ offline: true }), runtime);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe(
        'नमस्ते',
      );
    });
  });

  it('keeps typed translation working when on-device speech is unsupported', async () => {
    const { getSttSupport } = require('../../stt/sttSupport') as {
      getSttSupport: jest.Mock;
    };
    getSttSupport.mockResolvedValue({ en: false, ne: false });

    const runtime = createTestRuntime({
      translations: [
        {
          match: (req) => req.text.toLowerCase() === 'hello',
          result: {
            text: 'नमस्ते',
            method: 'phrase',
            direction: 'en-ne',
          },
        },
      ],
    });
    await renderApp(createTestServices({ offline: true }), runtime);

    await waitFor(() => {
      expect(screen.getByText(/speech is unavailable/i)).toBeTruthy();
    });
    expect(screen.getByTestId('speak-hero').props.accessibilityState?.disabled).toBe(
      true,
    );

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe(
        'नमस्ते',
      );
    });
  });

  it('shows permission denial when Speak is blocked', async () => {
    const runtime = createTestRuntime({ speechPermission: 'denied' });
    await renderApp(createTestServices({ offline: true }), runtime);
    await waitFor(() => {
      expect(screen.queryByText(/speech is unavailable/i)).toBeNull();
      expect(screen.getByTestId('speak-hero').props.accessibilityState?.disabled).not.toBe(
        true,
      );
    });
    await fireEvent.press(screen.getByTestId('speak-hero'));
    await waitFor(() => {
      expect(screen.getByText(/Microphone permission denied/i)).toBeTruthy();
    });
    expect(screen.getByTestId('translate-status-dismiss')).toBeTruthy();
  });

  it('surfaces a recoverable error when translation fails', async () => {
    const runtime = createTestRuntime({ translateError: 'boom' });
    await renderApp(createTestServices({ offline: true }), runtime);
    await waitFor(() => {
      expect(screen.queryByText(/speech is unavailable/i)).toBeNull();
    });
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByText(/Translation failed/i)).toBeTruthy();
    });
  });

  it('keeps a translation, moves Speak to the bottom, and returns to English after one pass each', async () => {
    await renderApp();
    expect(screen.getByTestId('speak-hero')).toBeTruthy();
    expect(screen.getByText('बोल्नुहोस्')).toBeTruthy();
    expect(screen.queryByTestId('speak-dock')).toBeNull();
    expect(screen.queryByTestId('tab-conversation')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output')).toBeTruthy();
    });
    expect(screen.queryByTestId('speak-hero')).toBeNull();
    expect(screen.getByTestId('speak-dock')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('pass-phone'));
    expect(screen.getByLabelText('पास')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'नमस्ते');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe('Hello');
    });
    await fireEvent.press(screen.getByTestId('pass-phone'));
    expect(screen.getByLabelText('Pass')).toBeTruthy();
    expect(screen.getByLabelText('English').props.accessibilityState?.selected).toBe(
      true,
    );

    await fireEvent.press(screen.getByTestId('tab-learn'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
    });
    expect(screen.getByTestId('learn-roman-a').props.children).toBe('a');

    await fireEvent.press(screen.getByTestId('tab-translate'));
    expect(screen.getByTestId('translate-output')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
    expect(screen.getByTestId('learn-roman-aa').props.children).toBe('aa');
  });

  it('tab switch calls STT, TTS, and MT hard-stop boundaries', async () => {
    await renderApp();
    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(hardStopRecognition).toHaveBeenCalled();
    expect(Speech.stop).toHaveBeenCalled();
    expect(sharedTranslationEngine.cancelAll).toHaveBeenCalled();
  });

  it('opens History and Settings overlays and restores a History item', async () => {
    await renderApp();
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(async () => {
      const hist = await loadHistory();
      expect(hist.length).toBeGreaterThan(0);
    });

    await fireEvent.press(screen.getByLabelText('History'));
    expect(screen.getByTestId('overlay-history')).toBeTruthy();
    const hist = await loadHistory();
    await fireEvent.press(screen.getByTestId(`history-item-${hist[0].id}`));
    await waitFor(() => {
      expect(screen.queryByTestId('overlay-history')).toBeNull();
      expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    });

    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('overlay-settings')).toBeTruthy();
    expect(screen.getByTestId('account-section')).toBeTruthy();
    expect(screen.getByTestId('settings-quality')).toBeTruthy();
    expect(screen.getByText(/Translation may be imperfect/i)).toBeTruthy();
    expect(screen.getByTestId('settings-privacy')).toBeTruthy();
    expect(screen.getByText(/not saved to your photo library/i)).toBeTruthy();
  });

  it('signed-out guest reaches Camera and Learn without a login wall when auth is configured', async () => {
    await renderApp(
      createTestServices({ offline: true, authConfigured: true }),
    );
    expect(screen.getByTestId('pane-translate')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(screen.getByTestId('pane-camera')).toBeTruthy();
    expect(screen.getByTestId('camera-permission')).toBeTruthy();
    expect(screen.getByText(/Camera OCR runs on this phone/i)).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    expect(screen.queryByText(/sign in to (translate|use camera|learn)/i)).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-learn'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
  });

  it('saves a guest correction in local history without queuing a contribution', async () => {
    const services = createTestServices({ offline: true });
    const view = await render(
      <NepTranslateApp services={services} skipWarmUp bypassStartupConsent />,
    );

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('mark-incorrect')).toBeTruthy();
    });
    await fireEvent.press(screen.getByTestId('mark-incorrect'));
    await waitFor(() => {
      expect(screen.getByTestId('correction-sheet')).toBeTruthy();
    });
    await fireEvent.changeText(
      screen.getByTestId('correction-input'),
      'नमस्कार',
    );
    await fireEvent.press(screen.getByTestId('correction-save-draft'));
    await waitFor(async () => {
      const history = await loadHistory();
      expect(history[0].translation).toBe('नमस्कार');
    });
    expect(await listDrafts()).toHaveLength(0);

    await view.unmount();
    await act(async () => {
      render(
        <NepTranslateApp
          services={services}
          skipWarmUp
          bypassStartupConsent
        />,
      );
    });
    const history = await loadHistory();
    expect(history[0].translation).toBe('नमस्कार');
    expect(await listDrafts()).toHaveLength(0);
  });

  it('offline launch keeps core panes usable with zero ad network calls', async () => {
    const services = createTestServices({
      offline: true,
      flags: { networkAdsEnabled: true, rewardedAdsEnabled: true },
    });
    await renderApp(services);
    expect(screen.getByTestId('tab-translate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-camera'));
    expect(screen.getByTestId('camera-permission')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    await fireEvent.press(screen.getByTestId('tab-learn'));
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
    expect(screen.getByTestId('learn-earn-rewards')).toBeTruthy();
    expect(screen.getByLabelText('Translate tab')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-translate'));
    await fireEvent.press(screen.getByLabelText('History'));
    expect(screen.getByTestId('overlay-history')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('history-close'));
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('overlay-settings')).toBeTruthy();
    expect(services.ads.networkCalls()).toEqual([]);
  });

  it('shows accessible auth failure feedback', async () => {
    const services = createTestServices({
      authError: 'Could not reach the account server.',
    });
    await renderApp(services);
    expect(screen.getByTestId('auth-status-banner')).toBeTruthy();
    expect(screen.getByTestId('auth-status-message').props.children).toBe(
      'Could not reach the account server.',
    );
    expect(screen.getByLabelText('Dismiss sign-in message')).toBeTruthy();
    // Translate still usable.
    expect(screen.getByTestId('translate-input')).toBeTruthy();
  });

  it('production Settings has no Meaning Review route or control', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(screen.getByTestId('overlay-settings')).toBeTruthy();
    expect(screen.queryByLabelText('Open Meaning Review')).toBeNull();
    expect(screen.queryByText('Meaning Review')).toBeNull();
    expect(screen.queryByTestId('overlay-meaning')).toBeNull();
    expect(screen.queryByText(/Developer tool/i)).toBeNull();
  });

  it('renders idle Translate house ad offline (no network); none on result review', async () => {
    const services = createTestServices({
      offline: true,
      flags: { networkAdsEnabled: true },
      canRequestAds: true,
    });
    await renderApp(services);
    await waitFor(() => {
      expect(screen.getByTestId('ad-slot-house-translate_idle')).toBeTruthy();
    });
    expect(services.ads.networkCalls()).toEqual([]);

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe(
        'नमस्ते',
      );
    });
    expect(screen.queryByTestId('ad-slot-house-translate_idle')).toBeNull();
    expect(screen.queryByTestId('ad-slot-house-translate_result')).toBeNull();
    expect(services.ads.networkCalls()).toEqual([]);
  });

  it('shows inscription overlays in a collapsed drawer without signing in', async () => {
    setCameraTestFixture(INSCRIPTION_FIXTURE);
    await renderApp(createTestServices({ offline: true, authConfigured: false }));
    await fireEvent.press(screen.getByTestId('tab-camera'));
    await waitFor(() => {
      expect(screen.getByTestId('camera-overlay-s1')).toBeTruthy();
    });
    expect(screen.getByTestId('camera-overlay-s2')).toBeTruthy();
    expect(screen.getByTestId('camera-overlay-s3')).toBeTruthy();
    expect(screen.getByTestId('camera-drawer').props.accessibilityState?.expanded).toBe(
      false,
    );
    expect(screen.getByText('Hail to Lord Shiva.')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    expect(screen.queryByTestId('camera-preview')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(screen.queryByTestId('camera-overlay-s1')).toBeNull();
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
  });
});
