import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';
import { sendLiveIncorrectToReviewSet } from '../../storage/liveIncorrect';

jest.mock('../../storage/liveIncorrect', () => ({
  sendLiveIncorrectToReviewSet: jest.fn(async () => ({ ok: true })),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
  getStringAsync: jest.fn(async () => ''),
}));

describe('HomeScreen Mark incorrect entry', () => {
  test('Mark incorrect sends the visible source and translation', async () => {
    await render(
      <HomeScreen
        active
        neuralReady={false}
        mtWarmStatus={null}
        seed={{
          id: 'seed-1',
          source: 'Thank you',
          translation: 'धन्यवाद',
          sourceLang: 'en',
          targetLang: 'ne',
          createdAt: 1,
        }}
        onOpenHistory={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Mark incorrect')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('mark-incorrect'));

    await waitFor(() => {
      expect(sendLiveIncorrectToReviewSet).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'Thank you',
          translation: 'धन्यवाद',
          sourceLang: 'en',
        }),
      );
    });
  });
});
