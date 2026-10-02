import AsyncStorage from '@react-native-async-storage/async-storage';
import { extendDailyUntil, grantDailyOpenCoin, readDailyOpen } from '../dailyOpen';
import { DAILY_OPEN_CREDITS, FIRST_OPEN_CREDITS } from '../openWelcome';

const MINUTE = 60 * 1000;

describe('daily open credits', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('grants ten credits on the first open and does not grant twice that day', async () => {
    const first = await grantDailyOpenCoin(new Date('2026-09-29T15:00:00.000Z'));
    const again = await grantDailyOpenCoin(new Date('2026-09-29T18:00:00.000Z'));
    expect(again.untilMs).toBe(first.untilMs);
    expect(first.untilMs - Date.parse('2026-09-29T15:00:00.000Z')).toBe(
      FIRST_OPEN_CREDITS * 10 * MINUTE,
    );
    expect(first.welcomed).toBe(true);
  });

  it('grants five credits on the next New York day', async () => {
    await grantDailyOpenCoin(new Date('2026-09-29T15:00:00.000Z'));
    const next = await grantDailyOpenCoin(new Date('2026-09-30T15:00:00.000Z'));
    expect(next.nyDate).toBe('2026-09-30');
    expect(next.untilMs - Date.parse('2026-09-30T15:00:00.000Z')).toBe(
      DAILY_OPEN_CREDITS * 10 * MINUTE,
    );
  });

  it('persists the actual capped minutes and prior balance for restart presentation', async () => {
    const now = Date.parse('2026-10-02T16:00:00Z');
    await grantDailyOpenCoin(new Date(now - 24 * 60 * MINUTE));
    const prior = now + 710 * MINUTE;
    await extendDailyUntil(prior);
    const capped = await grantDailyOpenCoin(new Date(now));
    expect(capped.untilMs).toBe(now + 720 * MINUTE);
    expect(capped.pendingFlight).toEqual({ kind: 'daily', credits: 5,
      fromUntilMs: prior, minutesApplied: 10, capped: true });
    expect((await readDailyOpen())?.pendingFlight).toEqual(capped.pendingFlight);
  });

  it('stacks the daily grant on time still left', async () => {
    const firstAt = Date.parse('2026-09-30T03:00:00.000Z');
    await grantDailyOpenCoin(new Date(firstAt));
    const nextAt = Date.parse('2026-09-30T04:30:00.000Z');
    const next = await grantDailyOpenCoin(new Date(nextAt));
    const carried = firstAt + FIRST_OPEN_CREDITS * 10 * MINUTE - nextAt;
    expect(next.untilMs - nextAt).toBe(carried + DAILY_OPEN_CREDITS * 10 * MINUTE);
    expect((await readDailyOpen())?.nyDate).toBe('2026-09-30');
  });

  it('treats an existing v1 record as welcome already used', async () => {
    await AsyncStorage.setItem(
      'neptranslate.dailyOpen.v1',
      JSON.stringify({
        nyDate: '2026-09-29',
        untilMs: Date.parse('2026-09-29T16:40:00.000Z'),
        adDismissed: true,
      }),
    );
    const migrated = await readDailyOpen();
    expect(migrated?.welcomed).toBe(true);
    expect(migrated?.untilMs).toBe(Date.parse('2026-09-29T16:40:00.000Z'));
    const sameDay = await grantDailyOpenCoin(new Date('2026-09-29T18:00:00.000Z'));
    expect(sameDay.untilMs).toBe(Date.parse('2026-09-29T16:40:00.000Z'));
    const next = await grantDailyOpenCoin(new Date('2026-09-30T15:00:00.000Z'));
    expect(next.untilMs - Date.parse('2026-09-30T15:00:00.000Z')).toBe(
      DAILY_OPEN_CREDITS * 10 * MINUTE,
    );
    expect(next.receipt.endsWith(':2026-09-30')).toBe(true);
  });
});
