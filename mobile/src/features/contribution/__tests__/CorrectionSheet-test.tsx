import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { CorrectionSheet } from '../CorrectionSheet';
import { loadOutbox } from '../../../storage/contributionOutbox';

describe('CorrectionSheet H2', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('legacy missing labels block submit until selected', async () => {
    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="hello"
          translation="नमस्ते"
          sourceLang="en"
          formality={null}
          script={null}
          surface="history"
          onClose={jest.fn()}
        />,
      );
    });

    expect(screen.getByTestId('correction-label-pickers')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-submit'));
    });
    await waitFor(() => {
      expect(
        screen.getByText('Select formality and script before submitting.'),
      ).toBeTruthy();
    });
    expect(await loadOutbox()).toHaveLength(0);

    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-formality-informal'));
      await fireEvent.press(screen.getByTestId('correction-script-roman'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('correction-labels-set')).toBeTruthy();
    });
    await act(async () => {
      await fireEvent.press(screen.getByTestId('correction-save-draft'));
    });
    await waitFor(async () => {
      expect(await loadOutbox()).toHaveLength(1);
    });
    const draft = (await loadOutbox())[0];
    expect(draft?.status).toBe('draft');
    expect(draft?.formality).toBe('informal');
    expect(draft?.script).toBe('roman');
  });

  test('shows Save on this device and Submit contribution actions', async () => {
    await act(async () => {
      render(
        <CorrectionSheet
          visible
          source="thanks"
          translation="धन्यवाद"
          sourceLang="en"
          formality="formal"
          script="deva"
          surface="live_translate"
          onClose={jest.fn()}
        />,
      );
    });
    expect(screen.getByTestId('correction-save-draft')).toBeTruthy();
    expect(screen.getByText('Save on this device')).toBeTruthy();
    expect(screen.getByText('Submit contribution')).toBeTruthy();
    expect(screen.getByTestId('correction-cancel')).toBeTruthy();
  });
});
