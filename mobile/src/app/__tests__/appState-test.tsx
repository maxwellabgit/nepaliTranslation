import { AppState, Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';
import { useEffect, useState } from 'react';

/**
 * Documents the expected app-state listener pattern used by Meaning Review sync.
 * Full MeaningReviewScreen is covered later; this locks the transition contract.
 */
function AppStateProbe({ onBackground }: { onBackground: () => void }) {
  const [label, setLabel] = useState('active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setLabel(state);
      if (state === 'background' || state === 'inactive') onBackground();
    });
    return () => sub.remove();
  }, [onBackground]);
  return <Text testID="app-state">{label}</Text>;
}

describe('app-state transitions', () => {
  test('background and inactive invoke the flush callback', async () => {
    const onBackground = jest.fn();
    const listeners: Array<(state: string) => void> = [];
    const addSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        listeners.push(handler as (state: string) => void);
        return { remove: jest.fn() } as never;
      });

    await render(<AppStateProbe onBackground={onBackground} />);
    expect(screen.getByTestId('app-state').props.children).toBe('active');

    await act(() => {
      listeners.forEach((l) => l('background'));
    });
    expect(onBackground).toHaveBeenCalledTimes(1);

    await act(() => {
      listeners.forEach((l) => l('inactive'));
    });
    expect(onBackground).toHaveBeenCalledTimes(2);

    addSpy.mockRestore();
  });
});
