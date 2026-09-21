import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { ContributionCard } from '../ContributionCard';

const mockFetchNext = jest.fn();
const mockSubmit = jest.fn();
const mockRefresh = jest.fn(async () => undefined);
const flagState = { contributionsEnabled: true };
const authState = {
  status: 'signed-in' as 'signed-in' | 'guest',
  authConfigured: true,
  userId: 'user-1' as string | null,
};

jest.mock('../contributionApi', () => ({
  fetchNextContribution: (...args: unknown[]) => mockFetchNext(...args),
  submitContribution: (...args: unknown[]) => mockSubmit(...args),
  newIdempotencyKey: () => 'idem-test-key-01',
}));

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    status: authState.status,
    authConfigured: authState.authConfigured,
    userId: authState.userId,
  }),
}));

jest.mock('../../entitlements/EntitlementProvider', () => ({
  useEntitlement: () => ({
    ready: true,
    refresh: mockRefresh,
    earnedAdFreeUntilMs: null,
    lifetimeCredits: 0,
    version: 0,
    hasActiveEarnedAdFree: () => false,
    trustedNow: () => null,
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

const SAMPLE_TASK = {
  public_task_id: 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  assignment_id: 'a1111111-1111-4111-8111-111111111111',
  source_text: 'hello',
  model_output: 'नमस्ते',
  direction: 'en-ne',
  formality: 'formal',
  script: 'deva',
  reward_label: 'Earn 1–6 credits after validation',
};

async function loadReadyCard() {
  mockFetchNext.mockResolvedValue({ ok: true, assignment: SAMPLE_TASK });
  const view = await render(<ContributionCard />);
  await act(async () => {
    fireEvent.press(view.getByTestId('contribution-load'));
  });
  await waitFor(() => {
    expect(view.getByTestId('contribution-looks-correct')).toBeTruthy();
  });
  return view;
}

describe('ContributionCard H3', () => {
  beforeEach(() => {
    cleanup();
    flagState.contributionsEnabled = true;
    authState.status = 'signed-in';
    authState.authConfigured = true;
    authState.userId = 'user-1';
    mockFetchNext.mockReset();
    mockSubmit.mockReset();
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  test('flag-off surface explains contributions are disabled', async () => {
    flagState.contributionsEnabled = false;
    const view = await render(<ContributionCard />);
    expect(view.getByTestId('contribution-card-off')).toBeTruthy();
    expect(view.queryByTestId('contribution-load')).toBeNull();
  });

  test('loads source, model output, and reward label then exposes actions', async () => {
    const view = await loadReadyCard();
    expect(view.getByTestId('contribution-source').props.children).toBe('hello');
    expect(view.getByTestId('contribution-model').props.children).toBe('नमस्ते');
    expect(view.getByTestId('contribution-reward-label').props.children).toBe(
      'Earn 1–6 credits after validation',
    );
    expect(view.getByTestId('contribution-edit')).toBeTruthy();
    expect(view.getByTestId('contribution-skip')).toBeTruthy();
    expect(view.getByTestId('contribution-report')).toBeTruthy();
  });

  test('Looks correct submits and refreshes entitlement', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      receipt_id: 'rec-1',
      status: 'received',
      reward_label: 'Earn 1–6 credits after validation',
    });
    const view = await loadReadyCard();

    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-looks-correct'));
    });

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'looks_correct',
          assignmentId: SAMPLE_TASK.assignment_id,
          idempotencyKey: 'idem-test-key-01',
        }),
      );
    });
    expect(mockRefresh).toHaveBeenCalled();
    await waitFor(() => {
      expect(view.getByTestId('contribution-status-received')).toBeTruthy();
    });
    expect(view.getByTestId('contribution-message').props.children).toBe(
      'Earn 1–6 credits after validation',
    );
  });

  test('edit requires non-empty text before submit', async () => {
    const view = await loadReadyCard();
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-edit'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-edit-input')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(view.getByTestId('contribution-edit-input'), '');
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-submit-edit'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-edit-error')).toBeTruthy();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  test('lease_expired recovers by prompting a new load', async () => {
    mockSubmit.mockResolvedValue({ ok: false, reason: 'lease_expired' });
    const view = await loadReadyCard();
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-skip'));
    });
    await waitFor(() => {
      expect(view.getByText(/expired/i)).toBeTruthy();
    });
    expect(view.getByTestId('contribution-load')).toBeTruthy();
  });

  test('load shows sign-in message when not signed in', async () => {
    authState.status = 'guest';
    authState.userId = null;
    mockFetchNext.mockResolvedValue({ ok: false, reason: 'sign_in' });
    const view = await render(<ContributionCard />);
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-load'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-message').props.children).toMatch(
        /Sign in with Apple/i,
      );
    });
  });

  test('load handles consent and age gate messages', async () => {
    mockFetchNext.mockResolvedValueOnce({ ok: false, reason: 'consent' });
    let view = await render(<ContributionCard />);
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-load'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-message').props.children).toMatch(
        /consent/i,
      );
    });

    mockFetchNext.mockResolvedValueOnce({ ok: false, reason: 'age' });
    view = await render(<ContributionCard />);
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-load'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-message').props.children).toMatch(
        /13 or older/i,
      );
    });
  });

  test('empty queue shows no tasks message', async () => {
    mockFetchNext.mockResolvedValue({ ok: true, assignment: null });
    const view = await render(<ContributionCard />);
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-load'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-message').props.children).toBe(
        'No tasks available right now.',
      );
    });
  });

  test('submit retry reuses idempotency key', async () => {
    mockSubmit.mockResolvedValueOnce({ ok: false, reason: 'rate_limited' });
    const view = await loadReadyCard();
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-skip'));
    });
    await waitFor(() => {
      expect(view.getByTestId('contribution-retry')).toBeTruthy();
    });
    mockSubmit.mockResolvedValueOnce({
      ok: true,
      receipt_id: 'rec-2',
      status: 'received',
      reward_label: 'Pending',
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-retry'));
    });
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenLastCalledWith(
        expect.objectContaining({ idempotencyKey: 'idem-test-key-01' }),
      );
    });
  });

  test('successful edit submits corrected text', async () => {
    mockSubmit.mockResolvedValue({
      ok: true,
      receipt_id: 'rec-edit',
      status: 'received',
      reward_label: 'Earn credits',
    });
    const view = await loadReadyCard();
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-edit'));
    });
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('contribution-edit-input'),
        'नमस्कार',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('contribution-submit-edit'));
    });
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'edit',
          responseText: 'नमस्कार',
        }),
      );
    });
  });
});
