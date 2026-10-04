import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { FeatureConfigProvider, useFeatureFlags, useRefreshFeatureFlags } from '../FeatureConfigProvider';
import { DEFAULT_FEATURE_FLAGS, getRuntimeFeatureFlags, type FeatureFlags } from '../featureFlags';
import { ServiceProvider } from '../../services/ServiceContext';
import { createTestServices } from '../../services/createTestServices';

const enabled = { ...DEFAULT_FEATURE_FLAGS, networkAdsEnabled: true, rewardedAdsEnabled: true };
function Probe() {
  const flags = useFeatureFlags();
  const refresh = useRefreshFeatureFlags();
  return <Pressable testID="refresh-flags" onPress={() => void refresh()}>
    <Text>{flags.rewardedAdsEnabled ? 'Rewards available' : 'Rewards unavailable'}</Text>
  </Pressable>;
}
async function mount(services: ReturnType<typeof createTestServices>) {
  await render(<ServiceProvider services={services}><FeatureConfigProvider><Probe /></FeatureConfigProvider></ServiceProvider>);
}

test('a failed startup lookup recovers through a Settings refresh without an app restart', async () => {
  const services = createTestServices();
  services.featureConfig.loadFlags = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(enabled);
  await mount(services);
  expect(screen.getByText('Rewards unavailable')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('refresh-flags'));
  await waitFor(() => expect(screen.getByText('Rewards available')).toBeTruthy());
  expect(getRuntimeFeatureFlags().rewardedAdsEnabled).toBe(true);
});

test('reconnecting reloads current flags while optional sharing stays disabled', async () => {
  const services = createTestServices({ offline: true });
  services.featureConfig.loadFlags = jest.fn().mockResolvedValueOnce(DEFAULT_FEATURE_FLAGS).mockResolvedValue(enabled);
  await mount(services);
  await act(async () => { services.setOffline(false); });
  await waitFor(() => expect(screen.getByText('Rewards available')).toBeTruthy());
  expect(getRuntimeFeatureFlags().contributionTextEnabled).toBe(false);
  expect(getRuntimeFeatureFlags().contributionSpeechEnabled).toBe(false);
});

test('a late older enabled response cannot override a newer disabled result', async () => {
  let resolve!: (flags: FeatureFlags) => void;
  const pending = new Promise<FeatureFlags>((done) => { resolve = done; });
  const services = createTestServices();
  services.featureConfig.loadFlags = jest.fn().mockReturnValueOnce(pending).mockResolvedValue(DEFAULT_FEATURE_FLAGS);
  await mount(services);
  await fireEvent.press(screen.getByTestId('refresh-flags'));
  await act(async () => { resolve(enabled); });
  expect(screen.getByText('Rewards unavailable')).toBeTruthy();
  expect(getRuntimeFeatureFlags().networkAdsEnabled).toBe(false);
});
