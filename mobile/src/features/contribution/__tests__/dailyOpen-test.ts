import AsyncStorage from '@react-native-async-storage/async-storage';
import { grantDailyOpenCoin } from '../dailyOpen';

describe('daily open coin', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('grants ten minutes on the first open and does not grant twice that day', async () => {
    const first = await grantDailyOpenCoin(new Date('2026-09-29T15:00:00.000Z'));
    const again = await grantDailyOpenCoin(new Date('2026-09-29T18:00:00.000Z'));
    expect(again.untilMs).toBe(first.untilMs);
    expect(first.untilMs - Date.parse('2026-09-29T15:00:00.000Z')).toBe(10 * 60 * 1000);
  });

  it('grants a new coin on the next New York day', async () => {
    await grantDailyOpenCoin(new Date('2026-09-29T15:00:00.000Z'));
    const next = await grantDailyOpenCoin(new Date('2026-09-30T15:00:00.000Z'));
    expect(next.nyDate).toBe('2026-09-30');
  });
});
