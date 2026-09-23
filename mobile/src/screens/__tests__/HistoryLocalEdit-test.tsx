import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HistoryScreen } from '../HistoryScreen';
import { addHistory, loadHistory } from '../../storage/phrasebook';
import { loadOutbox } from '../../storage/contributionOutbox';

describe('History local edit', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('saving the sheet updates the history row and does not enqueue a review', async () => {
    await addHistory({
      id: 'hist-1',
      source: 'hello',
      translation: 'नमस्ते',
      sourceLang: 'en',
      targetLang: 'ne',
    });

    await render(
      <HistoryScreen onClose={jest.fn()} onSelect={jest.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Edit translation')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Edit this translation on this device'));
    await waitFor(() => {
      expect(screen.getByTestId('correction-input')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('correction-input'), 'नमस्कार');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('correction-save-draft'));
    });

    await waitFor(async () => {
      const rows = await loadHistory();
      expect(rows.find((row) => row.id === 'hist-1')?.translation).toBe('नमस्कार');
    });
    expect(await loadOutbox()).toHaveLength(0);
  });
});
