import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { PromoRotator } from '../PromoRotator';

describe('PromoRotator', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts on earn credits, then the banner ad, then go ad-free', async () => {
    const view = await render(
      <PromoRotator
        onAdFree={jest.fn()}
        onEarn={jest.fn()}
        ad={<Text>Network banner</Text>}
      />,
    );
    expect(view.getByText('Earn credits')).toBeTruthy();
    expect(view.queryByText('Go ad-free')).toBeNull();
    expect(view.queryByText('Network banner')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByText('Network banner')).toBeTruthy();
    expect(view.getByTestId('promo-ad-slide')).toBeTruthy();
    expect(view.queryByText('Earn credits')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByText('Go ad-free')).toBeTruthy();
    expect(view.queryByText('Earn credits')).toBeNull();
    expect(view.queryByText('Network banner')).toBeNull();
  });
});
