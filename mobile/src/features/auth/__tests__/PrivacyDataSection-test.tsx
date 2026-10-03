import { Alert } from 'react-native';
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react-native';
import { UiLangProvider } from '../../../i18n';
import { savePrefs } from '../../../storage/prefs';
import { PrivacyDataSection } from '../PrivacyDataSection';
import { CONTRIBUTION_CONSENT_VERSION } from '../consent';

const base = { authConfigured: true, consentVersion: null, ageConfirmed: false,
  onRetryIdentity: jest.fn(), onSaveConsent: jest.fn(), onDeleteData: jest.fn(),
  onToggleSpeechSharing: jest.fn(), onWithdrawConsent: jest.fn() };
const owner = '11111111-1111-4111-8111-111111111111';
async function mount(extra: Partial<React.ComponentProps<typeof PrivacyDataSection>> = {}) {
  await act(async () => { render(<PrivacyDataSection {...base} status="signed-in" userId={owner} {...extra} />); });
}
describe('optional privacy and data controls', () => {
  beforeEach(() => { jest.clearAllMocks(); });
  test('has no account controls or private identifier in the UI', async () => {
    await mount();
    expect(screen.getByTestId('privacy-data-section')).toBeTruthy();
    expect(screen.queryByText(owner)).toBeNull();
    expect(screen.queryByText(/account|sign.?in|sign.?out|login|OAuth/i)).toBeNull();
    expect(screen.getByTestId('privacy-installation-warning').props.children).toMatch(/credits.*shared data.*installation/i);
  });
  test('explicit model improvement opt-in and age are both required before saving', async () => {
    await mount();
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('age-confirm'));
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('model-improvement-opt-in'));
    expect(screen.getByTestId('save-consent')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('save-consent'));
    expect(base.onSaveConsent).toHaveBeenCalledWith(true);
    expect(base.onToggleSpeechSharing).not.toHaveBeenCalled();
    expect(screen.getByTestId('share-speech')).toBeDisabled();
  });
  test('optional sharing requires a private ready connection without offering login', async () => {
    await mount({ status: 'guest', userId: null });
    await fireEvent.press(screen.getByTestId('model-improvement-opt-in'));
    await fireEvent.press(screen.getByTestId('age-confirm'));
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('privacy-retry-connection'));
    expect(base.onRetryIdentity).toHaveBeenCalledTimes(1);
  });
  test('raw audio remains off until separately chosen after current consent', async () => {
    await mount({ consentVersion: CONTRIBUTION_CONSENT_VERSION, ageConfirmed: true });
    expect(screen.getByTestId('share-speech').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('privacy-audio-disclosure').props.children).toMatch(/raw audio.*off by default.*60 seconds/i);
    await fireEvent.press(screen.getByTestId('share-speech'));
    expect(base.onToggleSpeechSharing).toHaveBeenCalledWith(true);
  });
  test('shared-data deletion is confirmed and preserves local history and credits', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await mount();
    await fireEvent.press(screen.getByTestId('delete-shared-data'));
    expect(alert).toHaveBeenCalledWith('Delete shared data?', expect.stringMatching(/Local history.*credits are preserved/), expect.any(Array));
    expect(base.onDeleteData).not.toHaveBeenCalled();
    const actions = alert.mock.calls[0][2];
    actions?.find(action => action.style === 'destructive')?.onPress?.();
    expect(base.onDeleteData).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
  test('withdrawal is independently confirmed and stops future sharing', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await mount({ consentVersion: CONTRIBUTION_CONSENT_VERSION, ageConfirmed: true });
    await fireEvent.press(screen.getByTestId('withdraw-consent'));
    expect(base.onWithdrawConsent).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][1]).toMatch(/stops new uploads.*30 days/i);
    alert.mock.calls[0][2]?.find(action => action.style === 'destructive')?.onPress?.();
    expect(base.onWithdrawConsent).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
  test('pending deletion prevents re-consent and exposes a retry on failure', async () => {
    await mount({ deletionDueAt: '2026-11-01T00:00:00Z', deletionRetryPending: true });
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('retry-delete-shared-data'));
    expect(base.onDeleteData).toHaveBeenCalledTimes(1);
  });
  test('cold offline owner can withdraw and delete while uploads remain denied', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await mount({ status: 'error', consentVersion: CONTRIBUTION_CONSENT_VERSION, ageConfirmed: true });
    expect(screen.getByTestId('withdraw-consent')).toBeEnabled();
    expect(screen.getByTestId('delete-shared-data')).toBeEnabled();
    expect(screen.getByTestId('share-speech')).toBeDisabled();
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('withdraw-consent'));
    alert.mock.calls[0][2]?.find(action => action.style === 'destructive')?.onPress?.();
    expect(base.onWithdrawConsent).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
  test('cold offline persisted withdrawal exposes retry without a fabricated due date', async () => {
    await mount({ status: 'guest', deletionRetryPending: true });
    expect(screen.queryByTestId('deletion-due-at')).toBeNull();
    expect(screen.getByTestId('save-consent')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('retry-delete-shared-data'));
    expect(base.onDeleteData).toHaveBeenCalledTimes(1);
  });
  test('the optional data disclosure follows Nepali UI language', async () => {
    await savePrefs({ formalOn: true, devaOn: true, conversationConsentSeen: false, uiLang: 'ne' });
    await act(async () => { render(<UiLangProvider><PrivacyDataSection {...base} status="guest" userId={null} /></UiLangProvider>); });
    await waitFor(() => expect(screen.getByTestId('contribution-consent-body').props.children).toMatch(/ऐच्छिक सहमति/));
    expect(screen.getByTestId('contribution-consent-body').props.children).not.toMatch(/If you opt in/);
  });
});
