import { act, render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TranslateScreen } from '../TranslateScreen';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => undefined),
  getStringAsync: jest.fn(async () => ''),
}));

describe('TranslateScreen Mark incorrect entry', () => {
  test('language selectors and swap bold the actual direction while retaining the draft', async () => {
    await render(<TranslateScreen onOpenHistory={jest.fn()} onOpenSettings={jest.fn()} />);
    expect(screen.getByTestId('direction-en-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 3 });
    expect(screen.getByTestId('direction-ne-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 1 });
    await fireEvent.changeText(screen.getByTestId('translate-input'), 'Keep this draft');
    await fireEvent.press(screen.getByTestId('translate-side-ne'));
    expect(screen.getByTestId('direction-ne-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 3 });
    expect(screen.getByTestId('direction-en-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 1 });
    expect(screen.getByTestId('translate-input').props.value).toBe('Keep this draft');
    await fireEvent.press(screen.getByTestId('translate-swap'));
    expect(screen.getByTestId('direction-en-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 3 });
    expect(screen.getByTestId('translate-side-en').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('translate-side-en'));
    expect(screen.getByTestId('direction-en-shaft', { includeHiddenElements: true })).toHaveStyle({ height: 3 });
  });

  test('Mark incorrect opens a local edit and does not offer a public submit', async () => {
    await render(
      <TranslateScreen
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
      expect(screen.getByLabelText('feedback')).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId('mark-incorrect'));

    await waitFor(() => {
      expect(screen.getByTestId('correction-sheet')).toBeTruthy();
    });
    expect(screen.getByTestId('correction-save-draft')).toBeTruthy();
    expect(screen.queryByTestId('correction-submit')).toBeNull();
    expect(screen.queryByText('Submit contribution')).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
  });
});
