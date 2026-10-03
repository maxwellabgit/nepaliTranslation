import { useEffect, useState } from 'react';
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
    expect(view.getByText("Today's 10")).toBeTruthy();
    expect(view.queryByText('Go ad-free')).toBeNull();
    expect(view.queryByText('Network banner')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByText('Network banner')).toBeTruthy();
    expect(view.getByTestId('promo-ad-slide')).toBeTruthy();
    expect(view.queryByText("Today's 10")).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.getByText('Go ad-free')).toBeTruthy();
    expect(view.queryByText("Today's 10")).toBeNull();
    expect(view.queryByText('Network banner')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await act(async () => {
      fireEvent.press(view.getByTestId('promo-rotator'));
    });
    expect(onEarn).toHaveBeenCalledTimes(1);
  });

  it('preserves one banner instance while load and cleanup report fill changes', async () => {
    const mounted = jest.fn();
    const unmounted = jest.fn();
    function Banner({ onFill }: { onFill: (filled: boolean) => void }) {
      useEffect(() => {
        mounted(); onFill(true);
        return () => { unmounted(); onFill(false); };
      }, [onFill]);
      return <Text>Loaded banner</Text>;
    }
    function Harness() {
      const [filled, setFilled] = useState(false);
      return <PromoRotator onAdFree={jest.fn()} onEarn={jest.fn()}
        ad={<Banner onFill={setFilled} />} adFilled={filled} />;
    }
    const view = await render(<Harness />);
    expect(mounted).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(view.getByText('Loaded banner')).toBeTruthy();
    expect(view.queryByText("Today's 10")).toBeNull();
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(view.getByText('Go ad-free')).toBeTruthy();
    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it('keeps Earn credits in the Google turn when no banner is filled', async () => {
    const onEarn = jest.fn();
    const view = await render(
      <PromoRotator onAdFree={jest.fn()} onEarn={onEarn} ad={<Text>Network banner</Text>} />,
    );
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(view.getByText("Today's 10")).toBeTruthy();
    expect(view.getByTestId('promo-ad-slide')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId('promo-rotator'));
    });
    expect(onEarn).toHaveBeenCalledTimes(1);
  });
});
