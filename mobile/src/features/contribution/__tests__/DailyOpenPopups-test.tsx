import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppProviders } from '../../../app/AppProviders';
import { createTestServices } from '../../../services/createTestServices';
import { grantDailyOpenCoin, readDailyOpen } from '../dailyOpen';
import { DailyOpenPopups } from '../DailyOpenPopups';
import { FIRST_OPEN_WELCOME } from '../openWelcome';
import { useCreditAwardOptional } from '../../../translate/CreditAwardProvider';

function AwardProbe() {
  const award = useCreditAwardOptional();
  const line = `${award.phase}:${award.presentation?.credits ?? 0}:${award.presentation?.body ?? ''}`;
  return <Text testID="award-probe">{line}</Text>;
}

function renderPopups() {
  const services = createTestServices({ offline: false, canRequestAds: true });
  return render(
    <AppProviders services={services} bypassStartupConsent>
      <AwardProbe />
      <DailyOpenPopups />
    </AppProviders>,
  );
}

describe('DailyOpenPopups', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts the 10-credit award after the last popup on first open', async () => {
    await act(async () => {
      renderPopups();
    });
    expect(await screen.findByTestId('welcome-card')).toBeTruthy();
    expect(screen.getByTestId('welcome-title').props.children).toBe(FIRST_OPEN_WELCOME[0].title.en);
    expect(screen.getByTestId('award-probe').props.children).toMatch(/^idle:0:/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('welcome-continue'));
    });
    expect(screen.getByTestId('daily-open-ad')).toBeTruthy();
    expect(screen.queryByTestId('welcome-card')).toBeNull();
    expect(screen.getByTestId('award-probe').props.children).toMatch(/^idle:0:/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('daily-open-ad-close'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('award-probe').props.children).toContain('flying:10:');
    });
    expect(screen.getByTestId('award-probe').props.children).toContain('10 credits to start');
    expect(screen.queryByTestId('daily-open-ad')).toBeNull();
    const saved = await readDailyOpen();
    expect(saved?.welcomed).toBe(true);
    expect(saved?.adDismissed).toBe(true);
    expect(saved && saved.untilMs - Date.now()).toBeGreaterThan(99 * 60 * 1000);
    expect(saved && saved.untilMs - Date.now()).toBeLessThan(101 * 60 * 1000);
  });

  it('skips the welcome and awards 5 credits on a later day', async () => {
    await grantDailyOpenCoin(new Date('2020-01-01T15:00:00.000Z'));
    await act(async () => {
      renderPopups();
    });
    expect(await screen.findByTestId('daily-open-ad')).toBeTruthy();
    expect(screen.queryByTestId('welcome-card')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByTestId('daily-open-ad-close'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('award-probe').props.children).toContain('flying:5:');
    });
    expect(screen.getByTestId('award-probe').props.children).toContain('5 credits for today');
  });
});
