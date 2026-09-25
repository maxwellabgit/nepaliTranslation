import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme';
import { updateHistoryTranslation } from '../../../storage/phrasebook';
import { CorrectionSheet } from '../CorrectionSheet';

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
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('correction-submit')).toBeNull();
  });

  it('does not save blank corrections, missing history IDs, or missing local rows', async () => {
    await act(async () => { mount(null); });
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

  it('lets the user describe register and script of an unlabeled correction', async () => {
    await act(async () => { mount(); });
    expect(screen.getByTestId('correction-label-pickers')).toBeTruthy();
    await act(async () => { fireEvent.press(screen.getByTestId('correction-script-roman')); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-script-deva')); });
    await act(async () => { fireEvent.press(screen.getByTestId('correction-formality-formal')); });
    expect(screen.getByTestId('correction-labels-set')).toBeTruthy();
    expect(screen.queryByTestId('correction-label-pickers')).toBeNull();
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
    expect(screen.getByTestId('correction-labels-set').props.children.join(''))
      .toContain('Informal');
    expect(screen.getByTestId('correction-labels-set').props.children.join(''))
      .toContain('Roman');
  });
});
