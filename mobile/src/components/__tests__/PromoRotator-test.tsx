import { act, fireEvent, render } from '@testing-library/react-native';
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
    const onEarn = jest.fn();
    const view = await render(
      <PromoRotator
        onAdFree={jest.fn()}
        onEarn={onEarn}
        ad={<Text>Network banner</Text>}
        adFilled
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

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('promo-rotator'));
    });
    expect(onEarn).toHaveBeenCalledTimes(1);
  });

  it('keeps Earn credits in the Google turn when no banner is filled', async () => {
    const onEarn = jest.fn();
    const view = await render(
      <PromoRotator onAdFree={jest.fn()} onEarn={onEarn} ad={<Text>Network banner</Text>} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(view.getByText('Earn credits')).toBeTruthy();
    expect(view.getByTestId('promo-ad-slide')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('promo-rotator'));
    });
    expect(onEarn).toHaveBeenCalledTimes(1);
  });
});
