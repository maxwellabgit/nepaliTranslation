import { act, render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { AppProviders } from '../../app/AppProviders';
import { ReviewScreen } from '../ReviewScreen';
import { createTestServices } from '../../services/createTestServices';

jest.mock('../../features/contribution/publicReviewApi', () => {
  const actual = jest.requireActual('../../features/contribution/publicReviewApi');
  return {
    ...actual,
    fetchCurrentReviewWindow: jest.fn(),
    submitReview: jest.fn(),
  };
});

jest.mock('../../features/auth/AuthProvider', () => {
  const actual = jest.requireActual('../../features/auth/AuthProvider');
  return {
    ...actual,
    useAuth: jest.fn(),
  };
});

const {
  fetchCurrentReviewWindow,
  submitReview,
} = require('../../features/contribution/publicReviewApi') as {
  fetchCurrentReviewWindow: jest.Mock;
  submitReview: jest.Mock;
};

const { useAuth } = require('../../features/auth/AuthProvider') as {
  useAuth: jest.Mock;
};

function renderScreen(opts: { textFlag?: boolean } = {}) {
  const services = createTestServices({
    authConfigured: true,
    offline: false,
    flags: { contributionTextEnabled: opts.textFlag ?? true },
  });
  return render(
    <AppProviders services={services} bypassStartupConsent>
      <ReviewScreen onClose={() => undefined} />
    </AppProviders>,
  );
}

const guestAuth = {
  status: 'guest',
  userId: null,
  authConfigured: true,
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  refreshAccountSummary: jest.fn(),
  clearAlert: jest.fn(),
};

const signedInAuth = {
  ...guestAuth,
  status: 'signed-in',
  userId: '11111111-1111-4111-8111-111111111111',
};

describe('ReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the sign-in state for guests without fetching', async () => {
    useAuth.mockReturnValue(guestAuth);
    await act(async () => {
      renderScreen();
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-state-sign-in')).toBeTruthy();
    });
    expect(fetchCurrentReviewWindow).not.toHaveBeenCalled();
  });

  it('shows the flag-off state when contribution_text_enabled is false', async () => {
    useAuth.mockReturnValue(signedInAuth);
    await act(async () => {
      renderScreen({ textFlag: false });
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-state-flag-off')).toBeTruthy();
    });
    expect(fetchCurrentReviewWindow).not.toHaveBeenCalled();
  });

  it('renders items and advances to the next item after confirm', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: {
        window_id: 'w-1',
        ny_close_at: '2027-01-01T22:00:00.000Z',
        size: 2,
      },
      items: [
        {
          slot: 1,
          source_item_id: 'src-1',
          direction: 'en-ne',
          register: 'formal',
          script: 'deva',
          source_text: 'Hello world',
          proposed_target: 'नमस्ते संसार',
          length_tier: 1,
          scheduled_credits: 1,
        },
        {
          slot: 2,
          source_item_id: 'src-2',
          direction: 'en-ne',
          register: 'informal',
          script: 'deva',
          source_text: 'How are you?',
          proposed_target: 'तिमीलाई कस्तो छ?',
          length_tier: 2,
          scheduled_credits: 2,
        },
      ],
    });
    submitReview.mockResolvedValue({
      ok: true,
      submission: { id: 'sub-1' },
    });

    await act(async () => {
      renderScreen();
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-item-source').props.children).toBe(
        'Hello world',
      );
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-confirm'));
    });

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          windowId: 'w-1',
          sourceItemId: 'src-1',
          action: 'confirm',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-item-source').props.children).toBe(
        'How are you?',
      );
    });
  });

  it('restores a prior edit and skips to the next unsubmitted item', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: {
        window_id: 'w-1',
        ny_close_at: '2027-01-01T22:00:00.000Z',
        size: 2,
      },
      items: [
        {
          slot: 1,
          source_item_id: 'src-1',
          direction: 'en-ne',
          register: 'formal',
          script: 'deva',
          source_text: 'Hello world',
          proposed_target: 'नमस्ते संसार',
          length_tier: 1,
          scheduled_credits: 1,
        },
        {
          slot: 2,
          source_item_id: 'src-2',
          direction: 'en-ne',
          register: 'informal',
          script: 'deva',
          source_text: 'How are you?',
          proposed_target: 'तिमीलाई कस्तो छ?',
          length_tier: 2,
          scheduled_credits: 2,
        },
      ],
      mine: [
        {
          source_item_id: 'src-1',
          action: 'edit',
          corrected_text: 'नमस्ते',
          reward_granted: false,
        },
      ],
    });

    await act(async () => {
      renderScreen();
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-item-source').props.children).toBe(
        'How are you?',
      );
    });
    const restored = screen.getByTestId('review-restored-src-1').props.children;
    const restoredText = Array.isArray(restored) ? restored.join('') : String(restored);
    expect(restoredText).toContain('नमस्ते');
    expect(restoredText).toContain('Reward pending until 5:00 PM New York');
  });

  it('blocks Submit correction until a corrected target is entered', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: {
        window_id: 'w-1',
        ny_close_at: '2027-01-01T22:00:00.000Z',
        size: 1,
      },
      items: [
        {
          slot: 1,
          source_item_id: 'src-1',
          direction: 'en-ne',
          register: 'formal',
          script: 'deva',
          source_text: 'Hello',
          proposed_target: 'नमस्ते',
          length_tier: 1,
          scheduled_credits: 1,
        },
      ],
    });

    await act(async () => {
      renderScreen();
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-action-edit')).toBeTruthy();
    });

    expect(screen.getByTestId('review-action-edit').props.accessibilityState.disabled)
      .toBe(true);

    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId('review-item-correction'),
        'नमस्कार',
      );
    });

    expect(screen.getByTestId('review-action-edit').props.accessibilityState.disabled)
      .toBe(false);
  });

  it('surfaces already_submitted error from the server', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: {
        window_id: 'w-1',
        ny_close_at: '2027-01-01T22:00:00.000Z',
        size: 1,
      },
      items: [
        {
          slot: 1,
          source_item_id: 'src-1',
          direction: 'en-ne',
          register: 'formal',
          script: 'deva',
          source_text: 'Hi',
          proposed_target: 'नमस्ते',
          length_tier: 1,
          scheduled_credits: 1,
        },
      ],
    });
    submitReview.mockResolvedValue({
      ok: false,
      reason: 'already_submitted',
    });

    await act(async () => {
      renderScreen();
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-action-confirm')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-confirm'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-error-already')).toBeTruthy();
    });
  });
});
