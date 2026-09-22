import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { RewardSummaryCard } from '../RewardSummaryCard';
import { enqueueDraft } from '../../storage/contributionOutbox';

const mockRefresh = jest.fn(async () => undefined);

jest.mock('../../features/entitlements/EntitlementProvider', () => ({
  useEntitlementOptional: () => ({
    ready: true,
    earnedAdFreeUntilMs: Date.parse('2026-10-01T12:00:00.000Z'),
    lifetimeCredits: 7,
    version: 2,
    hasActiveEarnedAdFree: () => true,
    trustedNow: () => Date.parse('2026-09-20T12:00:00.000Z'),
    refresh: mockRefresh,
  }),
}));

describe('RewardSummaryCard', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockRefresh.mockClear();
  });

  it('shows lifetime credits, pending count, and Ad-free until', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_pending',
      surface: 'live_translate',
      source_text: 'hi',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: '2026-09-19.draft',
      status: 'synced',
    });

    await act(async () => {
      render(<RewardSummaryCard active />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('reward-lifetime-credits').props.children).toBe(
        '7 credits',
      );
    });
    expect(screen.getByTestId('reward-pending-count').props.children).toBe(
      '1 correction waiting.',
    );
    expect(screen.getByTestId('reward-ad-free-until').props.children).toMatch(
      /^Ad-free for /,
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('refreshes entitlement when becoming active after a reward', async () => {
    let view!: Awaited<ReturnType<typeof render>>;
    await act(async () => {
      view = await render(<RewardSummaryCard active={false} />);
    });
    expect(mockRefresh).not.toHaveBeenCalled();
    await act(async () => {
      await view.rerender(<RewardSummaryCard active />);
    });
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
