import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SampleVideoAd } from '../SampleVideoAd';

describe('testing-ground ad outcomes', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it('locks skip for five seconds and reports a skip only once', async () => {
    const finish = jest.fn();
    await act(async () => { render(<SampleVideoAd visible onFinished={finish} />); });
    await fireEvent.press(screen.getByTestId('sample-video-skip'));
    expect(finish).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(5000));
    await fireEvent.press(screen.getByTestId('sample-video-skip'));
    await fireEvent.press(screen.getByTestId('sample-video-skip'));
    await act(async () => jest.advanceTimersByTime(15000));
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(false);
  });
  it('reports watching the full sample as completed', async () => {
    const finish = jest.fn();
    await act(async () => { render(<SampleVideoAd visible onFinished={finish} />); });
    await act(async () => jest.advanceTimersByTime(15000));
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(true);
  });
});
