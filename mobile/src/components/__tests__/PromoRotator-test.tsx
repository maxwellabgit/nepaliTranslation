import { act, render } from '@testing-library/react-native';

import { PromoRotator } from '../PromoRotator';

describe('PromoRotator', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on go ad-free and switches to earn credits after 60 seconds', async () => {
    const view = await render(<PromoRotator onAdFree={jest.fn()} onEarn={jest.fn()} />);
    expect(view.getByText('Go ad-free')).toBeTruthy();
    expect(view.queryByText('Earn credits')).toBeNull();
    expect(view.queryByText(/from bola/i)).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByText('Earn credits')).toBeTruthy();
    expect(view.queryByText('Go ad-free')).toBeNull();
    expect(view.queryByTestId('promo-dismiss')).toBeNull();
  });
});
