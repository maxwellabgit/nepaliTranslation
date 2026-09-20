import { act, render, screen, waitFor } from '@testing-library/react-native';
import { LearnScreen } from '../../screens/LearnScreen';
import * as sttSupport from '../../stt/sttSupport';

jest.mock('../../stt/sttSupport', () => ({
  hasNepaliVoice: jest.fn(),
}));

describe('LearnScreen', () => {
  beforeEach(() => {
    (sttSupport.hasNepaliVoice as jest.Mock).mockReset();
  });

  it('shows an honest banner when no Nepali TTS voice is available', async () => {
    (sttSupport.hasNepaliVoice as jest.Mock).mockResolvedValue(false);
    await act(async () => {
      render(<LearnScreen active />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('learn-no-voice')).toBeTruthy();
    });
    expect(
      screen.getByTestId('learn-speak').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('does not require auth chrome for the alphabet lesson', async () => {
    (sttSupport.hasNepaliVoice as jest.Mock).mockResolvedValue(true);
    await act(async () => {
      render(<LearnScreen active />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('learn-screen')).toBeTruthy();
    });
    expect(screen.queryByText(/sign in/i)).toBeNull();
    expect(screen.getByText(/no account needed/i)).toBeTruthy();
  });
});
