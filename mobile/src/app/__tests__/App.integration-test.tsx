/**
 * Production-composition integration: real NepTranslateApp, real screens,
 * fake external adapters only. Not AppShell stand-in panes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { StyleSheet } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';

import { NepTranslateApp } from '../../../App';
import { t } from '../../i18n';
import { formatNepaliScript } from '../../mt/romanize';
import { hardStopRecognition } from '../../stt/sttSupport';
import { sharedTranslationEngine } from '../../mt/TranslationEngine';
import { createTestServices } from '../../services/createTestServices';
import { createTestRuntime } from '../../runtime/createTestRuntime';
import { listDrafts } from '../../storage/contributionOutbox';
import { clearHistory, loadHistory } from '../../storage/phrasebook';
import { setCameraTestFixture } from '../../camera/testFixture';
import { INSCRIPTION_FIXTURE } from '../../camera/inscriptionFixture';
import { loadPrefs } from '../../storage/prefs';

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
  it('selects Romanized Nepali in Settings and updates global chrome and saved script', async () => {
    await renderApp();
    await act(async () => { fireEvent.press(screen.getByTestId('open-settings')); });
    await act(async () => { fireEvent.press(screen.getByTestId('settings-lang-ne-roman')); });
    expect(screen.getByTestId('settings-lang-ne-roman').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(t('settings.title', 'ne-roman'))).toBeTruthy();
    await waitFor(async () => expect(await loadPrefs()).toMatchObject({ uiLang: 'ne-roman', devaOn: false }));
  });
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
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    expect(StyleSheet.flatten(screen.getByTestId('translate-output').props.style).color).toBe('#000000');
  });

  it('keeps typed text across language switches and submits using the visible button', async () => {
    await renderApp();
    expect(screen.queryByTestId('translate-send')).toBeNull();
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    expect(screen.getByTestId('translate-send').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent.press(screen.getByLabelText('Nepali'));
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    await fireEvent.press(screen.getByLabelText('English'));
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    await fireEvent.press(screen.getByTestId('translate-send'));
    await waitFor(() => expect(screen.getByTestId('translate-output').props.children).toBe('नमस्ते'));
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    expect(StyleSheet.flatten(screen.getByTestId('translate-output').props.style).color).toBe('#000000');
  });

  it('reveals Send only on input focus, hides it on blur and retains keyboard submission', async () => {
    await renderApp();
    expect(screen.queryByTestId('translate-send')).toBeNull();
    expect(screen.queryByText('0/240')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    expect(screen.queryByTestId('translate-send')).toBeNull();
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    expect(screen.getByTestId('translate-send')).toBeTruthy();
    await fireEvent(screen.getByTestId('translate-input'), 'blur');
    expect(screen.queryByTestId('translate-send')).toBeNull();
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => expect(screen.getByTestId('translate-output').props.children).toBe('नमस्ते'));
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    expect(screen.getByTestId('translate-send')).toBeTruthy();
  });

  it('uses Nepali source controls in the chosen script and reads only output', async () => {
    await renderApp();
    await fireEvent.press(screen.getByLabelText('Nepali'));
    expect(screen.queryByTestId('formality-switch')).toBeNull();
    expect(screen.queryByTestId('play-source')).toBeNull();
    expect(screen.queryByTestId('source-script-line')).toBeNull();
    expect(screen.getByText(t('translate.tapToSpeak', 'ne'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'नमस्ते');
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    expect(screen.getByText(t('translate.send', 'ne'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('translate-send'));
    await waitFor(() => expect(screen.getByTestId('translate-output').props.children).toBe('Hello'));
    expect(StyleSheet.flatten(screen.getByTestId('translate-output').props.style).fontWeight).toBe('400');
    expect(screen.getByText(t('translate.feedback', 'ne'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('script-toggle'));
    expect(screen.getByText(formatNepaliScript(t('translate.feedback', 'ne'), 'roman'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('mark-incorrect'));
    expect(screen.getByTestId('correction-input').props.value).toBe('Hello');
    await fireEvent.press(screen.getByTestId('correction-backdrop', { includeHiddenElements: true }));
    expect(screen.queryByTestId('correction-input')).toBeNull();
  });

  it('keeps the same timer mounted through pages and overlays', async () => {
    await renderApp();
    const timer = screen.getByTestId('credits-gauge');
    for (const tab of ['tab-camera', 'tab-learn', 'tab-translate']) {
      await fireEvent.press(screen.getByTestId(tab));
      expect(screen.getByTestId('credits-gauge')).toBe(timer);
    }
    await fireEvent.press(screen.getByTestId('open-history'));
    expect(screen.getByTestId('credits-gauge')).toBe(timer);
    await fireEvent.press(screen.getByTestId('history-close'));
    await fireEvent.press(screen.getByTestId('open-settings'));
    expect(screen.getByTestId('credits-gauge')).toBe(timer);
  });

  it.each(['before', 'after'])('keeps an edit on its original result when saved %s pending MT completes', async (when) => {
    const runtime = createTestRuntime();
    let finish!: () => void;
    runtime.translation.translate = jest.fn()
      .mockResolvedValueOnce({ text: 'नमस्ते', method: 'phrase', direction: 'en-ne' })
      .mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ text: 'धन्यवाद', method: 'phrase', direction: 'en-ne' }); }));
    await renderApp(createTestServices({ offline: true }), runtime);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(async () => expect((await loadHistory()).length).toBe(1));
    const original = (await loadHistory())[0];
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Thank you');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await fireEvent.press(screen.getByTestId('mark-incorrect'));
    await fireEvent.changeText(screen.getByTestId('correction-input'), 'नमस्कार');
    if (when === 'before') {
      await fireEvent.press(screen.getByTestId('correction-save-draft'));
      await waitFor(() => expect(screen.queryByTestId('correction-input')).toBeNull());
      expect(screen.getByTestId('speak-hero').props.accessibilityState.disabled).toBe(true);
    }
    await act(async () => { finish(); });
    await waitFor(async () => expect((await loadHistory()).length).toBe(2));
    if (when === 'after') {
      expect(screen.getByTestId('correction-input').props.value).toBe('नमस्कार');
      await fireEvent.press(screen.getByTestId('correction-save-draft'));
      await waitFor(() => expect(screen.queryByTestId('correction-input')).toBeNull());
    }
    const rows = await loadHistory();
    expect(rows.find(row => row.id === original.id)?.translation).toBe('नमस्कार');
    expect(rows.find(row => row.id !== original.id)?.translation).toBe('धन्यवाद');
    expect(screen.getByTestId('translate-output').props.children).toBe('धन्यवाद');
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

  it('guards language switches during translation and preserves edits made while waiting', async () => {
    const runtime = createTestRuntime();
    const result = { text: 'नमस्ते', method: 'phrase' as const, direction: 'en-ne' as const };
    let finish!: () => void;
    const pending = new Promise<typeof result>((resolve) => { finish = () => resolve(result); });
    runtime.translation.translate = jest.fn(() => pending);
    await renderApp(createTestServices({ offline: true }), runtime);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    await fireEvent.press(screen.getByTestId('translate-send'));
    await fireEvent.press(screen.getByLabelText('Nepali'));
    expect(screen.getByLabelText('English').props.accessibilityState.selected).toBe(true);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello again');
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.getByTestId('translate-output').props.children).toBe('नमस्ते'));
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello again');
  });

  it('clears pending translation when leaving and ignores its late result', async () => {
    const runtime = createTestRuntime();
    const result = { text: 'नमस्ते', method: 'phrase' as const, direction: 'en-ne' as const };
    let finish!: () => void;
    runtime.translation.translate = jest.fn(() => new Promise<typeof result>((resolve) => { finish = () => resolve(result); }));
    await renderApp(createTestServices({ offline: true }), runtime);
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    await fireEvent.press(screen.getByTestId('translate-send'));
    await fireEvent.press(screen.getByTestId('tab-camera'));
    await act(async () => { finish(); });
    await fireEvent.press(screen.getByTestId('tab-translate'));
    await fireEvent(screen.getByTestId('translate-input'), 'focus');
    expect(screen.getByTestId('translate-send').props.accessibilityState.disabled).toBe(false);
    expect(screen.getByTestId('translate-input').props.value).toBe('Hello');
    expect(screen.getByTestId('translate-output').props.children).not.toBe('नमस्ते');
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
      expect(screen.queryByText(/speech is unavailable/i)).toBeNull();
      expect(screen.queryByText(/you can still type/i)).toBeNull();
    });
    expect(screen.getByTestId('speak-hero').props.accessibilityState?.disabled).not.toBe(
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
      expect(screen.getByText(/Microphone blocked/i)).toBeTruthy();
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
    expect(screen.queryByTestId('speak-dock')).toBeNull();
    expect(screen.getByLabelText('Translation tab')).toBeTruthy();
    expect(screen.getByTestId('tab-translate').props.accessibilityState?.selected).toBe(
      true,
    );

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe('नमस्ते');
    });
    expect(screen.getByTestId('speak-hero')).toBeTruthy();

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
    expect(screen.getByText(/Camera translation runs on this device/i)).toBeTruthy();
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
    expect(screen.queryByTestId('learn-earn-rewards')).toBeNull();
    expect(screen.getByLabelText('Translation tab')).toBeTruthy();
    expect(screen.getByTestId('tab-learn').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('tab-translate').props.accessibilityState?.selected).toBe(
      false,
    );
    await fireEvent.press(screen.getByTestId('tab-translate'));
    expect(screen.getByTestId('tab-translate').props.accessibilityState?.selected).toBe(
      true,
    );
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
      expect(screen.getByTestId('promo-earn')).toBeTruthy();
    });
    expect(services.ads.networkCalls()).toEqual([]);

    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Hello');
    await fireEvent(screen.getByTestId('translate-input'), 'submitEditing');
    await waitFor(() => {
      expect(screen.getByTestId('translate-output').props.children).toBe(
        'नमस्ते',
      );
    });
    expect(screen.queryByTestId('promo-earn')).toBeNull();
    expect(screen.queryByTestId('promo-rotator')).toBeNull();
    expect(screen.queryByTestId('ad-slot-house-translate_result')).toBeNull();
    expect(services.ads.networkCalls()).toEqual([]);
  });

  it.each(['camera-done', 'back-home'])('clears photo results and stays in Camera using %s', async (button) => {
    setCameraTestFixture(INSCRIPTION_FIXTURE);
    await renderApp(createTestServices({ offline: true, authConfigured: false }));
    await fireEvent.press(screen.getByTestId('tab-camera'));
    await waitFor(() => expect(screen.getByTestId('camera-drawer')).toBeTruthy());
    expect(within(screen.getByTestId('camera-drawer')).queryByText('Translation')).toBeNull();
    await fireEvent.press(screen.getByTestId(button));
    expect(screen.getByTestId('pane-camera')).toBeTruthy();
    expect(screen.queryByTestId('camera-drawer')).toBeNull();
    expect(screen.queryByTestId('camera-overlay-s1')).toBeNull();
    expect(screen.getByTestId('camera-permission')).toBeTruthy();
  });

  it('shows line highlights and the translation sheet without signing in', async () => {
    setCameraTestFixture(INSCRIPTION_FIXTURE);
    await renderApp(createTestServices({ offline: true, authConfigured: false }));
    await fireEvent.press(screen.getByTestId('tab-camera'));
    await waitFor(() => {
      expect(screen.getByTestId('camera-overlay-s1')).toBeTruthy();
    });
    const overlayStyle = StyleSheet.flatten(screen.getByTestId('camera-overlay-s1').props.style);
    expect(Number.parseFloat(String(overlayStyle.width))).toBeGreaterThan(
      Number.parseFloat(String(overlayStyle.height)),
    );
    expect(screen.getByTestId('camera-overlay-s2')).toBeTruthy();
    expect(screen.getByTestId('camera-overlay-s3')).toBeTruthy();
    expect(screen.getByTestId('camera-drawer').props.accessibilityState?.expanded).toBe(
      true,
    );
    expect(screen.getByTestId('camera-detected')).toBeTruthy();
    expect(screen.getAllByText('Detected: Nepali (Devanagari)').length).toBeGreaterThan(0);
    expect(screen.getByText('Hail to Lord Shiva.')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    expect(screen.queryByTestId('camera-preview')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-learn'));
    expect(screen.queryByTestId('camera-overlay-s1')).toBeNull();
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
  });
});
