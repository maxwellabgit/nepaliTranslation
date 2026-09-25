import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';
import { ThemeProvider } from '../../../theme';
import { UiLangProvider } from '../../../i18n';
import {
  isStartupConsentCurrent,
  loadStartupConsent,
  saveStartupConsent,
} from '../../../storage/startupConsent';
import { recordStartupConsent } from '../recordStartupConsent';
import { StartupConsentGate } from '../StartupConsentGate';
import { readLegalPublicUrls } from '../../../config/legalUrls';

jest.mock('../../../storage/startupConsent', () => ({
  ...jest.requireActual('../../../storage/startupConsent'),
  isStartupConsentCurrent: jest.fn(),
  loadStartupConsent: jest.fn(),
  saveStartupConsent: jest.fn(),
}));
jest.mock('../recordStartupConsent', () => ({ recordStartupConsent: jest.fn() }));
jest.mock('../../../config/legalUrls', () => ({
  readLegalPublicUrls: jest.fn(() => ({ termsOfServiceUrl: '', privacyPolicyUrl: '' })),
}));

function mount() {
  return render(
    <ThemeProvider scheme="light">
      <UiLangProvider>
        <StartupConsentGate>
          <Text testID="guest-translator">Translator</Text>
        </StartupConsentGate>
      </UiLangProvider>
    </ThemeProvider>,
  );
}

describe('guest startup consent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readLegalPublicUrls as jest.Mock).mockReturnValue({
      termsOfServiceUrl: '', privacyPolicyUrl: '',
    });
    (loadStartupConsent as jest.Mock).mockResolvedValue(null);
    (isStartupConsentCurrent as jest.Mock).mockReturnValue(false);
    (saveStartupConsent as jest.Mock).mockResolvedValue(undefined);
    (recordStartupConsent as jest.Mock).mockResolvedValue({ ok: false });
  });

  it('requires Terms and Privacy in either language, with no age or login gate', async () => {
    await act(async () => { mount(); });
    await waitFor(() => expect(screen.getByTestId('startup-consent-gate')).toBeTruthy());
    expect(screen.queryByTestId('guest-translator')).toBeNull();
    expect(screen.getByTestId('startup-consent-continue').props.accessibilityState.disabled)
      .toBe(true);

    await act(async () => { fireEvent.press(screen.getByTestId('startup-consent-lang-ne')); });
    await act(async () => { fireEvent.press(screen.getByTestId('startup-consent-terms')); });
    expect(screen.getByTestId('startup-consent-continue').props.accessibilityState.disabled)
      .toBe(true);
    await act(async () => { fireEvent.press(screen.getByTestId('startup-consent-privacy')); });
    await act(async () => { fireEvent.press(screen.getByTestId('startup-consent-continue')); });
    await waitFor(() => expect(saveStartupConsent).toHaveBeenCalledWith({
      terms: true, privacy: true, age18Plus: false,
    }));
    expect(recordStartupConsent).toHaveBeenCalledWith({
      terms: true, privacy: true, age18Plus: false,
    });
    await waitFor(() => expect(screen.getByTestId('guest-translator')).toBeTruthy());
  });

  it('restores a current local consent without asking the guest again', async () => {
    (isStartupConsentCurrent as jest.Mock).mockReturnValue(true);
    await act(async () => { mount(); });
    await waitFor(() => expect(screen.getByTestId('guest-translator')).toBeTruthy());
    expect(screen.queryByTestId('startup-consent-gate')).toBeNull();
    expect(saveStartupConsent).not.toHaveBeenCalled();
  });

  it('opens both public legal documents before the guest accepts', async () => {
    (readLegalPublicUrls as jest.Mock).mockReturnValue({
      termsOfServiceUrl: 'https://example.org/terms',
      privacyPolicyUrl: 'https://example.org/privacy',
    });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue({} as never);
    await act(async () => { mount(); });
    await act(async () => { fireEvent.press(screen.getByText('Read Terms & Conditions')); });
    await act(async () => { fireEvent.press(screen.getByText('Read Privacy Policy')); });
    expect(open).toHaveBeenCalledWith('https://example.org/terms');
    expect(open).toHaveBeenCalledWith('https://example.org/privacy');
    open.mockRestore();
  });
});
