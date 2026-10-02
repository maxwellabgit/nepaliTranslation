import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppProviders } from '../../app/AppProviders';
import { createTestServices } from '../../services/createTestServices';
import { CreditAwardOverlay } from '../CreditAwardOverlay';
import { presentCreditClaim } from '../CreditAwardProvider';
import { CreditsGauge } from '../CreditsGauge';

const creditMs = (credits: number) => credits * 10 * 60_000;

function renderGauge(previewRemainingMs?: number) {
  const services = createTestServices({ offline: false, canRequestAds: true });
  return render(
    <AppProviders services={services} bypassStartupConsent>
      <CreditsGauge compact previewRemainingMs={previewRemainingMs} />
    </AppProviders>,
  );
}

describe('CreditsGauge ad-free timer', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows an empty timer and keeps interstitial status in the label', async () => {
    await act(async () => {
      renderGauge(0);
    });
    expect(screen.getByTestId('credits-gauge-timer').props.children).toBe('0:00');
    expect(screen.getByTestId('credits-gauge').props.accessibilityLabel).toContain('Ads off');
    expect(screen.queryByText('50')).toBeNull();
    expect(screen.queryByTestId('credits-gauge-fill')).toBeNull();
  });

  it('shows remaining time without a filling bar', async () => {
    await act(async () => {
      renderGauge(creditMs(20));
    });
    expect(screen.getByTestId('credits-gauge-timer').props.children).toBe('3:20:00');
    expect(screen.queryByTestId('credits-gauge-fill')).toBeNull();
  });

  it('keeps the compact pill the same size at eight hours', async () => {
    await act(async () => {
      renderGauge(creditMs(50));
    });
    expect(screen.getByTestId('credits-gauge-timer').props.children).toBe('8:20:00');
    expect(screen.queryByTestId('credits-gauge-fill')).toBeNull();
    const timer = StyleSheet.flatten(screen.getByTestId('credits-gauge-timer').props.style);
    expect(timer.color).not.toBe('#D64545');
    const wrap = StyleSheet.flatten(screen.getByTestId('credits-gauge').props.style);
    expect(wrap.transform).toEqual([{ scale: 1 }]);
    expect(screen.queryByText('50')).toBeNull();
  });

  it('keeps the timer readable above the retired gauge mark', async () => {
    await act(async () => {
      renderGauge(creditMs(55));
    });
    expect(screen.getByTestId('credits-gauge-timer').props.children).toBe('9:10:00');
    expect(screen.queryByTestId('credits-gauge-fill')).toBeNull();
    const timer = StyleSheet.flatten(screen.getByTestId('credits-gauge-timer').props.style);
    expect(timer.color).not.toBe('#D64545');
    const wrap = StyleSheet.flatten(screen.getByTestId('credits-gauge').props.style);
    expect(wrap.transform).toEqual([{ scale: 1 }]);
  });
});

describe('CreditAwardOverlay', () => {
  it('shows the award message and starts the coin flight', async () => {
    const onCollect = jest.fn();
    const services = createTestServices({ offline: false, canRequestAds: true });
    await act(async () => {
      render(
        <AppProviders services={services} bypassStartupConsent>
          <CreditAwardOverlay
            credits={3}
            minutes={30}
            capped={false}
            flying={false}
            onCollect={onCollect}
          />
        </AppProviders>,
      );
    });
    expect(screen.getByTestId('credit-award-body').props.children).toContain('3');
    expect(screen.getByText('Credits Awarded!')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('credit-award-collect'));
    });
    expect(onCollect).toHaveBeenCalled();
    expect(screen.queryByTestId('credit-award-coin-6')).toBeNull();
    expect(screen.queryByTestId('credit-award-coin-7')).toBeNull();
  });

  it('uses a larger burst through 50 credits and the same burst above that', async () => {
    const services = createTestServices({ offline: false, canRequestAds: true });
    await act(async () => {
      render(
        <AppProviders services={services} bypassStartupConsent>
          <CreditAwardOverlay
            credits={45}
            minutes={450}
            capped={false}
            flying={true}
            onCollect={() => undefined}
          />
        </AppProviders>,
      );
    });
    expect(screen.getByTestId('credit-award-coin-29')).toBeTruthy();
    expect(screen.queryByTestId('credit-award-coin-30')).toBeNull();
    await act(async () => {
      render(
        <AppProviders services={services} bypassStartupConsent>
          <CreditAwardOverlay
            credits={80}
            minutes={720}
            capped
            flying={true}
            onCollect={() => undefined}
          />
        </AppProviders>,
      );
    });
    expect(screen.getByTestId('credit-award-coin-29')).toBeTruthy();
    expect(screen.queryByTestId('credit-award-coin-30')).toBeNull();
  });

  it('stacks a later award on time still left and stops at 12 hours', () => {
    const now = Date.parse('2026-09-29T18:00:00.000Z');
    const open = presentCreditClaim({
      nowMs: now,
      earnedUntilMs: now + 40 * 60_000,
      credits: 3,
      minutesApplied: 30,
      capped: false,
    });
    expect(open.toRemainingMs - open.fromRemainingMs).toBe(30 * 60_000);
    expect(open.capped).toBe(false);

    const full = presentCreditClaim({
      nowMs: now,
      earnedUntilMs: now + 11 * 60 * 60_000,
      credits: 18,
      minutesApplied: 180,
      capped: false,
    });
    expect(full.toRemainingMs).toBe(12 * 60 * 60_000);
    expect(full.capped).toBe(true);
  });
});
