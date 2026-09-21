import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { CorrectionSheet } from '../CorrectionSheet';
import { loadOutbox } from '../../../storage/contributionOutbox';
import { saveLocalConsent } from '../../../storage/contributionConsent';

const authState = {
  status: 'guest' as 'guest' | 'signed-in',
  authConfigured: true,
  userId: null as string | null,
};
const flagState = { contributionsEnabled: false };

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: authState.status,
    authConfigured: authState.authConfigured,
    userId: authState.userId,
  }),
}));

jest.mock('../../../app/FeatureConfigProvider', () => ({
  useFeatureFlags: () => ({
    contributionsEnabled: flagState.contributionsEnabled,
    rewardsEnabled: false,
    networkAdsEnabled: false,
    rewardedAdsEnabled: false,
    paywallEnabled: false,
    learnEnabled: true,
  }),
}));

describe('CorrectionSheet H2', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    authState.status = 'guest';
    authState.authConfigured = true;
    authState.userId = null;
    flagState.contributionsEnabled = false;
  });

  test('legacy missing labels block submit until selected', async () => {
    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="hello"
          translation="नमस्ते"
          sourceLang="en"
          formality={null}
          script={null}
          surface="history"
          onClose={jest.fn()}
        />,
      );
    });

    expect(screen.getByTestId('correction-label-pickers')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-submit'));
    });
    await waitFor(() => {
      expect(
        screen.getByText('Select formality and script before submitting.'),
      ).toBeTruthy();
    });
    expect(await loadOutbox()).toHaveLength(0);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-formality-informal'));
      await fireEvent.press(screen.getByTestId('correction-script-roman'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('correction-labels-set')).toBeTruthy();
    });
    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-save-draft'));
    });
    await waitFor(async () => {
      expect(await loadOutbox()).toHaveLength(1);
    });
    const draft = (await loadOutbox())[0];
    expect(draft?.status).toBe('draft');
    expect(draft?.formality).toBe('informal');
    expect(draft?.script).toBe('roman');
  });

  test('queues draft when signed in with consent and contributions enabled', async () => {
    authState.status = 'signed-in';
    authState.userId = 'user-1';
    flagState.contributionsEnabled = true;
    await saveLocalConsent(true);

    const onClose = jest.fn();
    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="hello"
          translation="नमस्ते"
          sourceLang="en"
          formality="informal"
          script="deva"
          surface="history"
          onClose={onClose}
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('correction-labels-set')).toBeTruthy();
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-submit'));
    });
    await waitFor(async () => {
      const outbox = await loadOutbox();
      expect(outbox.length).toBe(1);
      expect(outbox[0]?.status).toBe('queued');
    });
    expect(onClose).toHaveBeenCalled();
  });

  test('submit while guest saves draft and calls onNeedAuth', async () => {
    flagState.contributionsEnabled = true;
    await saveLocalConsent(true);
    const onNeedAuth = jest.fn();

    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="hello"
          translation="नमस्ते"
          sourceLang="en"
          formality="formal"
          script="deva"
          surface="history"
          onClose={jest.fn()}
          onNeedAuth={onNeedAuth}
        />,
      );
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-submit'));
    });
    await waitFor(async () => {
      expect(await loadOutbox()).toHaveLength(1);
    });
    expect(onNeedAuth).toHaveBeenCalled();
    expect(screen.getByText(/Sign in with Apple/i)).toBeTruthy();
  });

  test('submit with contributions off saves draft note', async () => {
    authState.status = 'signed-in';
    authState.userId = 'user-1';
    flagState.contributionsEnabled = false;
    await saveLocalConsent(true);

    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="hello"
          translation="नमस्ते"
          sourceLang="en"
          formality="formal"
          script="deva"
          surface="history"
          onClose={jest.fn()}
        />,
      );
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-submit'));
    });
    await waitFor(() => {
      expect(screen.getByText(/Contribution upload is off/i)).toBeTruthy();
    });
  });

  test('shows Save on this device and Submit contribution actions', async () => {
    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="thanks"
          translation="धन्यवाद"
          sourceLang="en"
          formality="formal"
          script="deva"
          surface="live_translate"
          onClose={jest.fn()}
        />,
      );
    });
    expect(screen.getByTestId('correction-save-draft')).toBeTruthy();
    expect(screen.getByText('Save on this device')).toBeTruthy();
    expect(screen.getByText('Submit contribution')).toBeTruthy();
    expect(screen.getByTestId('correction-cancel')).toBeTruthy();
  });
});
