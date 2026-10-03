import { act, render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { HistoryScreen } from '../HistoryScreen';
import * as phrasebook from '../../storage/phrasebook';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../storage/phrasebook', () => ({
  ...jest.requireActual('../../storage/phrasebook'), loadHistory: jest.fn(),
  clearHistory: jest.fn(async () => undefined), deleteHistoryItem: jest.fn(async () => undefined),
}));
const item = { id: '1', source: 'hello', translation: 'नमस्ते', sourceLang: 'en', targetLang: 'ne', createdAt: 1 };
async function mount() {
  await act(async () => { render(<HistoryScreen onClose={jest.fn()} onSelect={jest.fn()} />); });
  await waitFor(() => expect(screen.getByText('hello')).toBeTruthy());
}
describe('History clear confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (phrasebook.loadHistory as jest.Mock).mockResolvedValue([item]);
    (phrasebook.clearHistory as jest.Mock).mockResolvedValue(undefined);
  });
  it('uses an in-app confirmation and clears the visible list only after confirmation', async () => {
    await mount();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    expect(screen.getByTestId('history-clear-dialog')).toBeTruthy();
    expect(phrasebook.clearHistory).not.toHaveBeenCalled();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-confirm')); });
    expect(phrasebook.clearHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
    expect(screen.queryByTestId('history-clear-dialog')).toBeNull();
  });
  it('Cancel and outside dismissal preserve history without any clear call', async () => {
    await mount();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-cancel')); });
    expect(screen.getByText('hello')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-backdrop', { includeHiddenElements: true })); });
    expect(screen.queryByTestId('history-clear-dialog')).toBeNull();
    expect(phrasebook.clearHistory).not.toHaveBeenCalled();
  });
  it('keeps confirmation open after failure and allows a single retry', async () => {
    (phrasebook.clearHistory as jest.Mock).mockRejectedValueOnce(new Error('storage failed'));
    await mount();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-confirm')); });
    expect(screen.getByTestId('history-clear-dialog')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-confirm')); });
    expect(phrasebook.clearHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
  });
  it('disables dismissal and duplicate clear actions while storage is pending', async () => {
    let resolve!: () => void;
    (phrasebook.clearHistory as jest.Mock).mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    await mount();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-confirm')); });
    expect(screen.getByTestId('history-clear-confirm')).toBeDisabled();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-backdrop', { includeHiddenElements: true })); });
    expect(screen.getByTestId('history-clear-dialog')).toBeTruthy();
    await act(async () => { resolve(); });
    expect(phrasebook.clearHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
  });
  it('confirmed Clear removes real persisted history rather than only hiding rows', async () => {
    await AsyncStorage.clear();
    const actual = jest.requireActual('../../storage/phrasebook');
    await actual.addHistory(item);
    (phrasebook.loadHistory as jest.Mock).mockImplementation(actual.loadHistory);
    (phrasebook.clearHistory as jest.Mock).mockImplementation(actual.clearHistory);
    await mount();
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear')); });
    await act(async () => { fireEvent.press(screen.getByTestId('history-clear-confirm')); });
    expect(await actual.loadHistory()).toEqual([]);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
  });
});
