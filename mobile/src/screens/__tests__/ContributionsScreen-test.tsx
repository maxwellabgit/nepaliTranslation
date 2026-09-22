import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { AppProviders } from '../../app/AppProviders';
import { ContributionsScreen } from '../ContributionsScreen';
import { createTestServices } from '../../services/createTestServices';
import { enqueueDraft } from '../../storage/contributionOutbox';

describe('ContributionsScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('shows counts for drafts waiting and needs attention', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_ui',
      surface: 'live_translate',
      source_text: 'hello',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    await enqueueDraft({
      local_fingerprint: 'fp_retry',
      surface: 'history',
      source_text: 'bye',
      model_output: 'बिदा',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: '2026-09-19.draft',
      status: 'retry',
    });

    await act(async () => {
      render(
        <AppProviders services={createTestServices({ offline: true })} bypassStartupConsent>
          <ContributionsScreen onClose={jest.fn()} />
        </AppProviders>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('count-Draft').props.children).toBe(1);
    });
    expect(screen.getByTestId('count-Waiting to sync').props.children).toBe(1);
    expect(screen.getByTestId('count-Needs attention').props.children).toBe(1);
    expect(screen.getByTestId('contributions-reward-summary')).toBeTruthy();
    expect(screen.getByTestId('reward-lifetime-credits')).toBeTruthy();
    expect(screen.getByTestId('reward-pending-count')).toBeTruthy();
    expect(screen.getByTestId('reward-ad-free-until')).toBeTruthy();
    expect(screen.getAllByLabelText('Delete contribution').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByLabelText('Retry contribution')).toBeTruthy();
    expect(screen.getAllByLabelText('Edit contribution').length).toBeGreaterThan(
      0,
    );
  });
});
