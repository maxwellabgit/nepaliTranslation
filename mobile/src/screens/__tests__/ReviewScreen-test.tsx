import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { AppProviders } from '../../app/AppProviders';
import { ReviewScreen } from '../ReviewScreen';
import { createTestServices } from '../../services/createTestServices';
import { captureReviewResponse, readReviewResponses } from '../../features/contribution/reviewResponses';
import { REVIEW_DAYS } from '../../features/contribution/reviewRoster';

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

function sourceOnlyWindow() {
  return {
    ok: true as const,
    window: { window_id: 'w-1', ny_close_at: '2027-01-01T22:00:00Z', size: 1 },
    items: [{
      slot: 1,
      source_item_id: 'source-only',
      direction: 'ne-en' as const,
      register: 'noisy_roman',
      script: 'roman',
      source_text: 'tapai kahile aaune ho',
      proposed_target: null,
      length_tier: 1 as const,
      scheduled_credits: 2 as const,
    }],
    mine: [],
  };
}

describe('ReviewScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('loads shipped samples for guests while public review is paused', async () => {
    useAuth.mockReturnValue(guestAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: { window_id: 'bundled', ny_close_at: '2027-01-01T22:00:00Z', size: 1 },
      items: [{
        slot: 1,
        source_item_id: 'en-1',
        direction: 'en-ne',
        register: 'formal',
        script: 'deva',
        source_text: 'Hello',
        proposed_target: 'नमस्ते',
        length_tier: 1,
        scheduled_credits: 1,
      }],
      mine: [],
    });
    await act(async () => {
      renderScreen();
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    expect(screen.queryByTestId('review-state-sign-in')).toBeNull();
  });

  it('loads shipped samples when the public review flag is off', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: { window_id: 'bundled', ny_close_at: '2027-01-01T22:00:00Z', size: 1 },
      items: [{
        slot: 1,
        source_item_id: 'en-1',
        direction: 'en-ne',
        register: 'formal',
        script: 'deva',
        source_text: 'Hello',
        proposed_target: 'नमस्ते',
        length_tier: 1,
        scheduled_credits: 1,
      }],
      mine: [],
    });
    await act(async () => {
      renderScreen({ textFlag: false });
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    expect(screen.queryByTestId('review-state-flag-off')).toBeNull();
  });

  async function openEnglishAndType(text: string) {
    await waitFor(() => {
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-english'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-item-correction')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('review-item-correction'), text);
    });
  }

  async function openSourceOnly(text: string, advance = true) {
    await waitFor(() => {
      expect(screen.getByTestId('review-category-roman')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-roman'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-item-correction')).toBeTruthy();
    });
    if (text) {
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('review-item-correction'), text);
      });
    }
    if (advance) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('review-action-submit'));
      });
    }
  }

  it('shows three category cards and moves forward through type then compare', async () => {
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
      expect(screen.getByTestId('review-category-deva')).toBeTruthy();
      expect(screen.getByTestId('review-category-roman')).toBeTruthy();
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    expect(screen.queryByTestId('review-prev')).toBeNull();
    expect(screen.queryByTestId('review-item-source')).toBeNull();

    await openEnglishAndType('नमस्ते संसार');
    expect(screen.getByTestId('review-item-source').props.children).toBe('Hello world');
    expect(screen.queryByTestId('review-credits-note')).toBeNull();
    expect(screen.queryByTestId('review-countdown')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-submit'));
    });
    expect(submitReview).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('review-compare')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-judgment-same'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-next'));
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
    expect(screen.queryByTestId('review-prev')).toBeNull();
    expect(screen.queryByTestId('review-close')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-back'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-intro')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-english'));
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
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-english'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-item-source').props.children).toBe(
        'How are you?',
      );
    });
    expect(screen.queryByTestId('review-restored-src-1')).toBeNull();
    expect(screen.getByTestId('review-progress').props.children).toBe('2 of 2');
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
      expect(screen.getByTestId('review-category-english')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-english'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-action-submit')).toBeTruthy();
    });

    expect(screen.getByTestId('review-action-submit').props.accessibilityState.disabled)
      .toBe(true);

    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId('review-item-correction'),
        'नमस्कार',
      );
    });

    expect(screen.getByTestId('review-action-submit').props.accessibilityState.disabled)
      .toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-submit'));
    });
    expect(submitReview).not.toHaveBeenCalled();
    expect(screen.getByTestId('review-compare')).toBeTruthy();
  });

  it('requires a written translation when no suggestion exists', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: true,
      window: { window_id: 'w-1', ny_close_at: '2027-01-01T22:00:00Z', size: 1 },
      items: [{
        slot: 1,
        source_item_id: 'source-only',
        direction: 'ne-en',
        register: 'noisy_roman',
        script: 'roman',
        source_text: 'tapai kahile aaune ho',
        proposed_target: null,
        length_tier: 1,
        scheduled_credits: 2,
      }],
      mine: [],
    });
    submitReview.mockResolvedValue({ ok: true, submission: { id: 's-1' } });

    await act(async () => { renderScreen(); });
    await waitFor(() => {
      expect(screen.getByTestId('review-category-roman')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-category-roman'));
    });
    await waitFor(() => expect(screen.getByTestId('review-item-correction')).toBeTruthy());
    expect(screen.getByTestId('review-action-submit').props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('review-item-correction'), 'When will you arrive?');
    });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-submit')); });
    expect(screen.queryByTestId('review-judgment-ours')).toBeNull();
    expect(screen.queryByTestId('review-system-answer')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-mine')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
    expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 'source-only',
      action: 'edit',
      correctedText: 'When will you arrive?',
    }));
  });

  it('stores same meaning on a source-only item as an edit', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue(sourceOnlyWindow());
    submitReview.mockResolvedValue({ ok: true, submission: { id: 's-same' } });

    await act(async () => { renderScreen(); });
    await openSourceOnly('When will you arrive?');
    await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-same')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
    expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({
      action: 'edit',
      correctedText: 'When will you arrive?',
    }));
  });

  it('skips a source-only item without a judgment', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue(sourceOnlyWindow());
    submitReview.mockResolvedValue({ ok: true, submission: { id: 's-skip' } });

    await act(async () => { renderScreen(); });
    await openSourceOnly('', false);
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-skip')); });
    expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 'source-only',
      action: 'skip',
    }));
  });

  it('reports a source-only item when neither line is right', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue(sourceOnlyWindow());
    submitReview.mockResolvedValue({ ok: true, submission: { id: 's-report' } });

    await act(async () => { renderScreen(); });
    await openSourceOnly('Not this');
    await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-neither')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
    expect(submitReview).toHaveBeenCalledWith(expect.objectContaining({
      sourceItemId: 'source-only',
      action: 'report',
    }));
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

    await openEnglishAndType('नमस्ते');

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-submit'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-judgment-same'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-next'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-error-already')).toBeTruthy();
    });
  });

  it('shows the consent gate when the server rejects the window', async () => {
    useAuth.mockReturnValue(signedInAuth);
    fetchCurrentReviewWindow.mockResolvedValue({
      ok: false,
      reason: 'consent_required',
    });

    await act(async () => {
      renderScreen();
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-state-consent')).toBeTruthy();
    });
    expect(screen.queryByTestId('review-action-submit')).toBeNull();
  });

  it('ends a category on a thank-you countdown and keeps it reopenable', async () => {
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
          scheduled_credits: 2,
        },
      ],
    });
    submitReview.mockResolvedValue({ ok: true, submission: { id: 'sub-1' } });

    await act(async () => {
      renderScreen();
    });
    await openEnglishAndType('नमस्ते');
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-submit'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-judgment-same'));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('review-action-next'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('review-thanks')).toBeTruthy();
    });
    expect(screen.getByTestId('review-countdown').props.children).toMatch(/^\d+:\d{2}:\d{2}$/);
    expect(screen.queryByTestId('review-close')).toBeNull();
    expect(screen.getByTestId('review-back')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('review-continue'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('review-intro')).toBeTruthy();
    });
    expect(screen.getByTestId('review-category-english').props.accessibilityState.disabled).toBe(false);
    await openEnglishAndType('updated');
    expect(screen.getByTestId('review-item-correction').props.value).toBe('updated');
  });

  it('skips never finish ten; completed sets and extra batches reopen after restart', async () => {
    useAuth.mockReturnValue(guestAuth);
    fetchCurrentReviewWindow.mockImplementation(jest.requireActual('../../features/contribution/publicReviewApi').fetchCurrentReviewWindow);
    submitReview.mockResolvedValue({ ok: true, submission: {} });
    let rendered!: Awaited<ReturnType<typeof renderScreen>>;
    await act(async () => { rendered = await renderScreen(); });
    await openEnglishAndType('');
    const originalSource = screen.getByTestId('review-item-source').props.children;
    for (let index = 0; index < 10; index += 1) {
      await act(async () => { fireEvent.press(screen.getByTestId('review-action-skip')); });
      expect(screen.queryByTestId('review-thanks')).toBeNull();
    }
    expect(screen.getByTestId('review-item-source').props.children).toBe(originalSource);
    for (let index = 0; index < 10; index += 1) {
      await act(async () => {
        fireEvent.changeText(screen.getByTestId('review-item-correction'), `answer ${index}`);
      });
      await act(async () => { fireEvent.press(screen.getByTestId('review-action-submit')); });
      await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-same')); });
      await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
      if (index < 9) expect(screen.queryByTestId('review-thanks')).toBeNull();
    }
    expect(screen.getByTestId('review-thanks')).toBeTruthy();
    expect(screen.getByTestId('review-extra-card')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('review-extra-card')); });
    await waitFor(() => expect(screen.getByTestId('review-intro')).toBeTruthy());
    const batches = screen.getAllByTestId(/^review-set-english-/);
    expect(batches).toHaveLength(2);
    const originalBatchId = batches[0].props.testID;
    await act(async () => { fireEvent.press(batches[0]); });
    await waitFor(() => expect(screen.getByTestId('review-item-correction').props.value).toBe('answer 0'));
    expect(screen.getByTestId('review-item-source').props.children).toBe(originalSource);
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('review-item-correction'), 'changed answer');
    });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-submit')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-same')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
    expect(screen.queryByTestId('review-thanks')).toBeNull();
    expect(screen.getByTestId('review-item-correction').props.value).toBe('answer 1');
    expect((await readReviewResponses()).filter((row) => row.action === 'confirm')).toHaveLength(11);
    await act(async () => { rendered.unmount(); });
    await act(async () => { rendered = await renderScreen(); });
    await waitFor(() => expect(screen.getByTestId(originalBatchId)).toBeTruthy());
    await act(async () => { fireEvent.press(screen.getByTestId(originalBatchId)); });
    await waitFor(() => expect(screen.getByTestId('review-item-correction').props.value).toBe('changed answer'));
    await act(async () => { rendered.unmount(); });
  });
  it('keeps archived sets reopenable after the roster is exhausted', async () => {
    useAuth.mockReturnValue(guestAuth);
    await AsyncStorage.setItem('neptranslate.reviewDay.v1', JSON.stringify({ heldDay: 1000, seen: false, reviewed: [], consumed: [], coins: { english: 0, deva: 0, roman: 0 }, extra: null, categoryHistory: { english: [0] } }));
    const meaning = REVIEW_DAYS[0][0];
    await captureReviewResponse({ windowId: 'old', item: { slot: 1, source_item_id: `${meaning.id}:english`, direction: 'en-ne', register: 'formal', script: 'deva', source_text: meaning.english, proposed_target: meaning.deva, length_tier: 1, scheduled_credits: 1 }, action: 'confirm', answer: 'saved answer', userId: null });
    fetchCurrentReviewWindow.mockImplementation(jest.requireActual('../../features/contribution/publicReviewApi').fetchCurrentReviewWindow);
    await act(async () => { renderScreen(); });
    await waitFor(() => expect(screen.getByTestId('review-state-all-done')).toBeTruthy());
    expect(screen.getByTestId('review-category-english').props.accessibilityState.disabled).toBe(false);
    await act(async () => { fireEvent.press(screen.getByTestId('review-set-english-0')); });
    await waitFor(() => expect(screen.getByTestId('review-item-correction').props.value).toBe('saved answer'));
    expect(screen.getByTestId('review-item-source').props.children).toBe(meaning.english);
  });
  it('ignores a deferred private A refresh after the active account changes to B', async () => {
    const module = require('../../features/contribution/reviewResponses');
    let resolveHistory!: (rows: []) => void;
    const pendingHistory = new Promise<[]>((resolve) => { resolveHistory = resolve; });
    const read = jest.spyOn(module, 'readReviewResponses').mockImplementationOnce(() => pendingHistory).mockResolvedValue([]);
    useAuth.mockReturnValue({ ...signedInAuth, userId: 'A' });
    fetchCurrentReviewWindow.mockImplementation(async (owner: string) => ({ ok: true, window: { window_id: 'w', ny_close_at: '', size: 1 }, items: [{ slot: 1, source_item_id: owner, direction: 'en-ne', register: 'formal', script: 'deva', source_text: `source ${owner}`, proposed_target: 'target', length_tier: 1, scheduled_credits: 1 }], mine: owner === 'A' ? [{ source_item_id: 'A', action: 'confirm', corrected_text: 'private A answer', reward_granted: false }] : [] }));
    let rendered!: Awaited<ReturnType<typeof renderScreen>>;
    await act(async () => { rendered = await renderScreen(); });
    await waitFor(() => expect(read).toHaveBeenCalled());
    useAuth.mockReturnValue({ ...signedInAuth, userId: 'B' });
    await act(async () => { await rendered.rerender(<AppProviders services={createTestServices({ authConfigured: true })} bypassStartupConsent><ReviewScreen onClose={() => undefined} /></AppProviders>); });
    await openEnglishAndType('B answer');
    expect(screen.getByTestId('review-item-source').props.children).toBe('source B');
    await act(async () => { resolveHistory([]); });
    expect(screen.getByTestId('review-item-source').props.children).toBe('source B');
    expect(screen.getByTestId('review-item-correction').props.value).toBe('B answer');
    read.mockRestore();
    await act(async () => { rendered.unmount(); });
  });
  it('Back beneath Skip restores earlier drafts and comparison without creating submissions', async () => {
    useAuth.mockReturnValue(guestAuth);
    fetchCurrentReviewWindow.mockImplementation(jest.requireActual('../../features/contribution/publicReviewApi').fetchCurrentReviewWindow);
    submitReview.mockResolvedValue({ ok: true, submission: {} });
    await act(async () => { renderScreen(); });
    await openEnglishAndType('first draft');
    const source = screen.getByTestId('review-item-source').props.children;
    expect(screen.getByTestId('review-action-back')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-submit')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-back')); });
    expect(screen.getByTestId('review-item-correction').props.value).toBe('first draft');
    expect(submitReview).not.toHaveBeenCalled();
    expect(await readReviewResponses()).toEqual([]);
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-skip')); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('review-item-correction'), 'second draft'); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-back')); });
    expect(screen.getByTestId('review-item-source').props.children).toBe(source);
    expect(screen.getByTestId('review-item-correction').props.value).toBe('first draft');
    expect(submitReview).toHaveBeenCalledTimes(1);
    expect((await readReviewResponses()).map((row) => row.action)).toEqual(['skip']);
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-submit')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-judgment-mine')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-next')); });
    expect(screen.getByTestId('review-item-correction').props.value).toBe('second draft');
    expect((await readReviewResponses()).map((row) => row.action)).toEqual(['skip', 'edit']);
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-back')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-back')); });
    expect(screen.getByTestId('review-intro')).toBeTruthy();
    expect(submitReview).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('review-thanks')).toBeNull();
  });
  it('does not navigate backward while a response is being saved', async () => {
    useAuth.mockReturnValue(guestAuth);
    fetchCurrentReviewWindow.mockImplementation(jest.requireActual('../../features/contribution/publicReviewApi').fetchCurrentReviewWindow);
    let resolve!: (result: { ok: true; submission: object }) => void;
    submitReview.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => { renderScreen(); });
    await openEnglishAndType('unsent draft');
    const source = screen.getByTestId('review-item-source').props.children;
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-skip')); });
    expect(screen.getByTestId('review-action-back')).toBeDisabled();
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-back')); });
    await act(async () => { fireEvent.press(screen.getByTestId('review-back')); });
    expect(screen.getByTestId('review-item-source').props.children).toBe(source);
    expect(screen.queryByTestId('review-intro')).toBeNull();
    expect(await readReviewResponses()).toEqual([]);
    expect(submitReview).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ ok: true, submission: {} }); });
    expect(screen.getByTestId('review-item-source').props.children).not.toBe(source);
    expect((await readReviewResponses()).map((row) => row.action)).toEqual(['skip']);
  });
  it('header Back cannot leave the set while durable capture is pending', async () => {
    useAuth.mockReturnValue(guestAuth);
    fetchCurrentReviewWindow.mockImplementation(jest.requireActual('../../features/contribution/publicReviewApi').fetchCurrentReviewWindow);
    submitReview.mockResolvedValue({ ok: true, submission: {} });
    const module = require('../../features/contribution/reviewResponses');
    const capture = module.captureReviewResponse;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const spy = jest.spyOn(module, 'captureReviewResponse').mockImplementationOnce(async (input) => { await pending; return capture(input); });
    await act(async () => { renderScreen(); });
    await openEnglishAndType('pending capture');
    const source = screen.getByTestId('review-item-source').props.children;
    await act(async () => { fireEvent.press(screen.getByTestId('review-action-skip')); });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await act(async () => { fireEvent.press(screen.getByTestId('review-back')); });
    expect(screen.queryByTestId('review-intro')).toBeNull();
    expect(screen.getByTestId('review-item-source').props.children).toBe(source);
    expect(await readReviewResponses()).toEqual([]);
    await act(async () => { release(); });
    expect(screen.getByTestId('review-item-source').props.children).not.toBe(source);
    expect((await readReviewResponses()).map((row) => row.action)).toEqual(['skip']);
    spy.mockRestore();
  });
});
