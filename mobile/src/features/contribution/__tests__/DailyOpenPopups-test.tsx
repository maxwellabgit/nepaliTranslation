import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppProviders } from '../../../app/AppProviders';
import { createTestServices } from '../../../services/createTestServices';
import { clearPendingFlight, dismissDailyAd, grantDailyOpenCoin, readDailyOpen } from '../dailyOpen';
import { DailyOpenPopups } from '../DailyOpenPopups';
import { useCreditAwardOptional } from '../../../translate/CreditAwardProvider';
import { CreditAwardHost } from '../../../translate/CreditAwardHost';

function AwardProbe() {
  const award = useCreditAwardOptional();
  return <Text testID="award-probe">{`${award.phase}:${award.presentation?.credits ?? 0}`}</Text>;
}
function renderPopups() {
  return render(
    <AppProviders services={createTestServices({ offline: false, canRequestAds: true })} bypassStartupConsent>
      <AwardProbe /><DailyOpenPopups /><CreditAwardHost />
    </AppProviders>,
  );
}
describe('DailyOpenPopups', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });
  it('keeps the first 10-credit message until Continue, then flies over Home', async () => {
    await act(async () => { renderPopups(); });
    expect(await screen.findByTestId('credit-award-card')).toBeTruthy();
    expect(screen.getByTestId('credit-award-body').props.children).toContain('10 credits to start');
    expect(screen.getByTestId('award-probe').props.children).toBe('message:10');
    expect(screen.queryByTestId('welcome-card')).toBeNull();
    expect(screen.queryByTestId('daily-open-ad')).toBeNull();
    const before = await readDailyOpen();
    expect(before?.adDismissed).toBe(false);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(screen.getByTestId('award-probe').props.children).toBe('message:10');
    await act(async () => { fireEvent.press(screen.getByTestId('credit-award-collect')); });
    await waitFor(() => expect(screen.getByTestId('award-probe').props.children).toBe('flying:10'));
    expect(screen.queryByTestId('credit-award-card')).toBeNull();
    expect(screen.getByTestId('credit-award-overlay').props.pointerEvents).toBe('none');
    const after = await readDailyOpen();
    expect(after?.adDismissed).toBe(true);
    expect(after?.untilMs).toBe(before?.untilMs);
  });
  it('shows the 5-credit daily message without a welcome or subscription prompt', async () => {
    await grantDailyOpenCoin(new Date('2020-01-01T15:00:00Z'));
    await act(async () => { renderPopups(); });
    expect(await screen.findByTestId('credit-award-body')).toBeTruthy();
    expect(screen.getByTestId('credit-award-body').props.children).toContain('5 credits for today');
    expect(screen.getByTestId('award-probe').props.children).toBe('message:5');
    expect(screen.queryByTestId('daily-open-ad')).toBeNull();
  });
  it('resumes an unacknowledged message without granting again', async () => {
    const granted = await grantDailyOpenCoin();
    await act(async () => { renderPopups(); });
    expect(await screen.findByTestId('credit-award-card')).toBeTruthy();
    expect((await readDailyOpen())?.untilMs).toBe(granted.untilMs);
    expect(screen.getByTestId('award-probe').props.children).toBe('message:10');
  });
  it('resumes an acknowledged flight and skips another message', async () => {
    const granted = await grantDailyOpenCoin(); await dismissDailyAd();
    await act(async () => { renderPopups(); });
    await waitFor(() => expect(screen.getByTestId('award-probe').props.children).toBe('flying:10'));
    expect(screen.queryByTestId('credit-award-card')).toBeNull();
    expect((await readDailyOpen())?.untilMs).toBe(granted.untilMs);
  });
  it('shows no award after a completed same-day open', async () => {
    const granted = await grantDailyOpenCoin();
    await dismissDailyAd(); await clearPendingFlight();
    await act(async () => { renderPopups(); });
    expect(screen.getByTestId('award-probe').props.children).toBe('idle:0');
    expect(screen.queryByTestId('credit-award-overlay')).toBeNull();
    expect((await readDailyOpen())?.untilMs).toBe(granted.untilMs);
  });
});
