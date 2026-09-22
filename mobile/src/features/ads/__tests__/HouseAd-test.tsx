import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { HouseAd } from '../HouseAd';
import { HOUSE_AD_COPY, HOUSE_AD_DISMISS } from '../adConfig';

describe('HouseAd', () => {
  it('shows required copy and Not now', async () => {
    const onNotNow = jest.fn();
    await act(async () => {
      render(<HouseAd surface="translate_idle" onNotNow={onNotNow} />);
    });
    expect(screen.getByText(HOUSE_AD_COPY)).toBeTruthy();
    expect(screen.getByText(HOUSE_AD_DISMISS)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('house-ad-not-now'));
    expect(onNotNow).toHaveBeenCalled();
  });
});
