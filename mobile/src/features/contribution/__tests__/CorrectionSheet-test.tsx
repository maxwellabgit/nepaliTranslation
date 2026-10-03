import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { updateHistoryTranslation } from '../../../storage/phrasebook';
import { CorrectionSheet } from '../CorrectionSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../../../storage/phrasebook', () => ({
  ...jest.requireActual('../../../storage/phrasebook'),
  updateHistoryTranslation: jest.fn(),
}));

const onClose = jest.fn();
const onSaved = jest.fn();
function mount(historyItemId: string | null = 'history-1') {
  return render(
    <ThemeProvider scheme="light">
      <CorrectionSheet
        visible source="Hello" translation="नमस्ते" sourceLang="en"
        surface="history" historyItemId={historyItemId}
        onClose={onClose} onSaved={onSaved}
      />
    </ThemeProvider>,
  );
}

describe('local correction', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (updateHistoryTranslation as jest.Mock).mockResolvedValue(true);
  });

  it('saves a corrected translation to the exact local history item', async () => {
    await act(async () => { mount(); });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('correction-input'), '  नमस्कार  ');
    });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    expect(updateHistoryTranslation).toHaveBeenCalledWith('history-1', 'नमस्कार');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith('नमस्कार');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('correction-submit')).toBeNull();
  });

  it('does not save blank corrections, missing history IDs, or missing local rows', async () => {
    await act(async () => { mount(null); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('correction-input'), ''); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    expect(updateHistoryTranslation).not.toHaveBeenCalled();
    await act(async () => { fireEvent.changeText(screen.getByTestId('correction-input'), 'hello'); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    expect(updateHistoryTranslation).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves the sheet open when the local row disappeared', async () => {
    (updateHistoryTranslation as jest.Mock).mockResolvedValue(false);
    await act(async () => { mount(); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('correction-input'), 'नमस्कार'); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('correction-sheet')).toBeTruthy());
  });

  it('edits existing text without exposing register/script or reward controls', async () => {
    await act(async () => { mount(); });
    expect(screen.queryByTestId('correction-label-pickers')).toBeNull();
    expect(screen.queryByTestId('correction-labels-set')).toBeNull();
    expect(screen.getByTestId('correction-input').props.value).toBe('नमस्ते');
    expect(screen.getByTestId('correction-input').props.style).toEqual(expect.objectContaining({ fontSize: 22, fontWeight: '400' }));
    expect(screen.queryByText('Saved on this device. Public corrections are in Today\'s 10.')).toBeNull();
    await act(async () => { fireEvent.press(screen.getByTestId('correction-backdrop', { includeHiddenElements: true })); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(updateHistoryTranslation).not.toHaveBeenCalled();
  });

  it('keeps informal Roman labels when editing a saved translation', async () => {
    await act(async () => {
      render(
        <ThemeProvider scheme="light">
          <CorrectionSheet
            visible source="Where are you?" translation="timi kaha chhau?"
            sourceLang="en" formality="informal" script="roman"
            surface="history" historyItemId="roman-history"
            onClose={onClose} onSaved={onSaved}
          />
        </ThemeProvider>,
      );
    });
    expect(screen.queryByTestId('correction-label-pickers')).toBeNull();
    expect(screen.queryByTestId('correction-labels-set')).toBeNull();
    expect(screen.getByTestId('correction-input').props.value).toBe('timi kaha chhau?');
  });
  it('updates only text while preserving real stored language/register/script metadata', async () => {
    const actual = jest.requireActual('../../../storage/phrasebook');
    (updateHistoryTranslation as jest.Mock).mockImplementation(actual.updateHistoryTranslation);
    const original = await actual.addHistory({ id: 'history-1', source: 'Where are you?', translation: 'timi kaha chhau?', sourceLang: 'en', targetLang: 'ne', direction: 'en-ne', formality: 'informal', script: 'roman', translationMethod: 'phrase', modelVersion: 'test-model' });
    await act(async () => { mount(); });
    await act(async () => { fireEvent.changeText(screen.getByTestId('correction-input'), 'timi kata chhau?'); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    expect(await actual.loadHistory()).toEqual([{ ...original, translation: 'timi kata chhau?' }]);
  });
  it('keeps text open and prevents outside dismissal while storage is pending', async () => {
    let resolve!: (value: boolean) => void;
    (updateHistoryTranslation as jest.Mock).mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => { mount(); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-save-draft')); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-backdrop', { includeHiddenElements: true })); });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('correction-save-draft')).toBeDisabled();
    await act(async () => { resolve(true); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
