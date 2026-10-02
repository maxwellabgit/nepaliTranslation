import { act, render } from '@testing-library/react-native';
import { InterstitialController } from '../InterstitialController';
import { runInterstitialOpportunity } from '../interstitialOpportunity';
import { createTestServices } from '../../../services/createTestServices';
import { saveForegroundActiveMs } from '../foregroundAdTimer';

const mockServices = createTestServices({ offline: false, canRequestAds: true });
jest.mock('../../../services/ServiceContext', () => ({ useServices: () => mockServices }));
jest.mock('../../../app/FeatureConfigProvider', () => ({ useFeatureFlags: () => ({ networkAdsEnabled: true, automaticInterstitialEnabled: true }) }));
jest.mock('../../entitlements/EntitlementProvider', () => ({ useEntitlementOptional: () => null }));
jest.mock('../../subscription/SubscriptionProvider', () => ({ useSubscriptionOptional: () => null }));
jest.mock('../interstitialOpportunity', () => ({
  ...jest.requireActual('../interstitialOpportunity'), runInterstitialOpportunity: jest.fn(),
}));

it('waits another foreground interval after a resolved no-fill instead of immediately retrying', async () => {
  jest.useFakeTimers();
  const run = runInterstitialOpportunity as jest.Mock;
  run.mockResolvedValue({ presented: false, reason: 'load_failed' });
  await saveForegroundActiveMs(600_000);
  const view = await render(<InterstitialController />);
  try {
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(run).toHaveBeenCalledTimes(1);
  } finally {
    await view.unmount();
    jest.useRealTimers();
  }
});
