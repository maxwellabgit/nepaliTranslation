import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearBannerCooldowns,
  loadBannerCooldowns,
  recordBannerShown,
} from '../bannerCooldown';

describe('bannerCooldown', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearBannerCooldowns();
  });

  test('records and loads network and house timestamps', async () => {
    const net = await recordBannerShown('banner', 1_000);
    expect(net.lastNetworkBannerAtMs).toBe(1_000);
    const house = await recordBannerShown('house', 2_000);
    expect(house.lastHouseBannerAtMs).toBe(2_000);
    expect(house.lastNetworkBannerAtMs).toBe(1_000);
    const loaded = await loadBannerCooldowns();
    expect(loaded).toEqual({
      lastNetworkBannerAtMs: 1_000,
      lastHouseBannerAtMs: 2_000,
    });
  });
});
