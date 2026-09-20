import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '../HomeScreen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
  getStringAsync: jest.fn(async () => ''),
}));

describe('HomeScreen Mark incorrect entry', () => {
  test('Mark incorrect opens the correction sheet', async () => {
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
      expect(screen.getByTestId('correction-sheet')).toBeTruthy();
    });
    expect(screen.getByTestId('correction-save-draft')).toBeTruthy();
    expect(screen.getByTestId('correction-submit')).toBeTruthy();
  });
});
