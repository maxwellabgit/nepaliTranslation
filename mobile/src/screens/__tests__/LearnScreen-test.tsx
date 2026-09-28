import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { AppProviders } from '../../app/AppProviders';
import { LearnScreen } from '../../screens/LearnScreen';
import { createTestServices } from '../../services/createTestServices';
import * as sttSupport from '../../stt/sttSupport';

jest.mock('../../stt/sttSupport', () => ({
  hasNepaliVoice: jest.fn(),
}));

function renderLearn(onOpenTodaysReview = jest.fn()) {
  return render(
    <AppProviders services={createTestServices({ offline: true })} bypassStartupConsent>
      <LearnScreen active onOpenTodaysReview={onOpenTodaysReview} />
    </AppProviders>,
  );
}

describe('LearnScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (sttSupport.hasNepaliVoice as jest.Mock).mockReset();
    (sttSupport.hasNepaliVoice as jest.Mock).mockResolvedValue(true);
    (Speech.stop as jest.Mock).mockClear();
    (Speech.speak as jest.Mock).mockClear();
  });

  it('shows the alphabet immediately, with no account gate', async () => {
    await act(async () => {
      renderLearn();
    });
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
    expect(screen.getByTestId('learn-todays-10')).toBeTruthy();
    expect(screen.getByText("Today's 10")).toBeTruthy();
    expect(screen.getByTestId('learn-glyph-a')).toBeTruthy();
    expect(screen.getByTestId('learn-roman-a').props.children).toBe('a');
    expect(screen.getByTestId('learn-roman-ta').props.children).toBe('ṭa');
    expect(screen.getByTestId('learn-roman-ta2').props.children).toBe('ta');
    expect(screen.queryByText(/no account needed/i)).toBeNull();
    expect(screen.queryByText(/offline/i)).toBeNull();
    expect(screen.queryByTestId('learn-open-alphabet')).toBeNull();
  });

  it('opens Today\'s 10 from the section above the alphabet', async () => {
    const onOpenTodaysReview = jest.fn();
    await act(async () => {
      renderLearn(onOpenTodaysReview);
    });
    await fireEvent.press(screen.getByTestId('learn-todays-10'));
    expect(onOpenTodaysReview).toHaveBeenCalledTimes(1);
  });

  it('speaks a letter from the grid', async () => {
    await act(async () => {
      renderLearn();
    });
    await fireEvent.press(screen.getByTestId('learn-glyph-a'));
    expect(Speech.speak).toHaveBeenCalledWith(
      'अ',
      expect.objectContaining({ rate: 0.85 }),
    );
  });
});
