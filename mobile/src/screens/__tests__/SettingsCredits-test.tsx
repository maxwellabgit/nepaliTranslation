import { render, screen, waitFor, within } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';
import { FeatureConfigProvider } from '../../app/FeatureConfigProvider';
import { ServiceProvider } from '../../services/ServiceContext';
import { createTestServices } from '../../services/createTestServices';
import { openAwardCopy } from '../../features/contribution/openWelcome';
import { EntitlementProvider } from '../../features/entitlements/EntitlementProvider';

test('Settings exposes a credits reward action even before remote ads are available', async () => {
  const services = createTestServices();
  await render(<ServiceProvider services={services}><EntitlementProvider><SettingsScreen onClose={jest.fn()} /></EntitlementProvider></ServiceProvider>);
  const section = within(screen.getByTestId('settings-credit-rewards'));
  expect(section.getByText('Credits')).toBeTruthy();
  expect(section.getByText('Watch an optional ad for 2 credits')).toBeTruthy();
  expect(section.getByTestId('rewarded-ad-cta')).toBeDisabled();
  expect(section.getByText('Optional ads are unavailable right now.')).toBeTruthy();
});

test('Settings enables the optional ad after hosted flags load, without requesting ads on open', async () => {
  const services = createTestServices({ flags: { networkAdsEnabled: true, rewardedAdsEnabled: true }, offline: false });
  await render(<ServiceProvider services={services}><FeatureConfigProvider><EntitlementProvider><SettingsScreen onClose={jest.fn()} /></EntitlementProvider></FeatureConfigProvider></ServiceProvider>);
  await waitFor(() => expect(screen.getByTestId('rewarded-ad-cta')).toBeEnabled());
  expect(services.ads.networkCalls()).toEqual([]);
});

test.each(['en', 'ne', 'ne-roman'] as const)('welcome, daily and capped awards use credits rather than minutes in %s', (lang) => {
  const welcome = openAwardCopy('welcome', lang, 10);
  const daily = openAwardCopy('daily', lang, 5);
  const capped = openAwardCopy('daily', lang, 5, 0);
  expect(welcome.body).toContain('10');
  expect(daily.body).toContain('5');
  expect(capped.body).toContain('5');
  for (const copy of [welcome, daily, capped]) expect(copy.body).not.toMatch(/minutes|मिनेट|minet/i);
});
